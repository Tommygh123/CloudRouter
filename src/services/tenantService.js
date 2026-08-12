import { supabase } from '../lib/supabase';

function normalizeSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '');
}

function createResult(data = null, error = null) {
  return {
    data,
    error,
  };
}

export const tenantService = {
  async getIndustries() {
    try {
      const { data, error } = await supabase
        .from('industries')
        .select(`
          id,
          name,
          code,
          description
        `)
        .eq('is_active', true)
        .order('name', {
          ascending: true,
        });

      return createResult(data ?? [], error);
    } catch (error) {
      console.error(
        'Could not load industries:',
        error,
      );

      return createResult([], error);
    }
  },

  async getMemberships(userId) {
    /*
     * Workspace membership is security-sensitive and must not depend on
     * tenant_users client-side RLS being permissive enough to discover the
     * caller's own row. cloudrouter_my_memberships() is a SECURITY DEFINER
     * RPC that is still strictly scoped to auth.uid().
     */
    if (!userId) {
      return createResult([], null);
    }

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        return createResult([], sessionError);
      }

      const authenticatedUserId =
        sessionData?.session?.user?.id;

      if (!authenticatedUserId) {
        return createResult(
          [],
          new Error('Your session has expired. Please sign in again.'),
        );
      }

      if (authenticatedUserId !== userId) {
        return createResult(
          [],
          new Error('The requested workspace user does not match the signed-in account.'),
        );
      }

      const { data, error } = await supabase.rpc(
        'cloudrouter_my_memberships',
      );

      if (error) {
        console.error(
          'Could not load memberships through cloudrouter_my_memberships():',
          error,
        );

        return createResult([], error);
      }

      const memberships = Array.isArray(data)
        ? data
        : [];

      return createResult(memberships, null);
    } catch (error) {
      console.error(
        'Could not load memberships:',
        error,
      );

      return createResult([], error);
    }
  },

  async resolveCloudRouterIndustryCode() {
    const { data, error } = await this.getIndustries();
    if (error) return createResult(null, error);

    const rows = data || [];
    const preferred = rows.find((item) => {
      const haystack = `${item.code || ''} ${item.name || ''} ${item.description || ''}`.toLowerCase();
      return ['hotspot', 'internet', 'isp', 'wifi', 'wi-fi', 'telecom', 'network'].some((term) => haystack.includes(term));
    }) || rows[0];

    if (!preferred?.code) {
      return createResult(null, new Error('No active industry reference exists. Keep one active industry row so register_business() can complete.'));
    }

    return createResult(preferred.code, null);
  },

  async registerBusiness({
    fullName,
    businessName,
    slug,
    country,
  }) {
    try {
      const cleanFullName = fullName?.trim();
      const cleanBusinessName = businessName?.trim();
      const cleanSlug = normalizeSlug(slug || businessName);
      const cleanCountry = country?.trim();

      if (!cleanFullName) return createResult(null, new Error('Owner full name is required.'));
      if (!cleanBusinessName) return createResult(null, new Error('Business name is required.'));
      if (!cleanSlug) return createResult(null, new Error('Business URL is required.'));
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) return createResult(null, new Error('Business URL may contain only lowercase letters, numbers and hyphens.'));
      if (cleanSlug.length < 3) return createResult(null, new Error('Business URL must contain at least 3 characters.'));
      if (cleanSlug.length > 60) return createResult(null, new Error('Business URL must not exceed 60 characters.'));
      if (!cleanCountry) return createResult(null, new Error('Country is required.'));

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) return createResult(null, sessionError);
      if (!sessionData?.session?.user?.id) return createResult(null, new Error('Your session has expired. Please sign in again.'));

      const industryResult = await this.resolveCloudRouterIndustryCode();
      if (industryResult.error) return createResult(null, industryResult.error);

      const { data, error } = await supabase.rpc('register_business', {
        p_full_name: cleanFullName,
        p_business_name: cleanBusinessName,
        p_slug: cleanSlug,
        p_industry_code: industryResult.data,
        p_country: cleanCountry,
      });

      if (error) {
        console.error('register_business RPC failed:', error);
        return createResult(null, error);
      }
      return createResult(data, null);
    } catch (error) {
      console.error('Business registration failed:', error);
      return createResult(null, error);
    }
  },


  async updateBusinessBranding(tenantId, { businessName, logoUrl }) {
    if (!tenantId) return createResult(null, new Error('Tenant ID is required.'));
    const cleanName = String(businessName || '').trim();
    if (!cleanName) return createResult(null, new Error('Business name is required.'));

    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({
          business_name: cleanName,
          logo_url: logoUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId)
        .select('id, business_name, logo_url, slug, country, currency_code, timezone, status, updated_at')
        .single();
      return createResult(data, error);
    } catch (error) {
      console.error('Could not update tenant branding:', error);
      return createResult(null, error);
    }
  },

  async uploadTenantLogo(tenantId, file) {
    if (!tenantId) return createResult(null, new Error('Tenant ID is required.'));
    if (!file) return createResult(null, new Error('Choose a logo file.'));

    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowed.has(file.type)) return createResult(null, new Error('Logo must be PNG, JPG/JPEG or WEBP.'));
    if (file.size > 2 * 1024 * 1024) return createResult(null, new Error('Logo must not exceed 2 MB.'));

    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const folder = tenantId;
    const path = `${folder}/logo.${extension}`;

    try {
      const { data: existing } = await supabase.storage.from('tenant-branding').list(folder, { limit: 20 });
      const oldLogoPaths = (existing || [])
        .filter((item) => /^logo\.(png|jpg|jpeg|webp)$/i.test(item.name))
        .map((item) => `${folder}/${item.name}`);
      if (oldLogoPaths.length) await supabase.storage.from('tenant-branding').remove(oldLogoPaths);

      const { error: uploadError } = await supabase.storage
        .from('tenant-branding')
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (uploadError) return createResult(null, uploadError);

      const { data } = supabase.storage.from('tenant-branding').getPublicUrl(path);
      return createResult({ path, publicUrl: data?.publicUrl || null }, null);
    } catch (error) {
      console.error('Could not upload tenant logo:', error);
      return createResult(null, error);
    }
  },

  async removeTenantLogo(tenantId) {
    if (!tenantId) return createResult(null, new Error('Tenant ID is required.'));
    try {
      const { data: existing, error: listError } = await supabase.storage
        .from('tenant-branding')
        .list(tenantId, { limit: 20 });
      if (listError) return createResult(null, listError);
      const paths = (existing || [])
        .filter((item) => /^logo\.(png|jpg|jpeg|webp)$/i.test(item.name))
        .map((item) => `${tenantId}/${item.name}`);
      if (paths.length) {
        const { error } = await supabase.storage.from('tenant-branding').remove(paths);
        if (error) return createResult(null, error);
      }
      return createResult(true, null);
    } catch (error) {
      console.error('Could not remove tenant logo:', error);
      return createResult(null, error);
    }
  },

  async getSubscription(tenantId) {
    if (!tenantId) {
      return createResult(null, null);
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          tenant_id,
          plan_id,
          status,
          trial_started_at,
          trial_ends_at,
          plans:plan_id (
            id,
            name,
            code
          )
        `)
        .eq('tenant_id', tenantId)
        .in('status', [
          'trialing',
          'active',
          'past_due',
        ])
        .maybeSingle();

      return createResult(data, error);
    } catch (error) {
      console.error(
        'Could not load subscription:',
        error,
      );

      return createResult(null, error);
    }
  },
};

export default tenantService;