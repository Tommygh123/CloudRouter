import { FiExternalLink, FiGlobe, FiImage } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useTenant } from '../../hooks/useTenant';
import { TenantLogo } from '../../components/branding/TenantBrand';

export default function CaptivePortalSettings() {
  const { currentTenant } = useTenant();
  const tenantName = currentTenant?.business_name || currentTenant?.name || 'Your hotspot business';
  return <div className="space-y-6">
    <div><p className="text-sm font-semibold uppercase tracking-[.18em] text-blue-600">Settings</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Captive Portal</h1><p className="mt-2 text-sm text-slate-500">Preview the branding source used by your MikroTik customer login experience.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><FiGlobe className="text-xl text-blue-600"/><h2 className="font-bold">Portal branding source</h2></div><div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><TenantLogo tenant={currentTenant} size="lg"/><div><p className="font-bold text-slate-900">{tenantName}</p><p className="text-xs text-slate-500">Powered by CloudRouter</p></div></div><p className="mt-4 text-sm leading-6 text-slate-600">Change the tenant logo or business name in Business & Branding. The MikroTik portal package should use the same values when it is generated/synchronized.</p><Link to="/dashboard/settings/profile" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"><FiImage/>Edit branding</Link></section>
      <section className="rounded-3xl border border-cyan-100 bg-cyan-50 p-6"><h2 className="font-bold text-cyan-950">Portal deployment</h2><p className="mt-2 text-sm leading-6 text-cyan-900">Your current MikroTik portal files remain router-local. CloudRouter branding settings are now centralized; the next portal-package update can inject the tenant name/logo URL without changing MikroTik authentication.</p><Link to="/dashboard/network/devices" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-800">Open Routers & APs <FiExternalLink/></Link></section>
    </div>
  </div>;
}
