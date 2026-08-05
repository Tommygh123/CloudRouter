import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiBarChart2, FiCreditCard, FiDollarSign, FiMapPin, FiMonitor, FiRadio, FiShoppingCart, FiTrendingUp, FiUsers, FiWifi } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';

const EMPTY = { plans:0,vouchers:0,customers:0,sessions:0,devices:0,orders:0,revenue:0,pending:0,sites:0,onlineRouters:0 };

async function safeCount(table, tenantId, filters = []) {
  let q = supabase.from(table).select('*', { count:'exact', head:true }).eq('tenant_id', tenantId);
  for (const f of filters) q = q.eq(f.column, f.value);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

export default function Dashboard(){
  const { currentTenant } = useTenant();
  const [stats,setStats] = useState(EMPTY);
  const [loading,setLoading] = useState(true);
  const [warning,setWarning] = useState('');

  useEffect(()=>{ let alive=true; (async()=>{
    if(!currentTenant?.id){setLoading(false);return;}
    setLoading(true); const id=currentTenant.id;
    const tasks=[
      safeCount('hotspot_plans',id,[{column:'is_active',value:true}]),
      safeCount('hotspot_vouchers',id,[{column:'status',value:'available'}]),
      safeCount('hotspot_customers',id),
      safeCount('hotspot_sessions',id,[{column:'status',value:'active'}]),
      safeCount('network_devices',id,[{column:'is_active',value:true}]),
      safeCount('hotspot_orders',id),
      safeCount('network_sites',id,[{column:'is_active',value:true}]),
      safeCount('network_devices',id,[{column:'device_type',value:'router'},{column:'status',value:'online'}]),
    ];
    const results=await Promise.allSettled(tasks); const val=i=>results[i].status==='fulfilled'?results[i].value:0;
    const {data:orders,error}=await supabase.from('hotspot_orders').select('amount,price_amount,payment_status').eq('tenant_id',id);
    const paid=(orders||[]).filter(o=>['paid','successful','success'].includes(String(o.payment_status).toLowerCase()));
    if(alive){
      setStats({plans:val(0),vouchers:val(1),customers:val(2),sessions:val(3),devices:val(4),orders:val(5),sites:val(6),onlineRouters:val(7),revenue:paid.reduce((a,o)=>a+Number(o.amount??o.price_amount??0),0),pending:(orders||[]).filter(o=>String(o.payment_status).toLowerCase()==='pending').length});
      setWarning(error?'Revenue could not be loaded. Some counters may show zero.':results.some(r=>r.status==='rejected')?'Some modules are not yet available in the database; their counters show zero.':'');
      setLoading(false);
    }
  })(); return()=>{alive=false}; },[currentTenant?.id]);

  const cards=useMemo(()=>[
    ['Revenue',`GHS ${stats.revenue.toFixed(2)}`,FiDollarSign,'from-emerald-500 to-teal-500'],
    ['Customers',stats.customers,FiUsers,'from-blue-600 to-indigo-500'],
    ['Active Sessions',stats.sessions,FiMonitor,'from-violet-500 to-fuchsia-500'],
    ['Routers Online',stats.onlineRouters,FiRadio,'from-cyan-500 to-blue-500'],
    ['Available Vouchers',stats.vouchers,FiCreditCard,'from-amber-500 to-orange-500'],
    ['Active Plans',stats.plans,FiWifi,'from-sky-500 to-cyan-500'],
    ['Orders',stats.orders,FiShoppingCart,'from-indigo-500 to-violet-500'],
    ['Network Sites',stats.sites,FiMapPin,'from-rose-500 to-pink-500'],
  ],[stats]);

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-[2rem] bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-200/60 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-sm font-bold uppercase tracking-[.18em] text-blue-100">CloudRouter Control Center</p><h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">{currentTenant?.business_name || 'Your hotspot business'}</h1><p className="mt-2 max-w-2xl text-blue-50">Business performance and network health in one place. All figures come from this tenant's live records.</p></div>
        <div className="flex flex-wrap gap-2"><Link to="/dashboard/analytics" className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-lg"><FiTrendingUp/>Open Analytics</Link><Link to="/dashboard/network/monitoring" className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur"><FiActivity/>Network Health</Link></div>
      </div>
    </section>

    {warning&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{warning}</div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon,tone])=><article key={label} className="group overflow-hidden rounded-3xl border border-white bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className={`h-1.5 bg-gradient-to-r ${tone}`}/><div className="p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-600">{label}</p><span className={`rounded-xl bg-gradient-to-br ${tone} p-2.5 text-white shadow-md`}><Icon/></span></div><p className="mt-5 text-3xl font-black text-slate-900">{loading?'—':typeof value==='number'?value.toLocaleString():value}</p></div></article>)}</section>

    <section className="grid gap-4 lg:grid-cols-3">
      <Link to="/dashboard/hotspot/vouchers" className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm hover:shadow-md"><FiCreditCard className="text-2xl text-blue-600"/><h3 className="mt-4 text-lg font-bold text-blue-950">Sell & manage vouchers</h3><p className="mt-2 text-sm text-slate-600">Generate, print, assign and track voucher stock.</p></Link>
      <Link to="/dashboard/reports" className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm hover:shadow-md"><FiBarChart2 className="text-2xl text-emerald-600"/><h3 className="mt-4 text-lg font-bold text-emerald-950">Filtered reports</h3><p className="mt-2 text-sm text-slate-600">Compare sites and periods, then export the filtered result.</p></Link>
      <Link to="/dashboard/network/devices" className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm hover:shadow-md"><FiRadio className="text-2xl text-violet-600"/><h3 className="mt-4 text-lg font-bold text-violet-950">Routers & access points</h3><p className="mt-2 text-sm text-slate-600">Register equipment and generate router-specific scripts.</p></Link>
    </section>
  </div>;
}
