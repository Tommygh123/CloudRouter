import { Link } from 'react-router-dom';
import {
  FiActivity, FiArrowRight, FiBarChart2, FiCheck, FiCloud, FiCreditCard,
  FiMapPin, FiRadio, FiShield, FiUsers, FiWifi, FiZap,
} from 'react-icons/fi';
import networkPreview from '../../assets/cloudrouter-network-topology.png';

const features = [
  [FiWifi, 'Hotspot billing', 'Sell time and data plans through MikroTik hotspots with automated access provisioning.'],
  [FiCreditCard, 'Payments & vouchers', 'Support online payments, manual vouchers, vendor distribution, printing and phone sharing.'],
  [FiActivity, 'Live network monitoring', 'See router online/offline state, hotspot sessions, WAN health, CPU, memory and uptime.'],
  [FiMapPin, 'Multi-site operations', 'Manage multiple hotspot locations under one tenant and compare performance by site.'],
  [FiBarChart2, 'Analytics & reports', 'Track revenue trends, users per day, plan popularity, site performance and exports.'],
  [FiShield, 'Tenant isolation', 'Keep each operator, staff account, network and customer dataset securely separated.'],
];

function Brand() {
  return <span className="flex items-center gap-3">
    <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
      <FiCloud className="text-xl text-white" />
      <FiWifi className="absolute -bottom-1 -right-1 rounded-full bg-cyan-300 p-1 text-blue-800" />
    </span>
    <span><strong className="block text-lg text-white">CloudRouter</strong><small className="text-blue-100">ISP Management Platform</small></span>
  </span>;
}

export default function LandingPage() {
  return <div className="min-h-screen bg-slate-950 text-white">
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/"><Brand /></Link>
        <nav className="flex items-center gap-2">
          <a href="#features" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-white/10 md:inline-flex">Features</a>
          <a href="#topology" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-white/10 lg:inline-flex">How it works</a>
          <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Sign in</Link>
          <Link to="/register" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-lg">Get Started</Link>
        </nav>
      </div>
    </header>

    <main>
      <section className="relative isolate overflow-hidden pt-24">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.22),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,.25),transparent_35%),linear-gradient(135deg,#06152f_0%,#0a2f6f_52%,#0ea5c7_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-100"><FiZap />Built for WISP & hotspot operators</span>
            <h1 className="mt-7 text-4xl font-black leading-[1.03] text-white sm:text-6xl">Run your hotspot network <span className="block bg-gradient-to-r from-cyan-200 to-blue-100 bg-clip-text text-transparent">like a real ISP.</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">CloudRouter connects MikroTik provisioning, live sessions, network sites, vouchers, payments, reports and decision-support analytics in one professional cloud workspace.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-bold text-blue-700 shadow-2xl transition hover:-translate-y-0.5">Get Started <FiArrowRight /></Link>
              <a href="#topology" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-4 font-bold text-white backdrop-blur hover:bg-white/15"><FiRadio />View network topology</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-4 text-sm text-blue-100">{['14-day free trial', 'Multi-site ready', 'MikroTik focused'].map(x => <span key={x} className="inline-flex items-center gap-2"><FiCheck className="text-cyan-300" />{x}</span>)}</div>
          </div>

          <div id="topology" className="relative scroll-mt-28">
            <div className="absolute -inset-8 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-xl">
              <img src={networkPreview} alt="CloudRouter network topology showing ISP internet, MikroTik router, access point, cloud platform and connected clients" className="w-full rounded-[1.5rem] bg-white object-cover shadow-2xl" />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/20 bg-slate-950/80 p-4 backdrop-blur">
                <div className="flex items-start gap-3"><span className="rounded-xl bg-cyan-400/15 p-2 text-cyan-200"><FiCloud className="text-xl" /></span><div><p className="font-bold text-white">Network topology at a glance</p><p className="mt-1 text-xs leading-5 text-blue-100">Internet → MikroTik gateway → CloudRouter → switches/APs → hotspot users, with live monitoring and site-level reporting.</p></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-white py-20 text-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-600">Purpose-built</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Everything needed to operate and grow a hotspot business</h2><p className="mt-4 text-slate-600">CloudRouter is organized around sites, routers, plans, vouchers, customers, sessions, payments and analytics—not generic POS workflows.</p></div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{features.map(([Icon, title, text]) => <article key={title} className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><span className="inline-flex rounded-2xl bg-blue-600 p-3 text-white"><Icon /></span><h3 className="mt-5 text-xl font-bold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div>
        </div>
      </section>

      <section className="bg-slate-950 py-16">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[['Sites', 'Group branches, communities and remote coverage areas.'], ['Routers', 'Register MikroTik gateways and access points.'], ['Sessions', 'Track live users, uptime and data consumption.'], ['Reports', 'Filter by date, site and router; export PDF/CSV.']].map(([title,text]) => <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-xl font-black text-white">{title}</p><p className="mt-2 text-sm leading-6 text-slate-300">{text}</p></div>)}
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-700 to-cyan-500 py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8"><div><h2 className="text-3xl font-black text-white">Ready to run your hotspot professionally?</h2><p className="mt-2 text-blue-50">Create your workspace, configure your first site and connect a MikroTik router.</p></div><Link to="/register" className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 font-bold text-blue-700 shadow-xl">Get Started <FiArrowRight /></Link></div>
      </section>
    </main>
    <footer className="bg-slate-950 px-4 py-8 text-center text-sm text-slate-400">© {new Date().getFullYear()} CloudRouter · ISP hotspot billing, network management and analytics.</footer>
  </div>;
}
