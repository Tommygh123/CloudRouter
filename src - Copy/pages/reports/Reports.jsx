import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiDownload, FiFileText, FiPrinter } from 'react-icons/fi';
import { useTenant } from '../../hooks/useTenant';
import { getSites, getTableRows } from '../../services/operationsService';
import { PageHeader, StatCard } from '../../components/operations/OperationsUI';
import { downloadText, money, periodRange, toInputDate, withinRange } from '../../utils/reporting';

function paid(row){return ['paid','successful','success'].includes(String(row.payment_status||row.status||'').toLowerCase());}
function csvCell(value){return `"${String(value??'').replaceAll('"','""')}"`;}

export default function Reports(){
  const {tenantId,currentTenant}=useTenant();
  const [sites,setSites]=useState([]); const [orders,setOrders]=useState([]); const [vouchers,setVouchers]=useState([]); const [sessions,setSessions]=useState([]);
  const [siteId,setSiteId]=useState('all'); const [period,setPeriod]=useState('this_month'); const [fromDate,setFromDate]=useState(toInputDate(new Date())); const [toDate,setToDate]=useState(toInputDate(new Date()));
  const [paymentStatus,setPaymentStatus]=useState('all'); const [loading,setLoading]=useState(true); const [error,setError]=useState('');

  async function load(){if(!tenantId)return;setLoading(true);setError('');const results=await Promise.allSettled([getSites(tenantId),getTableRows('hotspot_orders',tenantId),getTableRows('hotspot_vouchers',tenantId),getTableRows('hotspot_sessions',tenantId)]);setSites(results[0].status==='fulfilled'?results[0].value:[]);setOrders(results[1].status==='fulfilled'?results[1].value:[]);setVouchers(results[2].status==='fulfilled'?results[2].value:[]);setSessions(results[3].status==='fulfilled'?results[3].value:[]);if(results.some(r=>r.status==='rejected'))setError('Some report sources are not available. Run the latest CloudRouter operations SQL migration.');setLoading(false);}
  useEffect(()=>{load();},[tenantId]);

  const range=useMemo(()=>periodRange(period,fromDate,toDate),[period,fromDate,toDate]);
  const filteredOrders=useMemo(()=>orders.filter(x=>(siteId==='all'||x.site_id===siteId)&&withinRange(x,range,['paid_at','created_at'])&&(paymentStatus==='all'||String(x.payment_status||'').toLowerCase()===paymentStatus)),[orders,siteId,range,paymentStatus]);
  const filteredVouchers=useMemo(()=>vouchers.filter(x=>(siteId==='all'||x.site_id===siteId)&&withinRange(x,range,['sold_at','created_at'])),[vouchers,siteId,range]);
  const filteredSessions=useMemo(()=>sessions.filter(x=>(siteId==='all'||x.site_id===siteId)&&withinRange(x,range,['started_at','created_at'])),[sessions,siteId,range]);
  const visibleSites=useMemo(()=>sites.filter(s=>siteId==='all'||s.id===siteId),[sites,siteId]);
  const siteRows=useMemo(()=>visibleSites.map(site=>{const os=filteredOrders.filter(x=>x.site_id===site.id);const vs=filteredVouchers.filter(x=>x.site_id===site.id);const ss=filteredSessions.filter(x=>x.site_id===site.id);return{site,revenue:os.filter(paid).reduce((a,x)=>a+Number(x.amount??x.price_amount??0),0),orders:os.length,paid:os.filter(paid).length,vouchers:vs.length,sold:vs.filter(x=>x.status==='sold').length,activeSessions:ss.filter(x=>['active','online'].includes(String(x.status).toLowerCase())).length};}),[visibleSites,filteredOrders,filteredVouchers,filteredSessions]);
  const totals=useMemo(()=>({revenue:siteRows.reduce((a,x)=>a+x.revenue,0),orders:siteRows.reduce((a,x)=>a+x.orders,0),paid:siteRows.reduce((a,x)=>a+x.paid,0),sold:siteRows.reduce((a,x)=>a+x.sold,0),sessions:siteRows.reduce((a,x)=>a+x.activeSessions,0)}),[siteRows]);
  const rangeLabel=range.from||range.to?`${range.from?range.from.toLocaleDateString():'Beginning'} – ${range.to?range.to.toLocaleDateString():'Today'}`:'All time';

  function exportCsv(){const rows=[['CloudRouter Site Report'],['Business',currentTenant?.business_name||''],['Period',rangeLabel],['Site',siteId==='all'?'All sites':sites.find(s=>s.id===siteId)?.name||''],[],['Site','Revenue','Orders','Paid Orders','Vouchers','Sold Vouchers','Active Sessions'],...siteRows.map(x=>[x.site.name,x.revenue,x.orders,x.paid,x.vouchers,x.sold,x.activeSessions])];downloadText('cloudrouter-site-report.csv',rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv;charset=utf-8');}

  async function exportPdf(){
    try{
      const [{jsPDF},autoTableModule]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
      const doc=new jsPDF({orientation:'landscape'}); const autoTable=autoTableModule.default||autoTableModule.autoTable;
      doc.setFontSize(18);doc.text('CloudRouter Business Report',14,16);doc.setFontSize(10);doc.text(`${currentTenant?.business_name||'Hotspot business'} | ${rangeLabel}`,14,23);doc.text(`Site: ${siteId==='all'?'All sites':sites.find(s=>s.id===siteId)?.name||''}`,14,29);
      autoTable(doc,{startY:35,head:[['Site','Revenue','Orders','Paid','Vouchers','Sold','Active Sessions']],body:siteRows.map(x=>[x.site.name,money(x.revenue),x.orders,x.paid,x.vouchers,x.sold,x.activeSessions]),styles:{fontSize:9},headStyles:{fillColor:[37,99,235]}});
      doc.save('cloudrouter-site-report.pdf');
    }catch(e){setError(`PDF export needs jspdf and jspdf-autotable in the React project. ${e.message||''}`);}
  }

  return <div className="space-y-6">
    <PageHeader eyebrow="Business intelligence" title="Reports by Site & Period" description="Filter revenue, orders, voucher sales and sessions by site and reporting period. Exports always use the active filters." actions={<><button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"><FiPrinter/>Print</button><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"><FiDownload/>CSV</button><button onClick={exportPdf} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"><FiFileText/>Export PDF</button></>}/>
    {error&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>}
    <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2 text-sm font-bold text-blue-800"><FiCalendar/>Report filters</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <label className="text-sm font-semibold text-slate-700">Site<select value={siteId} onChange={e=>setSiteId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="all">All sites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Period<select value={period} onChange={e=>setPeriod(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="this_week">This week</option><option value="last_7_days">Last 7 days</option><option value="this_month">This month</option><option value="last_month">Last month</option><option value="this_quarter">This quarter</option><option value="this_year">This year</option><option value="all">All time</option><option value="custom">Custom range</option></select></label>
      <label className="text-sm font-semibold text-slate-700">From<input type="date" disabled={period!=='custom'} value={fromDate} onChange={e=>setFromDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"/></label>
      <label className="text-sm font-semibold text-slate-700">To<input type="date" disabled={period!=='custom'} value={toDate} onChange={e=>setToDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"/></label>
      <label className="text-sm font-semibold text-slate-700">Payment<select value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></label>
    </div><p className="mt-4 text-xs font-medium text-slate-500">Current reporting window: {rangeLabel}</p></section>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCard label="Revenue" value={money(totals.revenue)}/><StatCard label="Orders" value={totals.orders}/><StatCard label="Paid orders" value={totals.paid}/><StatCard label="Sold vouchers" value={totals.sold}/><StatCard label="Active sessions" value={totals.sessions}/></div>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-gradient-to-r from-blue-50 to-cyan-50"><tr>{['Site','Revenue','Orders','Paid','Vouchers','Sold','Active sessions'].map(h=><th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading?<tr><td colSpan="7" className="p-12 text-center text-slate-500">Loading report…</td></tr>:siteRows.length===0?<tr><td colSpan="7" className="p-12 text-center text-slate-500">No site data matches the selected period.</td></tr>:siteRows.map(x=><tr key={x.site.id} className="hover:bg-blue-50/40"><td className="px-5 py-4 font-bold text-slate-900">{x.site.name}</td><td className="px-5 py-4 font-semibold text-emerald-700">{money(x.revenue)}</td><td className="px-5 py-4">{x.orders}</td><td className="px-5 py-4">{x.paid}</td><td className="px-5 py-4">{x.vouchers}</td><td className="px-5 py-4">{x.sold}</td><td className="px-5 py-4">{x.activeSessions}</td></tr>)}</tbody></table></div></section>
  </div>;
}
