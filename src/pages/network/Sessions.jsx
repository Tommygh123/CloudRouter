import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FiMonitor,
  FiRefreshCw,
  FiServer,
  FiWifi,
} from 'react-icons/fi';

import { useTenant } from '../../hooks/useTenant';

import {
  getActiveSessions,
  getDevices,
  getSites,
} from '../../services/operationsService';

import {
  PageHeader,
  SiteBadge,
  StatCard,
  StatusBadge,
} from '../../components/operations/OperationsUI';

function fmtBytes(value) {
  const n = Number(value || 0);

  if (!n) {
    return '0 B';
  }

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ];

  let amount = n;
  let index = 0;

  while (
    amount >= 1024 &&
    index < units.length - 1
  ) {
    amount /= 1024;
    index += 1;
  }

  return `${
    amount >= 10
      ? amount.toFixed(0)
      : amount.toFixed(1)
  } ${units[index]}`;
}

function fmtDuration(seconds) {
  const n = Math.max(
    0,
    Number(seconds || 0),
  );

  const days = Math.floor(
    n / 86400,
  );

  const hours = Math.floor(
    (n % 86400) / 3600,
  );

  const minutes = Math.floor(
    (n % 3600) / 60,
  );

  const secs = Math.floor(
    n % 60,
  );

  return (
    [
      days ? `${days}d` : null,
      hours ? `${hours}h` : null,
      minutes ? `${minutes}m` : null,
      !days && !hours
        ? `${secs}s`
        : null,
    ]
      .filter(Boolean)
      .join(' ') || '0s'
  );
}

function fmtTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? '—'
    : date.toLocaleString();
}

function normalizeDeviceType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isRouterDevice(device) {
  const type =
    normalizeDeviceType(
      device?.device_type,
    );

  return [
    'router',
    'mikrotik_router',
    'routeros',
    'gateway',
    'gateway_router',
  ].includes(type);
}

function isLiveSession(session) {
  return (
    String(
      session?.status || '',
    )
      .trim()
      .toLowerCase() ===
    'online'
  );
}

export default function Sessions() {
  const { tenantId } =
    useTenant();

  const [sessions, setSessions] =
    useState([]);

  const [devices, setDevices] =
    useState([]);

  const [sites, setSites] =
    useState([]);

  const [siteId, setSiteId] =
    useState('all');

  const [routerId, setRouterId] =
    useState('all');

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  async function load() {
    if (!tenantId) {
      setSessions([]);
      setDevices([]);
      setSites([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [
        sessionRows,
        deviceRows,
        siteRows,
      ] = await Promise.all([
        getActiveSessions(
          tenantId,
        ),

        getDevices(
          tenantId,
        ),

        getSites(
          tenantId,
        ),
      ]);

      setSessions(
        Array.isArray(
          sessionRows,
        )
          ? sessionRows
          : [],
      );

      setDevices(
        Array.isArray(
          deviceRows,
        )
          ? deviceRows
          : [],
      );

      setSites(
        Array.isArray(
          siteRows,
        )
          ? siteRows
          : [],
      );
    } catch (loadError) {
      console.error(
        'Active sessions load error:',
        loadError,
      );

      setError(
        loadError?.message ||
          'Unable to load active hotspot sessions.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const timer =
      window.setInterval(
        load,
        30000,
      );

    return () =>
      window.clearInterval(
        timer,
      );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const routers = useMemo(
    () =>
      devices.filter(
        isRouterDevice,
      ),
    [devices],
  );

  const routerMap = useMemo(
    () =>
      new Map(
        routers.map((router) => [
          router.id,
          router,
        ]),
      ),
    [routers],
  );

  const onlineSessions =
    useMemo(
      () =>
        sessions.filter(
          isLiveSession,
        ),
      [sessions],
    );

  const routersForSelectedSite =
    useMemo(
      () =>
        routers.filter(
          (router) =>
            siteId === 'all' ||
            String(
              router.site_id,
            ) ===
              String(siteId),
        ),
      [routers, siteId],
    );

  useEffect(() => {
    if (
      routerId !== 'all' &&
      !routersForSelectedSite.some(
        (router) =>
          String(router.id) ===
          String(routerId),
      )
    ) {
      setRouterId('all');
    }
  }, [
    routerId,
    routersForSelectedSite,
  ]);

  const filtered =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return onlineSessions.filter(
        (session) => {
          const router =
            routerMap.get(
              session.network_device_id,
            );

          const resolvedSiteId =
            session.site_id ||
            router?.site_id ||
            null;

          const matchesSite =
            siteId === 'all' ||
            String(
              resolvedSiteId,
            ) ===
              String(siteId);

          const matchesRouter =
            routerId === 'all' ||
            String(
              session.network_device_id,
            ) ===
              String(routerId);

          const searchText = [
            session.username,
            session.ip_address,
            session.mac_address,
            session.login_method,
            router?.name,
            router?.router_identity,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return (
            matchesSite &&
            matchesRouter &&
            (!query ||
              searchText.includes(
                query,
              ))
          );
        },
      );
    }, [
      onlineSessions,
      routerMap,
      siteId,
      routerId,
      search,
    ]);

  const uniqueUsers =
    useMemo(
      () =>
        new Set(
          filtered
            .map(
              (session) =>
                session.username,
            )
            .filter(Boolean),
        ).size,
      [filtered],
    );

  const activeRouterCount =
    useMemo(
      () =>
        new Set(
          filtered
            .map(
              (session) =>
                session.network_device_id,
            )
            .filter(Boolean),
        ).size,
      [filtered],
    );

  const totalTraffic =
    useMemo(
      () =>
        filtered.reduce(
          (total, session) => {
            const bytes =
              Number(
                session.total_bytes ||
                  0,
              );

            return (
              total + bytes
            );
          },
          0,
        ),
      [filtered],
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="Active Sessions"
        description="Live hotspot sessions synchronized from connected routers with site and router filtering."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active sessions"
          value={
            filtered.length
          }
        />

        <StatCard
          label="Unique users"
          value={
            uniqueUsers
          }
        />

        <StatCard
          label="Routers in use"
          value={
            activeRouterCount
          }
        />

        <StatCard
          label="Live traffic"
          value={fmtBytes(
            totalTraffic,
          )}
        />
      </div>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search username, IP, MAC or router"
            className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <select
            value={siteId}
            onChange={(event) =>
              setSiteId(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">
              All sites
            </option>

            {sites.map(
              (site) => (
                <option
                  key={
                    site.id
                  }
                  value={
                    site.id
                  }
                >
                  {
                    site.name
                  }
                </option>
              ),
            )}
          </select>

          <select
            value={routerId}
            onChange={(event) =>
              setRouterId(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">
              All routers
            </option>

            {routersForSelectedSite.map(
              (router) => (
                <option
                  key={
                    router.id
                  }
                  value={
                    router.id
                  }
                >
                  {
                    router.name
                  }
                </option>
              ),
            )}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-gradient-to-r from-blue-50 to-cyan-50">
              <tr>
                {[
                  'User',
                  'Site',
                  'Router',
                  'IP / MAC',
                  'Login',
                  'Uptime',
                  'Traffic',
                  'Last seen',
                  'Status',
                ].map(
                  (heading) => (
                    <th
                      key={
                        heading
                      }
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                    >
                      {
                        heading
                      }
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="p-12 text-center text-slate-500"
                  >
                    Loading live sessions…
                  </td>
                </tr>
              ) : filtered.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="p-12 text-center text-slate-500"
                  >
                    <FiMonitor className="mx-auto mb-3 text-3xl text-blue-500" />

                    No active sessions match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map(
                  (session) => {
                    const router =
                      routerMap.get(
                        session.network_device_id,
                      );

                    const resolvedSiteId =
                      session.site_id ||
                      router?.site_id;

                    return (
                      <tr
                        key={
                          session.id
                        }
                        className="hover:bg-blue-50/30"
                      >
                        <td className="px-4 py-4 font-bold text-slate-900">
                          {session.username ||
                            '—'}
                        </td>

                        <td className="px-4 py-4">
                          <SiteBadge
                            siteId={
                              resolvedSiteId
                            }
                            sites={
                              sites
                            }
                          />
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700">
                          <span className="inline-flex items-center gap-2">
                            <FiServer className="text-blue-500" />

                            {router?.name ||
                              'Unknown router'}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700">
                          <div>
                            {session.ip_address ||
                              '—'}
                          </div>

                          <div className="text-xs text-slate-400">
                            {session.mac_address ||
                              '—'}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700">
                          {session.login_method ||
                            '—'}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700">
                          {fmtDuration(
                            session.session_seconds,
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                          {fmtBytes(
                            session.total_bytes,
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {fmtTime(
                            session.last_seen_at,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            value={
                              session.status
                            }
                          />
                        </td>
                      </tr>
                    );
                  },
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-sm">
        <div className="flex gap-3">
          <FiWifi className="mt-1 text-xl text-cyan-600" />

          <div>
            <h3 className="font-bold text-slate-900">
              Live hotspot activity
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Session information refreshes automatically every 30 seconds from connected network routers.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}