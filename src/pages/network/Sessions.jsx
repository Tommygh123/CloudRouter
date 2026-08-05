import { useEffect, useMemo, useState } from 'react';
import {
  FiMonitor,
  FiRefreshCw,
  FiServer,
  FiWifi,
} from 'react-icons/fi';

import { useTenant } from '../../hooks/useTenant';
import {
  getDevices,
  getSites,
  getTableRows,
} from '../../services/operationsService';

import {
  PageHeader,
  SiteBadge,
  StatCard,
  StatusBadge,
} from '../../components/operations/OperationsUI';

import {
  ACTIVE_SESSION_STATUSES,
  createSiteResolver,
  norm,
} from '../../utils/operationsData';

function fmtBytes(value) {
  const n = Number(value || 0);

  if (!n) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }

  return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

function fmtTime(value) {
  if (!value) return '—';

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString();
}

export default function Sessions() {
  const { tenantId } = useTenant();

  const [sessions, setSessions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);

  const [siteId, setSiteId] = useState('all');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError('');

      const results = await Promise.allSettled([
        getTableRows('hotspot_sessions', tenantId),
        getDevices(tenantId),
        getSites(tenantId),
      ]);

      const sessionRows =
        results[0].status === 'fulfilled'
          ? results[0].value
          : [];

      const deviceRows =
        results[1].status === 'fulfilled'
          ? results[1].value
          : [];

      const siteRows =
        results[2].status === 'fulfilled'
          ? results[2].value
          : [];

      setSessions(sessionRows || []);
      setDevices(deviceRows || []);
      setSites(siteRows || []);

      if (results.some((result) => result.status === 'rejected')) {
        setError(
          'Detailed session synchronization is not available yet. Router live-user totals are still shown from heartbeat data.',
        );
      }
    } catch (err) {
      console.error('Sessions load error:', err);

      setError(
        err?.message ||
          'Unable to load hotspot session information.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    const timer = window.setInterval(
      load,
      30000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [tenantId]);

  const routers = useMemo(
    () =>
      devices.filter(
        (device) => device.device_type === 'router',
      ),
    [devices],
  );

  const resolveSite = useMemo(
    () => createSiteResolver(devices),
    [devices],
  );

  const detailedSessions = useMemo(
    () =>
      sessions.map((session) => ({
        ...session,
        resolved_site_id: resolveSite(session),
      })),
    [sessions, resolveSite],
  );

  const filteredSessions = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return detailedSessions.filter((session) => {
      const searchable = [
        session.username,
        session.customer_name,
        session.ip_address,
        session.mac_address,
        session.router_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSite =
        siteId === 'all' ||
        session.resolved_site_id === siteId;

      const matchesSearch =
        !searchText ||
        searchable.includes(searchText);

      return matchesSite && matchesSearch;
    });
  }, [
    detailedSessions,
    siteId,
    search,
  ]);

  const activeSessions = useMemo(
    () =>
      filteredSessions.filter((session) =>
        ACTIVE_SESSION_STATUSES.has(
          norm(session.status),
        ),
      ),
    [filteredSessions],
  );

  const selectedRouters = useMemo(
    () =>
      routers.filter(
        (router) =>
          siteId === 'all' ||
          router.site_id === siteId,
      ),
    [routers, siteId],
  );

  const routerReportedUsers = useMemo(
    () =>
      selectedRouters.reduce(
        (total, router) =>
          total +
          Number(
            router.active_hotspot_users || 0,
          ),
        0,
      ),
    [selectedRouters],
  );

  const routersReportingUsers = useMemo(
    () =>
      selectedRouters.filter(
        (router) =>
          Number(
            router.active_hotspot_users || 0,
          ) > 0,
      ).length,
    [selectedRouters],
  );

  const liveDisplay = Math.max(
    activeSessions.length,
    routerReportedUsers,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="Active Sessions"
        description="Live hotspot usage by site and router. Detailed rows come from RouterOS session synchronization; router heartbeat totals provide a fallback count."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw
              className={
                loading ? 'animate-spin' : ''
              }
            />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active now"
          value={liveDisplay}
          hint={
            activeSessions.length
              ? `${activeSessions.length} detailed session record(s)`
              : 'Using router heartbeat total'
          }
        />

        <StatCard
          label="Routers reporting"
          value={routersReportingUsers}
        />

        <StatCard
          label="Detailed active"
          value={activeSessions.length}
        />

        <StatCard
          label="Session records"
          value={filteredSessions.length}
        />
      </div>

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search username, IP, MAC or customer"
            className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <select
            value={siteId}
            onChange={(event) =>
              setSiteId(event.target.value)
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  'Connected',
                  'Uptime',
                  'Data used',
                  'Status',
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-12 text-center text-slate-500"
                  >
                    Loading sessions…
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-12 text-center text-slate-500"
                  >
                    <FiMonitor className="mx-auto mb-3 text-3xl text-blue-500" />

                    <div className="font-semibold text-slate-700">
                      No detailed session records yet
                    </div>

                    <div className="mt-2 text-sm text-slate-500">
                      Router heartbeat currently
                      reports{' '}
                      <strong>
                        {routerReportedUsers}
                      </strong>{' '}
                      active hotspot user(s).
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map(
                  (session) => {
                    const router =
                      routers.find(
                        (item) =>
                          item.id ===
                          session.router_id,
                      );

                    const bytesUsed =
                      Number(
                        session.bytes_in || 0,
                      ) +
                      Number(
                        session.bytes_out || 0,
                      );

                    return (
                      <tr
                        key={session.id}
                        className="transition hover:bg-blue-50/30"
                      >
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">
                            {session.username ||
                              '—'}
                          </div>

                          <div className="text-xs text-slate-500">
                            {session.customer_name ||
                              'Hotspot user'}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <SiteBadge
                            siteId={
                              session.resolved_site_id
                            }
                            sites={sites}
                          />
                        </td>

                        <td className="px-4 py-4 text-sm">
                          <span className="inline-flex items-center gap-2">
                            <FiServer className="text-blue-500" />

                            {session.router_name ||
                              router?.name ||
                              '—'}
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
                          {fmtTime(
                            session.started_at,
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-700">
                          {session.uptime_text ||
                            '—'}
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                          {fmtBytes(bytesUsed)}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            value={
                              session.status ||
                              'active'
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
        <div className="flex items-start gap-3">
          <FiWifi className="mt-1 text-xl text-cyan-600" />

          <div>
            <h3 className="font-bold text-slate-900">
              Router live-user fallback
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              CloudRouter can always use each
              router's heartbeat count as a
              fallback. Once detailed RouterOS
              session synchronization is active,
              this table will also show each
              hotspot username, IP address, MAC
              address, uptime and transferred
              data.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}