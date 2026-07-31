import {
  FiActivity,
  FiBarChart2,
  FiChevronLeft,
  FiChevronRight,
  FiCreditCard,
  FiHome,
  FiMapPin,
  FiMonitor,
  FiRadio,
  FiSettings,
  FiShoppingCart,
  FiTrendingUp,
  FiUserPlus,
  FiUsers,
  FiWifi,
  FiX,
} from 'react-icons/fi';
import { NavLink } from 'react-router-dom';

const menuSections = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: FiHome },
    ],
  },
  {
    title: 'Hotspot Business',
    items: [
      {
        label: 'Internet Plans',
        path: '/dashboard/hotspot/plans',
        icon: FiWifi,
      },
      {
        label: 'Vouchers',
        path: '/dashboard/hotspot/vouchers',
        icon: FiCreditCard,
      },
      {
        label: 'Customers',
        path: '/dashboard/hotspot/customers',
        icon: FiUsers,
      },
      {
        label: 'Orders & Payments',
        path: '/dashboard/hotspot/orders',
        icon: FiShoppingCart,
      },
    ],
  },
  {
    title: 'Network',
    items: [
      {
        label: 'Network Sites',
        path: '/dashboard/network/sites',
        icon: FiMapPin,
      },
      {
        label: 'Routers & APs',
        path: '/dashboard/network/devices',
        icon: FiRadio,
      },
      {
        label: 'Active Sessions',
        path: '/dashboard/network/sessions',
        icon: FiMonitor,
      },
      {
        label: 'Monitoring',
        path: '/dashboard/network/monitoring',
        icon: FiActivity,
      },
    ],
  },
  {
    title: 'Management',
    items: [
      {
        label: 'Analytics',
        path: '/dashboard/analytics',
        icon: FiTrendingUp,
      },
      {
        label: 'Reports',
        path: '/dashboard/reports',
        icon: FiBarChart2,
      },
      {
        label: 'User Management',
        path: '/dashboard/users',
        icon: FiUserPlus,
      },
      {
        label: 'Settings',
        path: '/dashboard/settings',
        icon: FiSettings,
      },
    ],
  },
];

function Sidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
}) {
  function handleMobileNavigation() {
    if (window.innerWidth < 1024) {
      onClose?.();
    }
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col',
          'bg-slate-950 text-white shadow-2xl',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'lg:w-24' : 'lg:w-72',
          open
            ? 'w-72 translate-x-0'
            : 'w-72 -translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <NavLink
            to="/dashboard"
            onClick={handleMobileNavigation}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 font-bold text-white">
              CR
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-white">
                  CloudRouter
                </p>

                <p className="truncate text-xs text-slate-400">
                  Hotspot Control Center
                </p>
              </div>
            )}
          </NavLink>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {menuSections.map((section) => (
            <div key={section.title} className="mb-6">
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/dashboard'}
                      onClick={handleMobileNavigation}
                      className={({ isActive }) =>
                        [
                          'group flex min-h-11 items-center rounded-xl px-3',
                          'text-sm font-medium transition-colors',
                          collapsed
                            ? 'justify-center'
                            : 'justify-start gap-3',
                          isActive
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white',
                        ].join(' ')
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0" />

                      {!collapsed && (
                        <span className="truncate">
                          {item.label}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={[
              'hidden w-full items-center rounded-xl bg-white/5 px-3 py-3',
              'text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white lg:flex',
              collapsed
                ? 'justify-center'
                : 'justify-start gap-3',
            ].join(' ')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : undefined}
          >
            {collapsed ? (
              <FiChevronRight className="h-5 w-5" />
            ) : (
              <>
                <FiChevronLeft className="h-5 w-5" />
                <span>Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
