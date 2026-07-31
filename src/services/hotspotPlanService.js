import { supabase } from "../lib/supabase";

export async function getCurrentTenantId() {
  const { data, error } = await supabase.rpc("current_tenant_id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      "No active tenant was found for the current user."
    );
  }

  return data;
}

function normalizeOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildPlanPayload(plan, tenantId = null) {
  const payload = {
    router_id: plan.router_id || null,
    name: plan.name.trim(),
    code: plan.code.trim().toUpperCase(),
    description: plan.description?.trim() || null,
    price: Number(plan.price),
    currency_code: (plan.currency_code || "GHS")
      .trim()
      .toUpperCase(),
    data_limit_bytes: normalizeOptionalNumber(
      plan.data_limit_bytes
    ),
    time_limit_minutes: normalizeOptionalNumber(
      plan.time_limit_minutes
    ),
    validity_minutes: normalizeOptionalNumber(
      plan.validity_minutes
    ),
    download_speed_kbps: normalizeOptionalNumber(
      plan.download_speed_kbps
    ),
    upload_speed_kbps: normalizeOptionalNumber(
      plan.upload_speed_kbps
    ),
    shared_users: Number(plan.shared_users || 1),
    mikrotik_profile_name:
      plan.mikrotik_profile_name.trim(),
    display_order: Number(plan.display_order || 0),
    is_public: Boolean(plan.is_public),
    is_active: Boolean(plan.is_active),
  };

  if (tenantId) {
    payload.tenant_id = tenantId;
  }

  return payload;
}

function throwFriendlyError(error) {
  if (error?.code === "23505") {
    throw new Error(
      "A plan with this code already exists for your business."
    );
  }

  throw new Error(error?.message || "The plan request failed.");
}

export async function getHotspotPlans() {
  const tenantId = await getCurrentTenantId();

  const { data, error } = await supabase
    .from("hotspot_plans")
    .select(`
      id,
      tenant_id,
      router_id,
      name,
      code,
      description,
      price,
      currency_code,
      data_limit_bytes,
      time_limit_minutes,
      validity_minutes,
      download_speed_kbps,
      upload_speed_kbps,
      shared_users,
      mikrotik_profile_name,
      display_order,
      is_public,
      is_active,
      created_at,
      updated_at
    `)
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .order("price", { ascending: true });

  if (error) {
    throwFriendlyError(error);
  }

  return data ?? [];
}

export async function hotspotPlanCodeExists(
  code,
  excludePlanId = null
) {
  const tenantId = await getCurrentTenantId();
  let query = supabase
    .from("hotspot_plans")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("code", code.trim().toUpperCase());

  if (excludePlanId) {
    query = query.neq("id", excludePlanId);
  }

  const { count, error } = await query;

  if (error) {
    throwFriendlyError(error);
  }

  return (count ?? 0) > 0;
}

export async function createHotspotPlan(plan) {
  const tenantId = await getCurrentTenantId();
  const payload = buildPlanPayload(plan, tenantId);

  const { data, error } = await supabase
    .from("hotspot_plans")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throwFriendlyError(error);
  }

  return data;
}

export async function updateHotspotPlan(planId, plan) {
  const tenantId = await getCurrentTenantId();
  const payload = buildPlanPayload(plan);

  const { data, error } = await supabase
    .from("hotspot_plans")
    .update(payload)
    .eq("id", planId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) {
    throwFriendlyError(error);
  }

  return data;
}

export async function setHotspotPlanStatus(
  planId,
  isActive
) {
  const tenantId = await getCurrentTenantId();

  const { data, error } = await supabase
    .from("hotspot_plans")
    .update({ is_active: isActive })
    .eq("id", planId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) {
    throwFriendlyError(error);
  }

  return data;
}

export async function deleteHotspotPlan(planId) {
  const tenantId = await getCurrentTenantId();

  const { error } = await supabase
    .from("hotspot_plans")
    .delete()
    .eq("id", planId)
    .eq("tenant_id", tenantId);

  if (error) {
    throwFriendlyError(error);
  }
}

export const CLOUDROUTER_GHANA_STARTER_PLANS = [
  { name: '200 MB Daily', code: 'GHS1-200MB', price: 1, data_limit_bytes: 209715200, validity_minutes: 1440, mikrotik_profile_name: 'GHS1-200MB', display_order: 10 },
  { name: '500 MB Daily', code: 'GHS2-500MB', price: 2, data_limit_bytes: 524288000, validity_minutes: 1440, mikrotik_profile_name: 'GHS2-500MB', display_order: 20 },
  { name: '1 GB Daily', code: 'GHS3-1GB', price: 3, data_limit_bytes: 1073741824, validity_minutes: 1440, mikrotik_profile_name: 'GHS3-1GB', display_order: 30 },
  { name: '2 GB', code: 'GHS5-2GB', price: 5, data_limit_bytes: 2147483648, validity_minutes: 4320, mikrotik_profile_name: 'GHS5-2GB', display_order: 40 },
  { name: '3 GB', code: 'GHS10-3GB', price: 10, data_limit_bytes: 3221225472, validity_minutes: 10080, mikrotik_profile_name: 'GHS10-3GB', display_order: 50 },
  { name: '4 GB', code: 'GHS12-4GB', price: 12, data_limit_bytes: 4294967296, validity_minutes: 10080, mikrotik_profile_name: 'GHS12-4GB', display_order: 60 },
  { name: '5 GB Monthly', code: 'GHS18-5GB', price: 18, data_limit_bytes: 5368709120, validity_minutes: 43200, mikrotik_profile_name: 'GHS18-5GB', display_order: 70 },
];

export async function seedDefaultHotspotPlansForTenant(tenantId, currencyCode = 'GHS') {
  if (!tenantId) throw new Error('Tenant ID is required to seed starter plans.');

  const { data: existing, error: existingError } = await supabase
    .from('hotspot_plans')
    .select('code')
    .eq('tenant_id', tenantId);
  if (existingError) throwFriendlyError(existingError);

  const existingCodes = new Set((existing || []).map((row) => String(row.code || '').toUpperCase()));
  const rows = CLOUDROUTER_GHANA_STARTER_PLANS
    .filter((plan) => !existingCodes.has(plan.code))
    .map((plan) => ({
      tenant_id: tenantId,
      router_id: null,
      name: plan.name,
      code: plan.code,
      description: 'CloudRouter starter plan — edit to suit your hotspot business.',
      price: plan.price,
      currency_code: currencyCode,
      data_limit_bytes: plan.data_limit_bytes,
      time_limit_minutes: null,
      validity_minutes: plan.validity_minutes,
      download_speed_kbps: null,
      upload_speed_kbps: null,
      shared_users: 1,
      mikrotik_profile_name: plan.mikrotik_profile_name,
      display_order: plan.display_order,
      is_public: true,
      is_active: true,
    }));

  if (!rows.length) return [];
  const { data, error } = await supabase.from('hotspot_plans').insert(rows).select();
  if (error) throwFriendlyError(error);
  return data || [];
}
