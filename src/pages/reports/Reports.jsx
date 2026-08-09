import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiDownload, FiFileText, FiFilter, FiPrinter, FiRefreshCw } from 'react-icons/fi';
import { useTenant } from '../../hooks/useTenant';
import { getActiveSessions, getDevices, getHistoricalSessions, getSites, getTableRows } from '../../services/operationsService';
import { PageHeader, StatCard } from '../../components/operations/OperationsUI';
import { downloadText, money, periodRange, toInputDate, withinRange } from '../../utils/reporting';
import { ACTIVE_SESSION_STATUSES, createSiteResolver, isPaid, norm, orderAmount } from '../../utils/operationsData';

function csvCell(value){return `"${String(value??'').replaceAll('"','""')}"`;}
function isRouterDevice(device){const t=String(device?.device_type||'').trim().toLowerCase().replace(/[\s-]+/g,'_');return ['router','mikrotik_router','routeros','gateway','gateway_router'].includes(t)||Boolean(device?.router_identity||device?.identity_name);}

export default function Reports(){
  const {tenantId,currentTenant}=useTenant();
  const[sites,setSites]=useState([]);const[devices,setDevices]=useState([]);const[orders,setOrders]=useState([]);const[vouchers,setVouchers]=useState([]);const[sessions,setSessions]=useState([]);
  const[siteId,setSiteId]=useState('all');const[routerId,setRouterId]=useState('all');const[period,setPeriod]=useState('custom');
  const now=new Date();const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const[fromDate,setFromDate]=useState(toInputDate(monthStart));const[toDate,setToDate]=useState(toInputDate(now));const[paymentStatus,setPaymentStatus]=useState('all');const[loading,setLoading]=useState(true);const[error,setError]=useState('');

  async function load(){if(!tenantId)return;setLoading(true);setError('');const r=await Promise.allSettled([getSites(tenantId),getDevices(tenantId),getTableRows('hotspot_orders',tenantId),getTableRows('hotspot_vouchers',tenantId),getActiveSessions(tenantId),getHistoricalSessions(tenantId)]);setSites(r[0].status==='fulfilled'?r[0].value:[]);setDevices(r[1].status==='fulfilled'?r[1].value:[]);setOrders(r[2].status==='fulfilled'?r[2].value:[]);setVouchers(r[3].status==='fulfilled'?r[3].value:[]);const live=r[4].status==='fulfilled'?r[4].value:[];const history=r[5].status==='fulfilled'?r[5].value:[];setSessions([...history,...live]);if(r.some(x=>x.status==='rejected'))setError('Some report sources are unavailable; available sources are still shown.');setLoading(false)}
  useEffect(()=>{load()},[tenantId]);

  const routers=useMemo(()=>devices.filter(isRouterDevice),[devices]);
  const range=useMemo(()=>periodRange(period,fromDate,toDate),[period,fromDate,toDate]);
  const resolveSite=useMemo(()=>createSiteResolver(devices),[devices]);
  const resolveRouter=(row)=>row.network_device_id||row.router_id||null;
  const matchScope=(row)=>{const resolvedSiteId=resolveSite(row);const resolvedRouterId=resolveRouter(row);return(siteId==='all'||resolvedSiteId===siteId)&&(routerId==='all'||resolvedRouterId===routerId)};
  const os=useMemo(()=>orders.map(x=>({...x,resolved_site_id:resolveSite(x),resolved_router_id:resolveRouter(x)})).filter(x=>matchScope(x)&&withinRange(x,range,['paid_at','created_at'])&&(paymentStatus==='all'||norm(x.payment_status)===paymentStatus)),[orders,resolveSite,siteId,routerId,range,paymentStatus]);
  const vs=useMemo(()=>vouchers.map(x=>({...x,resolved_site_id:resolveSite(x),resolved_router_id:resolveRouter(x)})).filter(x=>matchScope(x)&&withinRange(x,range,['sold_at','created_at'])),[vouchers,resolveSite,siteId,routerId,range]);
  const ss=useMemo(()=>sessions.map(x=>({...x,resolved_site_id:resolveSite(x),resolved_router_id:resolveRouter(x)})).filter(x=>matchScope(x)&&withinRange(x,range,['started_at','created_at','last_seen_at'])),[sessions,resolveSite,siteId,routerId,range]);

  const siteChoices=useMemo(()=>sites.filter(s=>siteId==='all'||s.id===siteId),[sites,siteId]);
  const siteRows=useMemo(()=>siteChoices.map(site=>{const a=os.filter(x=>x.resolved_site_id===site.id),b=vs.filter(x=>x.resolved_site_id===site.id),c=ss.filter(x=>x.resolved_site_id===site.id);return{site,revenue:a.filter(isPaid).reduce((n,x)=>n+orderAmount(x),0),orders:a.length,paid:a.filter(isPaid).length,vouchers:b.length,sold:b.filter(x=>norm(x.status)==='sold').length,activeSessions:c.filter(x=>ACTIVE_SESSION_STATUSES.has(norm(x.status))).length};}),[siteChoices,os,vs,ss]);
  const totals={revenue:os.filter(isPaid).reduce((a,x)=>a+orderAmount(x),0),orders:os.length,paid:os.filter(isPaid).length,sold:vs.filter(x=>norm(x.status)==='sold').length,sessions:ss.filter(x=>ACTIVE_SESSION_STATUSES.has(norm(x.status))).length};
  const rangeLabel=range.from||range.to?`${range.from?range.from.toLocaleDateString():'Beginning'} – ${range.to?range.to.toLocaleDateString():'Today'}`:'All time';

  function selectPeriod(value){setPeriod(value);if(value==='custom')return;const r=periodRange(value,fromDate,toDate);if(r.from)setFromDate(toInputDate(r.from));if(r.to)setToDate(toInputDate(r.to));}
  function exportCsv(){const rows=[['CloudRouter Site Report'],['Business',currentTenant?.business_name||''],['Period',rangeLabel],['Site',siteId==='all'?'All sites':sites.find(s=>s.id===siteId)?.name||''],['Router',routerId==='all'?'All routers':routers.find(r=>r.id===routerId)?.name||''],[],['Site','Revenue','Orders','Paid Orders','Vouchers','Sold Vouchers','Active Sessions'],...siteRows.map(x=>[x.site.name,x.revenue,x.orders,x.paid,x.vouchers,x.sold,x.activeSessions])];downloadText('cloudrouter-site-report.csv',rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');}
  async function exportPdf(){try{const[{jsPDF},m]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);const doc=new jsPDF({orientation:'landscape'}),autoTable=m.default||m.autoTable;doc.setFontSize(18);doc.text('CloudRouter Business Report',14,16);doc.setFontSize(10);doc.text(`${currentTenant?.business_name||'Hotspot business'} | ${rangeLabel}`,14,23);doc.text(`Site: ${siteId==='all'?'All sites':sites.find(s=>s.id===siteId)?.name||''} | Router: ${routerId==='all'?'All routers':routers.find(r=>r.id===routerId)?.name||''}`,14,29);autoTable(doc,{startY:36,head:[['Site','Revenue','Orders','Paid','Vouchers','Sold','Active Sessions']],body:siteRows.map(x=>[x.site.name,money(x.revenue),x.orders,x.paid,x.vouchers,x.sold,x.activeSessions]),headStyles:{fillColor:[37,99,235]}});doc.save('cloudrouter-site-report.pdf')}catch(e){setError(`PDF export failed. ${e.message||''}`)}}

  return <div className="space-y-6">
    <PageHeader eyebrow="Business intelligence" title="Reports" description="Generate professional site and router reports for any date range, then export to PDF or CSV." actions={<><button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"><FiRefreshCw/>Refresh</button><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"><FiPrinter/>Print</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"><FiDownload/>CSV</button><button onClick={exportPdf} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg"><FiFileText/>Export PDF</button></>}/>
    {error&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}

    <section className="rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-[.12em] text-blue-800"><FiFilter/>Report filters</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-sm font-semibold text-slate-700">From<input type="date" value={fromDate} onChange={e=>{setFromDate(e.target.value);setPeriod('custom')}} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm"/></label>
        <label className="text-sm font-semibold text-slate-700">To<input type="date" value={toDate} min={fromDate} onChange={e=>{setToDate(e.target.value);setPeriod('custom')}} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm"/></label>
        <label className="text-sm font-semibold text-slate-700">Quick period<select value={period} onChange={e=>selectPeriod(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="custom">Custom dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="this_week">This week</option><option value="last_7_days">Last 7 days</option><option value="this_month">This month</option><option value="last_month">Last month</option><option value="this_quarter">This quarter</option><option value="this_year">This year</option><option value="all">All time</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Site<select value={siteId} onChange={e=>{setSiteId(e.target.value);setRouterId('all')}} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="all">All sites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Router<select value={routerId} onChange={e=>setRouterId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="all">All routers</option>{routers.filter(r=>siteId==='all'||r.site_id===siteId).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Payment<select value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option></select></label>
      </div>
      <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-100/70 px-3 py-2 text-xs font-semibold text-blue-800"><FiCalendar/>Reporting window: {rangeLabel}</div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCard label="Revenue" value={money(totals.revenue)}/><StatCard label="Orders" value={totals.orders}/><StatCard label="Paid orders" value={totals.paid}/><StatCard label="Sold vouchers" value={totals.sold}/><StatCard label="Active sessions" value={totals.sessions}/></div>

    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-900">Performance by site</h2><p className="mt-1 text-xs text-slate-500">{rangeLabel}</p></div><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-gradient-to-r from-blue-50 to-cyan-50"><tr>{['Site','Revenue','Orders','Paid','Vouchers','Sold','Active sessions'].map(h=><th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading?<tr><td colSpan="7" className="p-12 text-center text-slate-500">Loading report…</td></tr>:siteRows.length===0?<tr><td colSpan="7" className="p-12 text-center text-slate-500">No data matches the selected filters.</td></tr>:siteRows.map(x=><tr key={x.site.id} className="hover:bg-blue-50/30"><td className="px-5 py-4 font-bold">{x.site.name}</td><td className="px-5 py-4 font-bold text-emerald-700">{money(x.revenue)}</td><td className="px-5 py-4">{x.orders}</td><td className="px-5 py-4">{x.paid}</td><td className="px-5 py-4">{x.vouchers}</td><td className="px-5 py-4">{x.sold}</td><td className="px-5 py-4">{x.activeSessions}</td></tr>)}</tbody></table></div></section>
  </div>;
}
