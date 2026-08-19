import { useEffect, useMemo, useState } from 'react';
import {
  FiAlertTriangle,
  FiClock,
  FiCpu,
  FiHardDrive,
  FiRefreshCw,
  FiUsers,
  FiWifi,
} from 'react-icons/fi';

import { useTenant } from '../../hooks/useTenant';

import {
  getActiveSessions,
  getDevices,
  getProvisioningJobs,
  getSites,
} from '../../services/operationsService';

import {
  PageHeader,
  SiteBadge,
  StatCard,
  StatusBadge,
} from '../../components/operations/OperationsUI';

/**
 * Router heartbeat interval is expected to be short.
 * If a router has not reported for more than 2 minutes,
 * Monitoring treats it as offline.
 */
const ROUTER_ONLINE_WINDOW_MS = 2 * 60 * 1000;

function normalizeDeviceType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isRouterDevice(device) {
  const type = normalizeDeviceType(device?.device_type);

  return [
    'router',
    'mikrotik_router',
    'routeros',
    'gateway',
  ].includes(type);
}

function formatUptime(seconds) {
  const n = Number(seconds || 0);

  if (!n) {
    return '—';
  }

  const days = Math.floor(n / 86400);
  const hours = Math.floor((n % 86400) / 3600);
  const minutes = Math.floor((n % 3600) / 60);

  return [
    days ? `${days}d` : null,
    hours ? `${hours}h` : null,
    `${minutes}m`,
  ]
    .filter(Boolean)
    .join(' ');
}

function lastContact(value) {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }

  const difference = Math.max(
    0,
    Date.now() - date.getTime(),
  );

  const minutes = Math.floor(
    difference / 60000,
  );

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(
    minutes / 60,
  );

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  return date.toLocaleString();
}

/**
 * A router is online only when its telemetry is fresh.
 *
 * We deliberately do NOT trust a permanently stored
 * status="online" when last_seen_at is old.
 */
function isRouterOnline(router) {
  if (!router?.last_seen_at) {
    return false;
  }

  const timestamp = new Date(
    router.last_seen_at,
  ).getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return (
    Date.now() - timestamp <
    ROUTER_ONLINE_WINDOW_MS
  );
}

function isWanOnline(router) {
  return (
    String(router?.wan_status || '')
      .trim()
      .toLowerCase() === 'online'
  );
}

export default function Monitoring() {
  const { tenantId } = useTenant();

  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [jobs, setJobs] = useState([]);

  const [siteId, setSiteId] =
    useState('all');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  async function load() {
    if (!tenantId) {
      setDevices([]);
      setSites([]);
      setSessions([]);
      setJobs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [
        deviceRows,
        siteRows,
        sessionRows,
        jobRows,
      ] = await Promise.all([
        getDevices(tenantId),
        getSites(tenantId),
        getActiveSessions(tenantId),
        getProvisioningJobs(tenantId),
      ]);

      setDevices(
        Array.isArray(deviceRows)
          ? deviceRows
          : [],
      );

      setSites(
        Array.isArray(siteRows)
          ? siteRows
          : [],
      );

      setSessions(
        Array.isArray(sessionRows)
          ? sessionRows
          : [],
      );

      setJobs(
        Array.isArray(jobRows)
          ? jobRows
          : [],
      );
    } catch (loadError) {
      console.error(
        'Could not load monitoring data:',
        loadError,
      );

      setError(
        loadError?.message ||
          'Could not load monitoring data.',
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

    return () => {
      window.clearInterval(timer);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  /**
   * IMPORTANT:
   * Only actual router device types appear here.
   *
   * Access points such as the mANTBox are excluded even
   * though they may themselves run RouterOS and have an
   * identity_name/router_identity.
   */
  const routers = useMemo(() => {
    return devices.filter((device) => {
      if (!isRouterDevice(device)) {
        return false;
      }

      if (siteId === 'all') {
        return true;
      }

      return (
        String(device.site_id) ===
        String(siteId)
      );
    });
  }, [devices, siteId]);

  const activeSessions =
    useMemo(() => {
      return sessions.filter(
        (session) => {
          const online =
            String(
              session.status || '',
            ).toLowerCase() ===
            'online';

          if (!online) {
            return false;
          }

          if (siteId === 'all') {
            return true;
          }

          return (
            String(session.site_id) ===
            String(siteId)
          );
        },
      );
    }, [sessions, siteId]);

  const onlineRouters =
    useMemo(
      () =>
        routers.filter(
          isRouterOnline,
        ),
      [routers],
    );

  const wanOnlineRouters =
    useMemo(
      () =>
        routers.filter((router) => {
          return (
            isRouterOnline(router) &&
            isWanOnline(router)
          );
        }),
      [routers],
    );

  const failedJobs =
    useMemo(() => {
      return jobs.filter((job) => {
        const failed =
          String(
            job.status || '',
          ).toLowerCase() ===
          'failed';

        if (!failed) {
          return false;
        }

        if (siteId === 'all') {
          return true;
        }

        return (
          String(job.site_id) ===
          String(siteId)
        );
      });
    }, [jobs, siteId]);

  /**
   * Use the newest valid router heartbeat.
   */
  const lastPoll =
    useMemo(() => {
      const timestamps =
        routers
          .map(
            (router) =>
              router.last_seen_at,
          )
          .filter(Boolean)
          .map((value) => ({
            value,
            time: new Date(
              value,
            ).getTime(),
          }))
          .filter((entry) =>
            Number.isFinite(
              entry.time,
            ),
          )
          .sort(
            (a, b) =>
              b.time - a.time,
          );

      return (
        timestamps[0]?.value ||
        null
      );
    }, [routers]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="Network Monitoring"
        description="Live router health, connectivity, provisioning status and hotspot activity by site."
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

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <label className="text-sm font-semibold text-slate-700">
          Site

          <select
            value={siteId}
            onChange={(event) =>
              setSiteId(
                event.target.value,
              )
            }
            className="mt-2 block w-full max-w-md rounded-xl border border-slate-300 bg-white p-3"
          >
            <option value="all">
              All sites
            </option>

            {sites.map((site) => (
              <option
                key={site.id}
                value={site.id}
              >
                {site.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Routers online"
          value={`${onlineRouters.length}/${routers.length}`}
        />

        <StatCard
          label="Last router poll"
          value={lastContact(
            lastPoll,
          )}
        />

        <StatCard
          label="Failed jobs"
          value={
            failedJobs.length
          }
        />

        <StatCard
          label="Active sessions"
          value={
            activeSessions.length
          }
        />

        <StatCard
          label="WAN online"
          value={
            wanOnlineRouters.length
          }
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-gradient-to-r from-blue-50 to-cyan-50">
              <tr>
                {[
                  'Router',
                  'Site',
                  'Status',
                  'Last poll',
                  'CPU',
                  'Memory',
                  'Uptime',
                  'Hotspot users',
                  'WAN',
                  'Last error',
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
                    colSpan={10}
                    className="p-12 text-center text-slate-500"
                  >
                    Loading monitoring
                    data…
                  </td>
                </tr>
              ) : routers.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="p-12 text-center text-slate-500"
                  >
                    No routers found
                    for this site.
                  </td>
                </tr>
              ) : (
                routers.map(
                  (router) => {
                    const online =
                      isRouterOnline(
                        router,
                      );

                    return (
                      <tr
                        key={
                          router.id
                        }
                        className="hover:bg-blue-50/30"
                      >
                        <td className="px-4 py-4 font-bold text-slate-900">
                          {
                            router.name
                          }
                        </td>

                        <td className="px-4 py-4">
                          <SiteBadge
                            siteId={
                              router.site_id
                            }
                            sites={
                              sites
                            }
                          />
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            value={
                              online
                                ? 'online'
                                : 'offline'
                            }
                          />
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <FiClock />

                            {lastContact(
                              router.last_seen_at,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          <FiCpu className="mr-1 inline" />

                          {router.cpu_usage_percent ==
                          null
                            ? '—'
                            : `${Number(
                                router.cpu_usage_percent,
                              ).toFixed(
                                0,
                              )}%`}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          <FiHardDrive className="mr-1 inline" />

                          {router.memory_usage_percent ==
                          null
                            ? '—'
                            : `${Number(
                                router.memory_usage_percent,
                              ).toFixed(
                                0,
                              )}%`}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          {router.uptime_text ||
                            formatUptime(
                              router.uptime_seconds,
                            )}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600">
                          <FiUsers className="mr-1 inline" />

                          {Number(
                            router.active_hotspot_users ||
                              0,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-2 text-sm">
                            <FiWifi />

                            {router.wan_status ||
                              'unknown'}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm text-rose-600">
                          {router.last_error ||
                            '—'}
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

      {failedJobs.length >
        0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <FiAlertTriangle />
            Recent failed
            provisioning jobs
          </div>

          <div className="mt-3 space-y-2 text-sm text-amber-800">
            {failedJobs
              .slice(0, 10)
              .map((job) => (
                <div
                  key={job.id}
                >
                  {job.username ||
                    job.id}
                  :{' '}
                  {job.failure_reason ||
                    'Provisioning failed'}
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}