import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiCreditCard, FiMapPin, FiRadio, FiWifi } from 'react-icons/fi';

const steps = [
  { n: '01', title: 'Business profile', text: 'Confirm your hotspot/WISP business identity, contact details and branding.', path: '/onboarding/business', Icon: FiCheckCircle },
  { n: '02', title: 'Create a network site', text: 'Add the community, branch or coverage area where customers will connect.', path: '/dashboard/network/sites', Icon: FiMapPin },
  { n: '03', title: 'Register router or AP', text: 'Register the MikroTik gateway, generate its tenant-specific script and confirm it reports online.', path: '/dashboard/network/devices', Icon: FiRadio },
  { n: '04', title: 'Review internet plans', text: 'Edit starter plans, prices, data limits, validity and MikroTik profile names.', path: '/dashboard/hotspot/plans', Icon: FiWifi },
  { n: '05', title: 'Test customer purchase', text: 'Use the public purchase flow to verify payment, provisioning and active-session synchronization.', path: '/buy-plan', Icon: FiCreditCard },
];

export default function GetStarted() {
  return <div className="space-y-7">
    <section className="overflow-hidden rounded-[2rem] bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-7 text-white shadow-xl sm:p-9">
      <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-100">CloudRouter setup assistant</p>
      <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">Get your hotspot ready for customers</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50 sm:text-base">Complete the five operational steps below. You can return here anytime—the page remains visible in the sidebar as your setup and expansion checklist.</p>
    </section>
    <div className="grid gap-4 xl:grid-cols-2">
      {steps.map(({ n, title, text, path, Icon }) => <Link key={n} to={path} className="group flex items-start gap-4 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 font-black text-blue-700">{n}</span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Icon className="text-blue-600" /><h2 className="font-black text-slate-900">{title}</h2></div><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">Open step <FiArrowRight className="transition group-hover:translate-x-1" /></span></div>
      </Link>)}
    </div>
  </div>;
}
