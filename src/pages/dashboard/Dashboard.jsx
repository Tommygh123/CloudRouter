import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiActivity,
  FiBarChart2,
  FiCreditCard,
  FiDollarSign,
  FiMapPin,
  FiMonitor,
  FiRadio,
  FiShoppingCart,
  FiTrendingUp,
  FiUsers,
  FiWifi,
} from 'react-icons/fi';

import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { normalizeRoleCode, roleLabel } from '../../config/rolePermissions';

const EMPTY = {
  plans: 0,
  vouchers: 0,
  customers: 0,
  sessions: 0,
  devices: 0,
  orders: 0,
  revenue: 0,
  pending: 0,
  sites: 0,
  onlineRouters: 0,
};

const PAID_STATUSES = new Set([
  'paid',
  'successful',
  'success',
  'completed',
]);

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

async function safeCount(
  table,
  tenantId,
  filters = [],
) {
  try {
    let query = supabase
      .from(table)
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('tenant_id', tenantId);

    for (const filter of filters) {
      query = query.eq(
        filter.column,
        filter.value,
      );
    }

    const { count, error } = await query;

    if (error) {
      console.warn(
        `Dashboard count failed: ${table}`,
        error,
      );

      return {
        value: 0,
        error,
      };
    }

    return {
      value: count || 0,
      error: null,
    };
  } catch (error) {
    console.warn(
      `Dashboard count exception: ${table}`,
      error,
    );

    return {
      value: 0,
      error,
    };
  }
}

async function loadOrders(tenantId) {
  /*
   * Do NOT explicitly select amount + price_amount here.
   *
   * Selecting "*" allows the dashboard to work while
   * CloudRouter is transitioning between older/newer
   * hotspot_orders schemas.
   */
  const { data, error } = await supabase
    .from('hotspot_orders')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error(
      'Dashboard hotspot_orders error:',
      error,
    );

    return {
      rows: [],
      error,
    };
  }

  return {
    rows: data || [],
    error: null,
  };
}


function isRouterDevice(device) {
  const type = String(device?.device_type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['router', 'mikrotik_router', 'routeros', 'gateway'].includes(type) || Boolean(device?.router_identity || device?.identity_name);
}

async function loadRouters(tenantId) {
  const { data, error } = await supabase
    .from('network_devices')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) {
    console.warn(
      'Dashboard router heartbeat error:',
      error,
    );

    return {
      rows: [],
      error,
    };
  }

  return {
    rows: (data || []).filter(isRouterDevice),
    error: null,
  };
}

function getOrderAmount(order) {
  /*
   * Support both possible CloudRouter order schemas.
   * Prefer price_amount when available.
   */
  const value =
    order?.price_amount ??
    order?.amount ??
    order?.total_amount ??
    0;

  const amount = Number(value);

  return Number.isFinite(amount)
    ? amount
    : 0;
}

function getCustomerKey(order) {
  return (
    order?.customer_phone ||
    order?.phone ||
    order?.customer_email ||
    order?.email ||
    order?.customer_name ||
    null
  );
}

export default function Dashboard() {
  const { currentTenant, roleCode } = useTenant();
  const normalizedRole = normalizeRoleCode(roleCode);

  const [stats, setStats] =
    useState(EMPTY);

  const [loading, setLoading] =
    useState(true);

  const [warning, setWarning] =
    useState('');

  async function loadDashboard() {
    if (!currentTenant?.id) {
      setStats(EMPTY);
      setLoading(false);
      return;
    }

    const tenantId = currentTenant.id;

    setLoading(true);
    setWarning('');

    try {
      /*
       * Every counter is isolated.
       *
       * One unavailable table therefore no longer
       * prevents the rest of the dashboard loading.
       */
      const [
        plansResult,
        vouchersResult,
        customersResult,
        sessionsResult,
        devicesResult,
        ordersCountResult,
        sitesResult,
        onlineRoutersResult,
        ordersResult,
        routersResult,
      ] = await Promise.all([
        safeCount(
          'hotspot_plans',
          tenantId,
          [
            {
              column: 'is_active',
              value: true,
            },
          ],
        ),

        safeCount(
          'hotspot_vouchers',
          tenantId,
          [
            {
              column: 'status',
              value: 'available',
            },
          ],
        ),

        safeCount(
          'hotspot_customers',
          tenantId,
        ),

        safeCount(
          'hotspot_active_sessions',
          tenantId,
          [
            {
              column: 'status',
              value: 'online',
            },
          ],
        ),

        safeCount(
          'network_devices',
          tenantId,
          [
            {
              column: 'is_active',
              value: true,
            },
          ],
        ),

        safeCount(
          'hotspot_orders',
          tenantId,
        ),

        safeCount(
          'network_sites',
          tenantId,
          [
            {
              column: 'is_active',
              value: true,
            },
          ],
        ),

        safeCount(
          'network_devices',
          tenantId,
          [
            { column: 'status', value: 'online' },
          ],
        ),

        loadOrders(tenantId),

        loadRouters(tenantId),
      ]);

      const orders =
        ordersResult.rows || [];

      const routers =
        routersResult.rows || [];

      /*
       * Successful/paid orders only contribute
       * to revenue.
       */
      const paidOrders = orders.filter(
        (order) =>
          PAID_STATUSES.has(
            normalize(
              order.payment_status ??
                order.status,
            ),
          ),
      );

      const revenue =
        paidOrders.reduce(
          (total, order) =>
            total +
            getOrderAmount(order),
          0,
        );

      /*
       * Derive customers from successful orders
       * as a fallback.
       *
       * This is useful while hotspot_customers
       * is still being populated.
       */
      const payingCustomers = new Set(
        paidOrders
          .map(getCustomerKey)
          .filter(Boolean),
      ).size;

      /*
       * Router heartbeat gives us the real current
       * active-user count even before every detailed
       * hotspot_active_sessions row is synchronized.
       */
      const routerActiveUsers =
        routers.reduce(
          (total, router) =>
            total +
            Number(
              router.active_hotspot_users ||
                0,
            ),
          0,
        );

      /*
       * Determine online routers from heartbeat
       * information too.
       *
       * This is a fallback in case status has not
       * yet been normalized to "online".
       */
      const heartbeatOnlineRouters =
        routers.filter((router) => {
          if (
            normalize(router.status) ===
            'online'
          ) {
            return true;
          }

          if (!router.last_seen_at) {
            return false;
          }

          const lastSeen =
            new Date(
              router.last_seen_at,
            ).getTime();

          if (
            Number.isNaN(lastSeen)
          ) {
            return false;
          }

          /*
           * Router considered live when heartbeat
           * was received within approximately
           * five minutes.
           */
          return (
            Date.now() - lastSeen <
            5 * 60 * 1000
          );
        }).length;

      const pendingOrders =
        orders.filter(
          (order) =>
            normalize(
              order.payment_status,
            ) === 'pending',
        ).length;

      setStats({
        plans: plansResult.value,

        vouchers:
          vouchersResult.value,

        customers: Math.max(
          customersResult.value,
          payingCustomers,
        ),

        sessions: Math.max(
          sessionsResult.value,
          routerActiveUsers,
        ),

        devices:
          devicesResult.value,

        orders:
          ordersCountResult.value,

        sites:
          sitesResult.value,

        onlineRouters: heartbeatOnlineRouters,

        revenue,

        pending: pendingOrders,
      });

      /*
       * Only show a warning for meaningful failures.
       *
       * Revenue gets its own message because it is
       * financially important.
       */
      if (ordersResult.error) {
        setWarning(
          'Order and revenue records could not be loaded. Network statistics are still available.',
        );
      } else {
        const optionalErrors = [
          plansResult.error,
          vouchersResult.error,
          customersResult.error,
          sessionsResult.error,
          devicesResult.error,
          sitesResult.error,
          onlineRoutersResult.error,
          routersResult.error,
        ].filter(Boolean);

        if (optionalErrors.length) {
          setWarning(
            'Some optional statistics are not available yet. Available live data is shown normally.',
          );
        }
      }
    } catch (error) {
      console.error(
        'Dashboard load error:',
        error,
      );

      setWarning(
        'Some dashboard information could not be loaded. Refresh the page to try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    /*
     * Refresh operational counters periodically.
     */
    const timer =
      window.setInterval(
        loadDashboard,
        30000,
      );

    return () =>
      window.clearInterval(timer);
  }, [currentTenant?.id]);

  const cards = useMemo(() => {
    const allCards = {
      revenue: {
        label: 'Revenue',
        value: `GHS ${stats.revenue.toFixed(2)}`,
        Icon: FiDollarSign,
        tone: 'from-emerald-500 to-teal-500',
      },
      customers: {
        label: 'Customers',
        value: stats.customers,
        Icon: FiUsers,
        tone: 'from-blue-600 to-indigo-500',
      },
      sessions: {
        label: 'Active Sessions',
        value: stats.sessions,
        Icon: FiMonitor,
        tone: 'from-violet-500 to-fuchsia-500',
      },
      routers: {
        label: 'Routers Online',
        value: stats.onlineRouters,
        Icon: FiRadio,
        tone: 'from-cyan-500 to-blue-500',
      },
      vouchers: {
        label: 'Available Vouchers',
        value: stats.vouchers,
        Icon: FiCreditCard,
        tone: 'from-amber-500 to-orange-500',
      },
      plans: {
        label: 'Active Plans',
        value: stats.plans,
        Icon: FiWifi,
        tone: 'from-sky-500 to-cyan-500',
      },
      orders: {
        label: 'Orders',
        value: stats.orders,
        Icon: FiShoppingCart,
        tone: 'from-indigo-500 to-violet-500',
      },
      sites: {
        label: 'Network Sites',
        value: stats.sites,
        Icon: FiMapPin,
        tone: 'from-rose-500 to-pink-500',
      },
    };

    const byRole = {
      owner: ['revenue', 'customers', 'sessions', 'routers', 'vouchers', 'plans', 'orders', 'sites'],
      admin: ['revenue', 'customers', 'sessions', 'routers', 'vouchers', 'plans', 'orders', 'sites'],
      cashier: ['revenue', 'orders', 'vouchers', 'customers', 'sessions'],
      field_technician: ['routers', 'sessions', 'sites', 'plans'],
      viewer: ['revenue', 'customers', 'sessions', 'routers', 'orders', 'sites'],
    };

    return (byRole[normalizedRole] || byRole.viewer).map((key) => allCards[key]);
  }, [stats, normalizedRole]);

  const dashboardCopy = useMemo(() => {
    const copy = {
      owner: {
        eyebrow: 'CloudRouter Owner Control Center',
        description: 'Business performance, commercial activity and network health across your hotspot operation.',
      },
      admin: {
        eyebrow: 'CloudRouter Administration',
        description: 'Manage commercial operations, users, sites and network health from one workspace.',
      },
      cashier: {
        eyebrow: 'Cashier Workspace',
        description: 'Focus on voucher sales, customers, orders, payments and active hotspot users.',
      },
      field_technician: {
        eyebrow: 'Field Technical Workspace',
        description: 'Monitor sites, routers, access points and live hotspot sessions without finance administration.',
      },
      viewer: {
        eyebrow: 'Viewer Dashboard',
        description: 'Read-only operational overview with live sessions, network health, analytics and reports.',
      },
    };

    return copy[normalizedRole] || copy.viewer;
  }, [normalizedRole]);

  const quickActions = useMemo(() => {
    const actions = {
      owner: [
        { to: '/dashboard/hotspot/vouchers', Icon: FiCreditCard, title: 'Sell & manage vouchers', text: 'Generate, print, assign and track voucher stock.', classes: 'border-blue-100 from-blue-50', iconClass: '!text-blue-600', titleClass: '!text-blue-950' },
        { to: '/dashboard/reports', Icon: FiBarChart2, title: 'Filtered reports', text: 'Compare sites and periods, then export the filtered result.', classes: 'border-emerald-100 from-emerald-50', iconClass: '!text-emerald-600', titleClass: '!text-emerald-950' },
        { to: '/dashboard/network/devices', Icon: FiRadio, title: 'Routers & access points', text: 'Register equipment and manage router-specific operations.', classes: 'border-violet-100 from-violet-50', iconClass: '!text-violet-600', titleClass: '!text-violet-950' },
      ],
      admin: [
        { to: '/dashboard/hotspot/vouchers', Icon: FiCreditCard, title: 'Voucher operations', text: 'Generate, print, assign and track voucher stock.', classes: 'border-blue-100 from-blue-50', iconClass: '!text-blue-600', titleClass: '!text-blue-950' },
        { to: '/dashboard/reports', Icon: FiBarChart2, title: 'Business reports', text: 'Review sales, payments and site performance.', classes: 'border-emerald-100 from-emerald-50', iconClass: '!text-emerald-600', titleClass: '!text-emerald-950' },
        { to: '/dashboard/users', Icon: FiUsers, title: 'Manage staff access', text: 'Invite administrators, cashiers, technicians and viewers.', classes: 'border-violet-100 from-violet-50', iconClass: '!text-violet-600', titleClass: '!text-violet-950' },
      ],
      cashier: [
        { to: '/dashboard/hotspot/vouchers', Icon: FiCreditCard, title: 'Sell vouchers', text: 'Create and issue vouchers for customers.', classes: 'border-blue-100 from-blue-50', iconClass: '!text-blue-600', titleClass: '!text-blue-950' },
        { to: '/dashboard/hotspot/orders', Icon: FiShoppingCart, title: 'Orders & payments', text: 'Serve customers and review today’s transactions.', classes: 'border-emerald-100 from-emerald-50', iconClass: '!text-emerald-600', titleClass: '!text-emerald-950' },
        { to: '/dashboard/reports', Icon: FiBarChart2, title: 'Sales reports', text: 'Review permitted sales and transaction reports.', classes: 'border-violet-100 from-violet-50', iconClass: '!text-violet-600', titleClass: '!text-violet-950' },
      ],
      field_technician: [
        { to: '/dashboard/network/monitoring', Icon: FiActivity, title: 'Network monitoring', text: 'Check router availability and synchronization health.', classes: 'border-blue-100 from-blue-50', iconClass: '!text-blue-600', titleClass: '!text-blue-950' },
        { to: '/dashboard/network/devices', Icon: FiRadio, title: 'Routers & APs', text: 'Work with assigned routers and access points.', classes: 'border-emerald-100 from-emerald-50', iconClass: '!text-emerald-600', titleClass: '!text-emerald-950' },
        { to: '/dashboard/network/sessions', Icon: FiMonitor, title: 'Active sessions', text: 'Inspect live users and site activity.', classes: 'border-violet-100 from-violet-50', iconClass: '!text-violet-600', titleClass: '!text-violet-950' },
      ],
      viewer: [
        { to: '/dashboard/analytics', Icon: FiTrendingUp, title: 'View analytics', text: 'Review trends without changing operational data.', classes: 'border-blue-100 from-blue-50', iconClass: '!text-blue-600', titleClass: '!text-blue-950' },
        { to: '/dashboard/reports', Icon: FiBarChart2, title: 'View reports', text: 'Filter and inspect permitted business reports.', classes: 'border-emerald-100 from-emerald-50', iconClass: '!text-emerald-600', titleClass: '!text-emerald-950' },
        { to: '/dashboard/network/monitoring', Icon: FiActivity, title: 'Network health', text: 'Read current router and session status.', classes: 'border-violet-100 from-violet-50', iconClass: '!text-violet-600', titleClass: '!text-violet-950' },
      ],
    };

    return actions[normalizedRole] || actions.viewer;
  }, [normalizedRole]);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl shadow-blue-200/60 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.18em] text-blue-100">
              {dashboardCopy.eyebrow}
            </p>

            <h1 className="mt-2 text-3xl font-black !text-white sm:text-4xl">
              {currentTenant?.business_name ||
                currentTenant?.name ||
                'Your hotspot business'}
            </h1>

            <div className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.14em] text-blue-50">
              {roleLabel(normalizedRole)}
            </div>

            <p className="mt-2 max-w-2xl !text-blue-50">
              {dashboardCopy.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {(normalizedRole === 'owner' || normalizedRole === 'admin' || normalizedRole === 'viewer') && (
              <Link
                to="/dashboard/analytics"
                className="inline-flex items-center gap-2 rounded-2xl border border-white bg-white px-5 py-3 text-sm font-extrabold shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
                style={{ color: '#1d4ed8' }}
              >
                <FiTrendingUp style={{ color: '#1d4ed8' }} />
                <span style={{ color: '#1d4ed8' }}>Open Analytics</span>
              </Link>
            )}

            {(normalizedRole !== 'cashier') && (
              <Link
                to="/dashboard/network/monitoring"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold !text-white backdrop-blur transition hover:bg-white/20"
              >
                <FiActivity />
                <span className="!text-white">Network Health</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* WARNING */}
      {warning && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {warning}
        </div>
      )}

      {/* KPI CARDS */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(
          ({
            label,
            value,
            Icon,
            tone,
          }) => (
            <article
              key={label}
              className="group overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                className={`h-1.5 bg-gradient-to-r ${tone}`}
              />

              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold !text-slate-600">
                    {label}
                  </p>

                  <span
                    className={`rounded-xl bg-gradient-to-br ${tone} p-2.5 text-white shadow-md`}
                  >
                    <Icon />
                  </span>
                </div>

                <p className="mt-5 text-3xl font-black !text-slate-900">
                  {loading
                    ? '—'
                    : typeof value ===
                        'number'
                      ? value.toLocaleString()
                      : value}
                </p>
              </div>
            </article>
          ),
        )}
      </section>

      {/* ROLE-SPECIFIC QUICK ACTIONS */}
      <section className="grid gap-4 lg:grid-cols-3">
        {quickActions.map(({ to, Icon, title, text, classes, iconClass, titleClass }) => (
          <Link
            key={to + title}
            to={to}
            className={`rounded-3xl border bg-gradient-to-br ${classes} to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <Icon className={`text-2xl ${iconClass}`} />
            <h3 className={`mt-4 text-lg font-bold ${titleClass}`}>{title}</h3>
            <p className="mt-2 text-sm !text-slate-600">{text}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}