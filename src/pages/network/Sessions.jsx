import { useEffect, useMemo, useState } from 'react';
import { FiMonitor, FiRefreshCw, FiServer, FiWifi } from 'react-icons/fi';
import { useTenant } from '../../hooks/useTenant';
import { getActiveSessions, getDevices, getSites } from '../../services/operationsService';
import { PageHeader, SiteBadge, StatCard, StatusBadge } from '../../components/operations/OperationsUI';

function fmtBytes(value) {
  const n = Number(value || 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

function fmtDuration(seconds) {
  const n = Math.max(0, Number(seconds || 0));
  const d = Math.floor(n / 86400);
  const h = Math.floor((n % 86400) / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  return [d ? `${d}d` : null, h ? `${h}h` : null, m ? `${m}m` : null, !d && !h ? `${s}s` : null].filter(Boolean).join(' ') || '0s';
}

function fmtTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}


function isRouterDevice(device) {
  const type = String(device?.device_type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['router', 'mikrotik_router', 'routeros', 'gateway'].includes(type) || Boolean(device?.router_identity || device?.identity_name);
}

export default function Sessions() {
  const { tenantId } = useTenant();
  const [sessions, setSessions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState('all');
  const [routerId, setRouterId] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!tenantId) return;
    try {
      setLoading(true); setError('');
      const [sessionRows, deviceRows, siteRows] = await Promise.all([
        getActiveSessions(tenantId), getDevices(tenantId), getSites(tenantId),
      ]);
      setSessions(sessionRows || []); setDevices(deviceRows || []); setSites(siteRows || []);
    } catch (e) {
      console.error('Active sessions load error:', e);
      setError(e?.message || 'Unable to load active hotspot sessions.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [tenantId]);

  const routers = useMemo(() => devices.filter(isRouterDevice), [devices]);
  const online = useMemo(() => sessions.filter(s => String(s.status).toLowerCase() === 'online'), [sessions]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter(s => {
      const matchesSite = siteId === 'all' || s.site_id === siteId;
      const matchesRouter = routerId === 'all' || s.network_device_id === routerId;
      const isLive = String(s.status || '').toLowerCase() === 'online';
      const hay = [s.username, s.ip_address, s.mac_address, s.login_method].filter(Boolean).join(' ').toLowerCase();
      return isLive && matchesSite && matchesRouter && (!q || hay.includes(q));
    });
  }, [sessions, siteId, routerId, search]);

  const selectedOnline = filtered.filter(s => String(s.status).toLowerCase() === 'online');
  const uniqueUsers = new Set(selectedOnline.map(s => s.username).filter(Boolean)).size;
  const totalTraffic = selectedOnline.reduce((n, s) => n + Number(s.total_bytes || 0), 0);

  return <div className="space-y-6">
    <PageHeader eyebrow="Network" title="Active Sessions" description="Live MikroTik Hotspot sessions synchronized from RouterOS every 30 seconds, with tenant, site and router filtering." actions={<button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"><FiRefreshCw className={loading ? 'animate-spin' : ''}/>Refresh</button>}/>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Active sessions" value={selectedOnline.length}/>
      <StatCard label="Unique users" value={uniqueUsers}/>
      <StatCard label="Routers" value={routers.length}/>
      <StatCard label="Live traffic" value={fmtBytes(totalTraffic)}/>
    </div>

    <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search username, IP or MAC" className="rounded-xl border border-slate-300 px-4 py-2.5"/>
        <select value={siteId} onChange={e=>setSiteId(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5"><option value="all">All sites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select value={routerId} onChange={e=>setRouterId(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5"><option value="all">All routers</option>{routers.filter(r=>siteId==='all'||r.site_id===siteId).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-gradient-to-r from-blue-50 to-cyan-50"><tr>{['User','Site','Router','IP / MAC','Login','Uptime','Traffic','Last seen','Status'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={9} className="p-12 text-center text-slate-500">Loading live sessions…</td></tr> : filtered.length===0 ? <tr><td colSpan={9} className="p-12 text-center text-slate-500"><FiMonitor className="mx-auto mb-3 text-3xl text-blue-500"/>No synchronized sessions match these filters.</td></tr> : filtered.map(s=>{
            const router = devices.find(d=>d.id===s.network_device_id);
            return <tr key={s.id} className="hover:bg-blue-50/30">
              <td className="px-4 py-4 font-bold text-slate-900">{s.username||'—'}</td>
              <td className="px-4 py-4"><SiteBadge siteId={s.site_id || router?.site_id} sites={sites}/></td>
              <td className="px-4 py-4 text-sm"><span className="inline-flex items-center gap-2"><FiServer className="text-blue-500"/>{router?.name||'—'}</span></td>
              <td className="px-4 py-4 text-sm text-slate-700"><div>{s.ip_address||'—'}</div><div className="text-xs text-slate-400">{s.mac_address||'—'}</div></td>
              <td className="px-4 py-4 text-sm text-slate-700">{s.login_method||'—'}</td>
              <td className="px-4 py-4 text-sm text-slate-700">{fmtDuration(s.session_seconds)}</td>
              <td className="px-4 py-4 text-sm font-semibold text-slate-700">{fmtBytes(s.total_bytes)}</td>
              <td className="px-4 py-4 text-sm text-slate-600">{fmtTime(s.last_seen_at)}</td>
              <td className="px-4 py-4"><StatusBadge value={s.status}/></td>
            </tr>;
          })}
        </tbody>
      </table></div>
    </section>

    <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-sm"><div className="flex gap-3"><FiWifi className="mt-1 text-xl text-cyan-600"/><div><h3 className="font-bold">Live source</h3><p className="mt-1 text-sm text-slate-600">Rows come from <code>hotspot_active_sessions</code>; router and site names are resolved from <code>network_devices</code> and <code>network_sites</code>.</p></div></div></section>
  </div>;
}
