import { Link } from 'react-router-dom';

import {
  FiChevronRight,
  FiCreditCard,
  FiGlobe,
  FiImage,
  FiMapPin,
  FiPrinter,
  FiSettings,
  FiShield,
  FiUsers,
  FiWifi,
} from 'react-icons/fi';

const settingsSections = [
  {
    title: 'Business & Branding',
    description:
      'Manage your business identity, contact information and tenant logo.',
    path: '/dashboard/settings/profile',
    icon: FiImage,
  },

  {
    title: 'Captive Portal',
    description:
      'Configure the customer hotspot login page, branding and portal behaviour.',
    path: '/dashboard/settings/captive-portal',
    icon: FiGlobe,
  },

  {
    title: 'Payments',
    description:
      'Manage payment configuration, currency and online payment options.',
    path: '/dashboard/settings/payments',
    icon: FiCreditCard,
  },

  {
    title: 'Voucher Settings',
    description:
      'Configure voucher generation, printing and customer-facing branding.',
    path: '/dashboard/settings/vouchers',
    icon: FiPrinter,
  },

  {
    title: 'Internet Plans',
    description:
      'Manage package prices, data allowances, validity and MikroTik profiles.',
    path: '/dashboard/hotspot/plans',
    icon: FiWifi,
  },

  {
    title: 'Network Sites',
    description:
      'Manage business locations and the network infrastructure assigned to them.',
    path: '/dashboard/network/sites',
    icon: FiMapPin,
  },

  {
    title: 'User Management',
    description:
      'Manage staff accounts, roles and access to CloudRouter.',
    path: '/dashboard/users',
    icon: FiUsers,
  },

  {
    title: 'Security & Account',
    description:
      'Manage your account profile and security-related settings.',
    path: '/dashboard/settings/account',
    icon: FiShield,
  },
];

export default function Settings() {
  return (
    <div className="space-y-8">

      {/* PAGE HEADER */}

      <div>
        <div className="flex items-center gap-2 text-blue-600">
          <FiSettings className="h-4 w-4" />

          <p className="text-sm font-semibold uppercase tracking-[.18em]">
            CloudRouter
          </p>
        </div>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Settings
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Configure your business branding, captive portal,
          payments, vouchers, network and account settings.
        </p>
      </div>

      {/* SETTINGS CARDS */}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {settingsSections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.path}
              to={section.path}
              className="
                group rounded-3xl border border-slate-200
                bg-white p-6 shadow-sm
                transition-all duration-200
                hover:-translate-y-1
                hover:border-blue-300
                hover:shadow-lg
              "
            >
              <div className="flex items-start justify-between gap-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Icon className="h-6 w-6" />
                </div>

                <FiChevronRight
                  className="
                    h-5 w-5 text-slate-300
                    transition-transform
                    group-hover:translate-x-1
                    group-hover:text-blue-600
                  "
                />
              </div>

              <h2 className="mt-5 text-lg font-bold text-slate-900">
                {section.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {section.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* PLATFORM INFORMATION */}

      <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-6">
        <div className="flex items-center gap-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <span className="font-black text-blue-600">
              CR
            </span>
          </div>

          <div>
            <p className="font-bold text-slate-900">
              CloudRouter
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Hotspot Business & Network Management Platform
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}