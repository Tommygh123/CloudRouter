import { Link } from 'react-router-dom';

import {
  FiActivity,
  FiArrowRight,
  FiBarChart2,
  FiCheck,
  FiCloud,
  FiCreditCard,
  FiMapPin,
  FiRadio,
  FiShield,
  FiUsers,
  FiWifi,
  FiZap,
} from 'react-icons/fi';

import heroImage from '../../assets/cloudrouter.png';


const features = [
  {
    icon: FiWifi,
    title: 'Hotspot billing',
    text:
      'Create time and data plans for MikroTik hotspots with automated customer access and provisioning.',
  },
  {
    icon: FiCreditCard,
    title: 'Payments & vouchers',
    text:
      'Sell vouchers, record payments, support vendor distribution and prepare for online and mobile-money collections.',
  },
  {
    icon: FiActivity,
    title: 'Live network monitoring',
    text:
      'Monitor router availability, active hotspot sessions, WAN health and network activity from one workspace.',
  },
  {
    icon: FiMapPin,
    title: 'Multi-site operations',
    text:
      'Manage branches, communities and hotspot locations under one business account.',
  },
  {
    icon: FiBarChart2,
    title: 'Analytics & reports',
    text:
      'Analyse revenue, customers, sessions, plan performance and network activity using date and site filters.',
  },
  {
    icon: FiShield,
    title: 'Secure role-based access',
    text:
      'Give owners, administrators, cashiers, field technicians and viewers the tools appropriate to their roles.',
  },
];


const steps = [
  {
    number: '01',
    icon: FiUsers,
    title: 'Create your workspace',
    text:
      'Register your ISP or hotspot business and configure your CloudRouter workspace.',
  },
  {
    number: '02',
    icon: FiMapPin,
    title: 'Create network sites',
    text:
      'Add branches, communities, campuses or other areas where you provide internet service.',
  },
  {
    number: '03',
    icon: FiRadio,
    title: 'Connect MikroTik',
    text:
      'Register your MikroTik router and connect it securely to CloudRouter.',
  },
  {
    number: '04',
    icon: FiZap,
    title: 'Start selling access',
    text:
      'Create plans and vouchers, connect customers and monitor live sessions and revenue.',
  },
];


function Brand() {
  return (
    <span className="flex items-center gap-3">
      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-950/30 ring-1 ring-white/20">
        <FiCloud className="text-xl text-white" />

        <FiWifi className="absolute -bottom-1 -right-1 rounded-full bg-cyan-300 p-1 text-blue-950" />
      </span>

      <span>
        <strong className="block text-lg leading-tight text-white">
          CloudRouter
        </strong>

        <small className="text-xs text-blue-200">
          ISP Management Platform
        </small>
      </span>
    </span>
  );
}


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[84px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          <Link
            to="/"
            className="shrink-0"
          >
            <Brand />
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">

            <a
              href="#features"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white md:inline-flex"
            >
              Features
            </a>

            <a
              href="#how-it-works"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white lg:inline-flex"
            >
              How it works
            </a>

            <Link
              to="/login"
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:px-4"
            >
              Sign in
            </Link>

            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 sm:px-5"
            >
              <span className="hidden sm:inline">
                Get Started
              </span>

              <span className="sm:hidden">
                Start
              </span>

              <FiArrowRight />
            </Link>

          </nav>
        </div>
      </header>


      <main>

        {/* =====================================================
            HERO
        ====================================================== */}

        <section className="relative isolate min-h-[760px] overflow-hidden pt-[84px]">

          {/* Background image */}
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-30 h-full w-full object-cover object-center brightness-[0.95] saturate-[1.08] contrast-[1.03]"
          />

          {/* Gentle global overlay */}
          <div className="absolute inset-0 -z-20 bg-slate-950/15" />

          {/*
            Stronger shading on left where text appears.
            Image becomes progressively brighter toward the right.
          */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/48 to-slate-950/5" />

          {/* Header transition */}
          <div className="absolute inset-x-0 top-0 -z-10 h-36 bg-gradient-to-b from-slate-950/45 to-transparent" />

          {/* Bottom transition */}
          <div className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />


          <div className="mx-auto flex min-h-[676px] max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">

            <div className="max-w-3xl">

              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-slate-950/35 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-lg backdrop-blur-md">
                <FiZap className="text-cyan-300" />

                Cloud management for WISPs & ISPs
              </span>


              <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[1.02] tracking-tight text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.65)] sm:text-6xl lg:text-7xl">

                Run your internet

                <span className="block">
                  network like a
                </span>

                <span className="block bg-gradient-to-r from-cyan-300 via-blue-200 to-white bg-clip-text text-transparent">
                  professional ISP.
                </span>

              </h1>


              <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-slate-100 drop-shadow-md sm:text-xl">
                CloudRouter brings MikroTik provisioning,
                hotspot billing, vouchers, customers, network
                monitoring, payments and analytics into one
                secure cloud platform.
              </p>


              <div className="mt-9 flex flex-col gap-3 sm:flex-row">

                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 py-4 text-base font-bold text-white shadow-2xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500"
                >
                  Get Started Free

                  <FiArrowRight />
                </Link>


                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-slate-950/30 px-7 py-4 text-base font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/15"
                >
                  <FiRadio />

                  See how it works
                </a>

              </div>


              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-100">

                {[
                  '14-day free trial',
                  'MikroTik focused',
                  'Multi-site ready',
                  'Role-based access',
                ].map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/20 backdrop-blur">
                      <FiCheck className="text-xs text-cyan-300" />
                    </span>

                    {item}
                  </span>
                ))}

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            QUICK VALUE STRIP
        ====================================================== */}

        <section className="border-y border-white/10 bg-slate-950">

          <div className="mx-auto grid max-w-7xl gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">

            {[
              [
                'Sites',
                'Manage branches and coverage areas.',
              ],
              [
                'Routers',
                'Connect MikroTik network gateways.',
              ],
              [
                'Sessions',
                'See connected hotspot users live.',
              ],
              [
                'Reports',
                'Analyse network and business performance.',
              ],
            ].map(([title, text]) => (
              <div
                key={title}
                className="bg-slate-950 px-6 py-8"
              >
                <p className="text-lg font-black text-white">
                  {title}
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {text}
                </p>
              </div>
            ))}

          </div>

        </section>


        {/* =====================================================
            FEATURES
        ====================================================== */}

        <section
          id="features"
          className="scroll-mt-24 bg-white py-24 text-slate-900"
        >

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <div className="mx-auto max-w-3xl text-center">

              <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600">
                One ISP workspace
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Everything needed to operate your hotspot network
              </h2>

              <p className="mt-5 text-lg leading-8 text-slate-600">
                CloudRouter is built around the actual workflow
                of an ISP or hotspot operator: sites, routers,
                internet plans, customers, vouchers, sessions,
                payments and reports.
              </p>

            </div>


            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

              {features.map(
                ({
                  icon: Icon,
                  title,
                  text,
                }) => (
                  <article
                    key={title}
                    className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                  >

                    <span className="inline-flex rounded-2xl bg-blue-50 p-3.5 text-xl text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                      <Icon />
                    </span>

                    <h3 className="mt-6 text-xl font-bold text-slate-950">
                      {title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {text}
                    </p>

                  </article>
                ),
              )}

            </div>

          </div>

        </section>


        {/* =====================================================
            HOW IT WORKS
        ====================================================== */}

        <section
          id="how-it-works"
          className="scroll-mt-24 bg-slate-50 py-24 text-slate-900"
        >

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <div className="max-w-3xl">

              <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600">
                How CloudRouter works
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                From MikroTik router to cloud management
              </h2>

              <p className="mt-5 text-lg leading-8 text-slate-600">
                Start with one hotspot and grow into multiple
                sites without changing the management platform.
              </p>

            </div>


            <div className="relative mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">

              {steps.map(
                ({
                  number,
                  icon: Icon,
                  title,
                  text,
                }) => (
                  <article
                    key={number}
                    className="relative rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >

                    <div className="flex items-center justify-between">

                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white shadow-lg shadow-blue-200">
                        <Icon />
                      </span>

                      <span className="text-4xl font-black text-slate-100">
                        {number}
                      </span>

                    </div>


                    <h3 className="mt-6 text-lg font-bold text-slate-950">
                      {title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {text}
                    </p>

                  </article>
                ),
              )}

            </div>

          </div>

        </section>


        {/* =====================================================
            CLOUD / NETWORK EXPLANATION
        ====================================================== */}

        <section className="overflow-hidden bg-slate-950 py-24">

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">

            <div>

              <span className="inline-flex rounded-2xl bg-cyan-400/10 p-4 text-2xl text-cyan-300">
                <FiCloud />
              </span>


              <p className="mt-6 text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">
                Central cloud control
              </p>


              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
                Your network and business data in one place
              </h2>


              <p className="mt-6 text-lg leading-8 text-slate-300">
                CloudRouter connects your physical ISP
                infrastructure with your business operations,
                giving authorised staff a common view of
                customers, access plans, sessions, sites,
                routers and revenue.
              </p>


              <div className="mt-8 space-y-4">

                {[
                  'Cloud-based multi-tenant workspace',
                  'MikroTik router integration',
                  'Role-based staff dashboards',
                  'Live hotspot session synchronization',
                  'Site and router monitoring',
                  'Business and network reporting',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-slate-200"
                  >

                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/10">
                      <FiCheck className="text-cyan-300" />
                    </span>

                    <span>
                      {item}
                    </span>

                  </div>
                ))}

              </div>

            </div>


            <div className="relative">

              <div className="absolute -inset-8 rounded-full bg-blue-600/20 blur-3xl" />


              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl">

                <img
                  src={heroImage}
                  alt="CloudRouter cloud ISP and WISP network management platform"
                  className="aspect-[4/3] w-full object-cover brightness-[1.05] saturate-[1.05]"
                />


                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent px-6 pb-6 pt-20">

                  <p className="font-bold text-white">
                    Internet → MikroTik → CloudRouter → Sites & Users
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Central monitoring and management across
                    your distributed network.
                  </p>

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            FINAL CTA
        ====================================================== */}

        <section className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 py-20">

          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">

            <div className="max-w-3xl">

              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-100">
                Start with CloudRouter
              </p>

              <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
                Ready to run your hotspot professionally?
              </h2>

              <p className="mt-3 text-lg text-blue-50">
                Create your workspace, configure your first
                network site and connect your MikroTik router.
              </p>

            </div>


            <Link
              to="/register"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-blue-700 shadow-2xl transition hover:-translate-y-0.5 hover:bg-blue-50"
            >
              Get Started Free

              <FiArrowRight />
            </Link>

          </div>

        </section>

      </main>


      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer className="border-t border-white/10 bg-slate-950">

        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">

          <Brand />


          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">

            <a
              href="#features"
              className="transition hover:text-white"
            >
              Features
            </a>

            <a
              href="#how-it-works"
              className="transition hover:text-white"
            >
              How it works
            </a>

            <Link
              to="/login"
              className="transition hover:text-white"
            >
              Sign in
            </Link>

            <Link
              to="/register"
              className="transition hover:text-white"
            >
              Get Started
            </Link>

          </div>

        </div>


        <div className="border-t border-white/10 px-4 py-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} CloudRouter · ISP hotspot
          billing, network management and analytics.
        </div>

      </footer>

    </div>
  );
}