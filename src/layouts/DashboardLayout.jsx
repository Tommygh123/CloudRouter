import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';

import { useTenant } from '../hooks/useTenant';

function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const { currentTenant } = useTenant();

  const tenantName =
    currentTenant?.business_name ||
    currentTenant?.name ||
    'Your hotspot business';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50">

      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() =>
          setSidebarOpen(false)
        }
        onToggleCollapse={() =>
          setSidebarCollapsed(
            (value) => !value
          )
        }
      />

      <div
        className={[
          'min-h-screen transition-all duration-300',
          sidebarCollapsed
            ? 'lg:pl-24'
            : 'lg:pl-72',
        ].join(' ')}
      >
        <Topbar
          onMenu={() =>
            setSidebarOpen(true)
          }
        />

        <main className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.08),transparent_30%)]">

          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
            <Outlet />
          </div>

        </main>

        <footer className="border-t border-blue-100 bg-white/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">

          <div className="mx-auto flex max-w-[1600px] flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="font-semibold text-slate-600">
                {tenantName}
              </p>

              <p>
                Powered by CloudRouter
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p>
                © {new Date().getFullYear()} CloudRouter
              </p>

              <p>
                MikroTik hotspot billing, analytics and network management
              </p>
            </div>

          </div>

        </footer>
      </div>
    </div>
  );
}

export default DashboardLayout;