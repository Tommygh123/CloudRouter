import { useEffect, useState } from 'react';
import { FiImage, FiSave, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { useTenant } from '../../hooks/useTenant';
import { tenantService } from '../../services/tenantService';
import { CloudRouterMark, TenantLogo } from '../../components/branding/TenantBrand';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export default function BusinessBranding() {
  const { currentTenant, tenantId, refreshMemberships } = useTenant();
  const [businessName, setBusinessName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setBusinessName(currentTenant?.business_name || currentTenant?.name || '');
    setPreviewUrl(currentTenant?.logo_url || '');
    setSelectedFile(null);
  }, [currentTenant?.id, currentTenant?.business_name, currentTenant?.name, currentTenant?.logo_url]);

  function chooseLogo(event) {
    const file = event.target.files?.[0];
    setError('');
    setMessage('');

    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Choose a PNG, JPG/JPEG or WEBP logo.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo must not exceed 2 MB.');
      event.target.value = '';
      return;
    }

    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    const nextPreview = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(nextPreview);
  }

  async function save(event) {
    event.preventDefault();
    if (!tenantId || saving) return;

    const cleanName = businessName.trim();
    if (!cleanName) {
      setError('Business name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      let logoUrl = currentTenant?.logo_url || null;

      if (selectedFile) {
        const upload = await tenantService.uploadTenantLogo(tenantId, selectedFile);
        if (upload.error) throw upload.error;
        logoUrl = upload.data?.publicUrl || logoUrl;
      }

      const result = await tenantService.updateBusinessBranding(tenantId, {
        businessName: cleanName,
        logoUrl,
      });
      if (result.error) throw result.error;

      await refreshMemberships();
      setSelectedFile(null);
      setPreviewUrl(logoUrl || '');
      setMessage('Business branding saved successfully.');
    } catch (nextError) {
      console.error('Branding save failed:', nextError);
      setError(nextError?.message || 'Could not save business branding.');
    } finally {
      setSaving(false);
    }
  }

  async function removeLogo() {
    if (!tenantId || saving || !currentTenant?.logo_url) return;
    if (!window.confirm('Remove the current tenant logo? CloudRouter branding will remain visible.')) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const remove = await tenantService.removeTenantLogo(tenantId);
      if (remove.error) throw remove.error;
      const update = await tenantService.updateBusinessBranding(tenantId, {
        businessName: businessName.trim() || currentTenant?.business_name,
        logoUrl: null,
      });
      if (update.error) throw update.error;
      await refreshMemberships();
      setSelectedFile(null);
      setPreviewUrl('');
      setMessage('Tenant logo removed.');
    } catch (nextError) {
      console.error('Logo removal failed:', nextError);
      setError(nextError?.message || 'Could not remove tenant logo.');
    } finally {
      setSaving(false);
    }
  }

  const previewTenant = {
    ...(currentTenant || {}),
    business_name: businessName || currentTenant?.business_name,
    logo_url: previewUrl || null,
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-blue-600">Settings</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Business & Branding</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Set the tenant identity used across the CloudRouter dashboard, vouchers and customer-facing hotspot experience.</p>
      </div>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <form onSubmit={save} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-blue-50 p-3 text-blue-600"><FiImage className="h-5 w-5" /></span>
            <div><h2 className="font-bold text-slate-900">Tenant identity</h2><p className="text-sm text-slate-500">PNG, JPG or WEBP. Maximum 2 MB.</p></div>
          </div>

          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Business name
            <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" required />
          </label>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-700">Business logo</p>
            <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 sm:flex-row sm:items-center">
              <TenantLogo tenant={previewTenant} size="lg" />
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{selectedFile?.name || (currentTenant?.logo_url ? 'Current tenant logo' : 'No tenant logo uploaded')}</p>
                <p className="mt-1 text-xs text-slate-500">This logo will appear with “Powered by CloudRouter” branding.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                    <FiUploadCloud /> Choose logo
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo} className="hidden" />
                  </label>
                  {currentTenant?.logo_url && (
                    <button type="button" onClick={removeLogo} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><FiTrash2 /> Remove logo</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"><FiSave /> {saving ? 'Saving…' : 'Save branding'}</button>
          </div>
        </form>

        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Brand preview</p>
          <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
            <div className="flex items-center gap-3">
              <TenantLogo tenant={previewTenant} size="lg" />
              <div className="min-w-0"><p className="truncate text-lg font-black">{businessName || 'Your hotspot business'}</p><p className="text-xs text-slate-400">Internet services</p></div>
            </div>
            <div className="mt-6 border-t border-white/10 pt-4"><p className="text-[10px] uppercase tracking-[.18em] text-slate-400">Powered by</p><div className="mt-2"><CloudRouterMark light /></div></div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">The same tenant identity will be used by shared dashboard navigation and voucher printing. Captive-portal synchronization can use this branding source too.</p>
        </section>
      </div>
    </div>
  );
}
