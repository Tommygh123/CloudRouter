import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { FiBriefcase, FiGlobe, FiLink, FiUser, FiWifi } from 'react-icons/fi';

import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { seedDefaultHotspotPlansForTenant } from '../../services/hotspotPlanService';
import { tenantService } from '../../services/tenantService';

function generateSlug(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '');
}

export default function BusinessSetup() {
  const { user } = useAuth();
  const { refreshMemberships } = useTenant();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.user_metadata?.full_name || '',
    businessName: '',
    slug: '',
    country: 'Ghana',
  });

  const workspacePreview = useMemo(() => {
    if (!form.slug) return 'Your CloudRouter workspace address will appear here';
    return `${window.location.origin}/${form.slug}`;
  }, [form.slug]);

  function handleBusinessNameChange(event) {
    const businessName = event.target.value;
    setForm((current) => ({
      ...current,
      businessName,
      slug: slugManuallyEdited ? current.slug : generateSlug(businessName),
    }));
  }

  function handleSlugChange(event) {
    setSlugManuallyEdited(true);
    setForm((current) => ({ ...current, slug: generateSlug(event.target.value) }));
  }

  function handleSimpleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;

    const cleanForm = {
      fullName: form.fullName.trim(),
      businessName: form.businessName.trim(),
      slug: generateSlug(form.slug),
      country: form.country.trim(),
    };

    if (!cleanForm.fullName || !cleanForm.businessName || !cleanForm.slug || !cleanForm.country) {
      toast.error('Complete all required fields.');
      return;
    }
    if (cleanForm.slug.length < 3 || cleanForm.slug.length > 60) {
      toast.error('The business URL must contain between 3 and 60 characters.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await tenantService.registerBusiness(cleanForm);
      if (error) {
        if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate') || error.message?.toLowerCase().includes('already exists')) {
          toast.error('That business URL is already in use. Please choose another one.');
          return;
        }
        toast.error(`Business creation failed: ${error.message || 'Unknown database error'}`);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!result) {
        toast.error('Business creation returned no result. Check register_business().');
        return;
      }

      const refreshResult = await refreshMemberships();
      if (refreshResult?.error) {
        toast.error('Business created, but the workspace could not be loaded. Please refresh the page.');
        return;
      }

      const createdTenantId = result.tenant_id || result.id || refreshResult?.data?.[0]?.tenant_id;
      if (createdTenantId) {
        try {
          await seedDefaultHotspotPlansForTenant(createdTenantId, 'GHS');
        } catch (seedError) {
          console.warn('Default CloudRouter plans were not seeded:', seedError);
          toast('Workspace created. Default plans could not be added automatically; you can add them from Internet Plans.', { icon: 'ℹ️' });
        }
      }

      toast.success('CloudRouter workspace created. Your 14-day trial has started.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Business creation failed:', error);
      toast.error(error?.message || 'An unexpected error occurred while creating the business.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7 rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-7 text-white shadow-xl shadow-blue-200/60 sm:p-9">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-white/15 p-3"><FiWifi className="h-7 w-7" /></span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">CloudRouter setup</p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Create your hotspot workspace</h1>
              <p className="mt-3 max-w-2xl text-blue-50">CloudRouter is purpose-built for hotspot and internet access businesses, so there is no business-type selection. We will create a ready-to-edit starter set of internet plans for your first workspace.</p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Owner full name</span>
              <div className="relative"><FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" /><input type="text" name="fullName" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={form.fullName} onChange={handleSimpleChange} autoComplete="name" placeholder="Your full name" required /></div>
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Hotspot / ISP business name</span>
              <div className="relative"><FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" /><input type="text" name="businessName" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={form.businessName} onChange={handleBusinessNameChange} autoComplete="organization" placeholder="ABC Community WiFi" required /></div>
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Workspace URL</span>
              <div className="relative"><FiLink className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" /><input type="text" name="slug" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={form.slug} onChange={handleSlugChange} autoComplete="off" placeholder="abc-community-wifi" minLength={3} maxLength={60} required /></div>
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Workspace address</p><p className="mt-1 break-all text-sm font-medium text-blue-950">{workspacePreview}</p></div>
            </label>

            <label className="sm:col-span-2 sm:max-w-md">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Country</span>
              <div className="relative"><FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" /><input type="text" name="country" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={form.country} onChange={handleSimpleChange} autoComplete="country-name" required /></div>
            </label>
          </div>

          <div className="mt-7 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
            <strong>Starter plans included:</strong> GH₵1 / 200 MB, GH₵2 / 500 MB, GH₵3 / 1 GB, GH₵5 / 2 GB, GH₵10 / 3 GB, GH₵12 / 4 GB and GH₵18 / 5 GB. You can edit, disable or delete them later.
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">No credit card required. Full features are available during the 14-day trial.</p>
            <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Creating workspace…' : 'Create CloudRouter workspace'}</button>
          </div>
        </form>
      </div>
    </main>
  );
}
