import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiCalendar,
  FiRefreshCw,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';

import { useTenant } from '../../hooks/useTenant';

import {
  getActiveSessions,
  getDevices,
  getHistoricalSessions,
  getSites,
  getTableRows,
} from '../../services/operationsService';

import {
  PageHeader,
  StatCard,
} from '../../components/operations/OperationsUI';

import {
  money,
  periodRange,
  toInputDate,
  withinRange,
} from '../../utils/reporting';

import {
  ACTIVE_SESSION_STATUSES,
  createSiteResolver,
  customerKey,
  isPaid,
  norm,
  orderAmount,
} from '../../utils/operationsData';

const ROUTER_ONLINE_WINDOW_MS = 2 * 60 * 1000;
const CHART_DAYS = 14;
const FORECAST_DAYS = 7;

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
    'gateway_router',
  ].includes(type);
}

function isRouterOnline(router) {
  if (!router?.last_seen_at) return false;

  const timestamp = new Date(router.last_seen_at).getTime();

  return (
    Number.isFinite(timestamp) &&
    Date.now() - timestamp < ROUTER_ONLINE_WINDOW_MS
  );
}

function dayKey(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ''
    : date.toISOString().slice(0, 10);
}

function shortDate(value) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildContinuousSeries(values, days = CHART_DAYS) {
  if (!values.length) return [];

  const map = new Map(
    values.map((item) => [item.label, Number(item.value || 0)]),
  );

  const lastKey = [...map.keys()].sort().at(-1);
  if (!lastKey) return [];

  const firstKey = addDays(lastKey, -(days - 1));

  return Array.from({ length: days }, (_, index) => {
    const label = addDays(firstKey, index);

    return {
      label,
      value: map.get(label) || 0,
    };
  });
}

function linearForecast(series, days = FORECAST_DAYS) {
  if (series.length < 2) return [];

  const points = series.map((item, index) => ({
    x: index,
    y: Number(item.value || 0),
  }));

  const count = points.length;

  const sumX = points.reduce((total, point) => total + point.x, 0);
  const sumY = points.reduce((total, point) => total + point.y, 0);
  const sumXY = points.reduce(
    (total, point) => total + point.x * point.y,
    0,
  );
  const sumXX = points.reduce(
    (total, point) => total + point.x * point.x,
    0,
  );

  const denominator = count * sumXX - sumX * sumX;

  const slope = denominator
    ? (count * sumXY - sumX * sumY) / denominator
    : 0;

  const intercept = (sumY - slope * sumX) / count;
  const lastDate = series.at(-1)?.label;

  return Array.from({ length: days }, (_, index) => {
    const x = count + index;
    const value = Math.max(0, intercept + slope * x);

    return {
      label: addDays(lastDate, index + 1),
      value,
      forecast: true,
    };
  });
}

function Bars({ items, format = (value) => value }) {
  const max = Math.max(
    1,
    ...items.map((item) => Number(item.value || 0)),
  );

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No data for this period.
        </p>
      ) : (
        items.map((item, index) => (
          <div key={`${item.label}-${index}`}>
            <div className="mb-1.5 flex justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-700">
                {item.label}
              </span>

              <strong className="text-slate-900">
                {format(item.value)}
              </strong>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all"
                style={{
                  width: `${Math.max(
                    4,
                    (Number(item.value || 0) / max) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function TrendChart({
  actual,
  forecast = [],
  format = (value) => String(Math.round(value)),
  emptyText = 'No trend data for this period.',
}) {
  const width = 900;
  const height = 290;
  const padding = {
    left: 62,
    right: 24,
    top: 24,
    bottom: 48,
  };

  const combined = [
    ...actual.map((item) => ({ ...item, kind: 'actual' })),
    ...forecast.map((item) => ({ ...item, kind: 'forecast' })),
  ];

  if (!combined.length) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  const values = combined.map((item) => Number(item.value || 0));
  const maxValue = Math.max(1, ...values);
  const minValue = Math.min(0, ...values);

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xFor = (index) => {
    if (combined.length <= 1) return padding.left;

    return (
      padding.left +
      (index / (combined.length - 1)) * plotWidth
    );
  };

  const yFor = (value) => {
    const range = Math.max(1, maxValue - minValue);

    return (
      padding.top +
      ((maxValue - Number(value || 0)) / range) * plotHeight
    );
  };

  const actualPoints = actual
    .map((item, index) => `${xFor(index)},${yFor(item.value)}`)
    .join(' ');

  const forecastOffset = Math.max(0, actual.length - 1);
  const forecastSource = forecast.length
    ? [
        actual.at(-1),
        ...forecast,
      ].filter(Boolean)
    : [];

  const forecastPoints = forecastSource
    .map((item, index) => {
      const globalIndex = forecastOffset + index;
      return `${xFor(globalIndex)},${yFor(item.value)}`;
    })
    .join(' ');

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const fraction = index / 4;
    const value = maxValue - fraction * (maxValue - minValue);

    return {
      value,
      y: padding.top + fraction * plotHeight,
    };
  });

  const tickIndexes = [...new Set([
    0,
    Math.floor((combined.length - 1) * 0.25),
    Math.floor((combined.length - 1) * 0.5),
    Math.floor((combined.length - 1) * 0.75),
    combined.length - 1,
  ])];

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[720px] w-full"
          role="img"
          aria-label="Analytics trend chart"
        >
          <defs>
            <linearGradient
              id="analyticsAreaGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="currentColor"
                stopOpacity="0.18"
              />
              <stop
                offset="100%"
                stopColor="currentColor"
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>

          {yTicks.map((tick, index) => (
            <g key={index}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={tick.y}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />

              <text
                x={padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {format(tick.value)}
              </text>
            </g>
          ))}

          {actual.length > 1 && (
            <polygon
              points={[
                `${xFor(0)},${padding.top + plotHeight}`,
                actualPoints,
                `${xFor(actual.length - 1)},${padding.top + plotHeight}`,
              ].join(' ')}
              fill="url(#analyticsAreaGradient)"
              className="text-blue-600"
            />
          )}

          {actual.length > 1 && (
            <polyline
              points={actualPoints}
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {actual.length === 1 && (
            <circle
              cx={xFor(0)}
              cy={yFor(actual[0].value)}
              r="5"
              fill="#2563eb"
            />
          )}

          {actual.map((item, index) => (
            <circle
              key={`actual-${item.label}`}
              cx={xFor(index)}
              cy={yFor(item.value)}
              r="3.5"
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth="2.5"
            >
              <title>
                {item.label}: {format(item.value)}
              </title>
            </circle>
          ))}

          {forecastPoints && (
            <polyline
              points={forecastPoints}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="3"
              strokeDasharray="8 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {forecast.map((item, index) => {
            const globalIndex = actual.length + index;

            return (
              <circle
                key={`forecast-${item.label}`}
                cx={xFor(globalIndex)}
                cy={yFor(item.value)}
                r="3"
                fill="#ffffff"
                stroke="#06b6d4"
                strokeWidth="2"
              >
                <title>
                  Estimated {item.label}: {format(item.value)}
                </title>
              </circle>
            );
          })}

          {tickIndexes.map((index) => {
            const item = combined[index];

            if (!item) return null;

            return (
              <text
                key={`tick-${index}`}
                x={xFor(index)}
                y={height - 18}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
              >
                {shortDate(item.label)}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-7 rounded bg-blue-600" />
          Actual
        </span>

        {forecast.length > 0 && (
          <span className="inline-flex items-center gap-2">
            <span className="w-7 border-t-2 border-dashed border-cyan-500" />
            7-day estimate
          </span>
        )}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { tenantId } = useTenant();

  const [sites, setSites] = useState([]);
  const [devices, setDevices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [historicalSessions, setHistoricalSessions] = useState([]);
  const [vouchers, setVouchers] = useState([]);

  const [siteId, setSiteId] = useState('all');
  const [period, setPeriod] = useState('this_month');

  const [fromDate, setFromDate] = useState(
    toInputDate(new Date()),
  );

  const [toDate, setToDate] = useState(
    toInputDate(new Date()),
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!tenantId) {
      setSites([]);
      setDevices([]);
      setOrders([]);
      setLiveSessions([]);
      setHistoricalSessions([]);
      setVouchers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const results = await Promise.allSettled([
      getSites(tenantId),
      getDevices(tenantId),
      getTableRows('hotspot_orders', tenantId),
      getActiveSessions(tenantId),
      getHistoricalSessions(tenantId),
      getTableRows('hotspot_vouchers', tenantId),
    ]);

    setSites(
      results[0].status === 'fulfilled'
        ? results[0].value || []
        : [],
    );

    setDevices(
      results[1].status === 'fulfilled'
        ? results[1].value || []
        : [],
    );

    setOrders(
      results[2].status === 'fulfilled'
        ? results[2].value || []
        : [],
    );

    setLiveSessions(
      results[3].status === 'fulfilled'
        ? results[3].value || []
        : [],
    );

    setHistoricalSessions(
      results[4].status === 'fulfilled'
        ? results[4].value || []
        : [],
    );

    setVouchers(
      results[5].status === 'fulfilled'
        ? results[5].value || []
        : [],
    );

    if (results.some((result) => result.status === 'rejected')) {
      setError(
        'Some analytics data is temporarily unavailable. Available metrics are still shown.',
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const range = useMemo(
    () => periodRange(period, fromDate, toDate),
    [period, fromDate, toDate],
  );

  const resolveSite = useMemo(
    () => createSiteResolver(devices),
    [devices],
  );

  const scopedOrders = useMemo(
    () =>
      orders
        .map((item) => ({
          ...item,
          resolved_site_id: resolveSite(item),
        }))
        .filter(
          (item) =>
            (siteId === 'all' ||
              String(item.resolved_site_id) === String(siteId)) &&
            withinRange(item, range, ['paid_at', 'created_at']),
        ),
    [orders, resolveSite, siteId, range],
  );

  const allSessions = useMemo(
    () => [...historicalSessions, ...liveSessions],
    [historicalSessions, liveSessions],
  );

  const scopedSessions = useMemo(
    () =>
      allSessions
        .map((item) => ({
          ...item,
          resolved_site_id: resolveSite(item),
        }))
        .filter(
          (item) =>
            (siteId === 'all' ||
              String(item.resolved_site_id) === String(siteId)) &&
            withinRange(item, range, ['started_at', 'created_at']),
        ),
    [allSessions, resolveSite, siteId, range],
  );

  const paid = useMemo(
    () => scopedOrders.filter(isPaid),
    [scopedOrders],
  );

  const revenue = useMemo(
    () =>
      paid.reduce(
        (total, item) => total + orderAmount(item),
        0,
      ),
    [paid],
  );

  const customerCount = useMemo(
    () =>
      new Set(
        paid
          .map(customerKey)
          .filter(Boolean),
      ).size,
    [paid],
  );

  const arpu = customerCount
    ? revenue / customerCount
    : 0;

  const routers = useMemo(
    () =>
      devices.filter(
        (device) =>
          isRouterDevice(device) &&
          (siteId === 'all' ||
            String(device.site_id) === String(siteId)),
      ),
    [devices, siteId],
  );

  const onlineRouters = useMemo(
    () => routers.filter(isRouterOnline),
    [routers],
  );

  const liveScopedSessions = useMemo(
    () =>
      liveSessions
        .map((item) => ({
          ...item,
          resolved_site_id: resolveSite(item),
        }))
        .filter(
          (item) =>
            ACTIVE_SESSION_STATUSES.has(norm(item.status)) &&
            (siteId === 'all' ||
              String(item.resolved_site_id) === String(siteId)),
        ),
    [liveSessions, resolveSite, siteId],
  );

  const activeDetailed = liveScopedSessions.length;

  const activeRouterTotal = routers.reduce(
    (total, router) =>
      total + Number(router.active_hotspot_users || 0),
    0,
  );

  const activeUsers = Math.max(
    activeDetailed,
    activeRouterTotal,
  );

  const planRows = useMemo(() => {
    const map = new Map();

    for (const item of paid) {
      const key =
        item.plan_name ||
        item.plan_code ||
        'Unnamed plan';

      const current = map.get(key) || {
        label: key,
        count: 0,
        value: 0,
      };

      current.count += 1;
      current.value += orderAmount(item);

      map.set(key, current);
    }

    return [...map.values()]
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.value - a.value,
      )
      .slice(0, 8);
  }, [paid]);

  const siteRows = useMemo(
    () =>
      sites
        .filter(
          (site) =>
            siteId === 'all' ||
            String(site.id) === String(siteId),
        )
        .map((site) => ({
          label: site.name,
          value: paid
            .filter(
              (item) =>
                String(item.resolved_site_id) === String(site.id),
            )
            .reduce(
              (total, item) =>
                total + orderAmount(item),
              0,
            ),
        }))
        .sort((a, b) => b.value - a.value),
    [sites, siteId, paid],
  );

  const revenueByDay = useMemo(() => {
    const map = new Map();

    for (const item of paid) {
      const key = dayKey(
        item.paid_at || item.created_at,
      );

      if (!key) continue;

      map.set(
        key,
        (map.get(key) || 0) + orderAmount(item),
      );
    }

    return [...map.entries()]
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label),
      );
  }, [paid]);

  const revenueTrend = useMemo(
    () =>
      buildContinuousSeries(
        revenueByDay,
        CHART_DAYS,
      ),
    [revenueByDay],
  );

  const revenueForecast = useMemo(
    () =>
      revenueTrend.length >= 2
        ? linearForecast(
            revenueTrend,
            FORECAST_DAYS,
          )
        : [],
    [revenueTrend],
  );

  const usersByDay = useMemo(() => {
    const map = new Map();

    const addUser = (key, id) => {
      if (!key || !id) return;

      if (!map.has(key)) {
        map.set(key, new Set());
      }

      map.get(key).add(id);
    };

    for (const item of paid) {
      const key = dayKey(
        item.paid_at || item.created_at,
      );

      const id =
        customerKey(item) ||
        item.username ||
        item.mac_address ||
        item.id;

      addUser(key, id);
    }

    for (const item of scopedSessions) {
      const key = dayKey(
        item.started_at || item.created_at,
      );

      const id =
        customerKey(item) ||
        item.username ||
        item.mac_address ||
        item.id;

      addUser(key, id);
    }

    return [...map.entries()]
      .map(([label, set]) => ({
        label,
        value: set.size,
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label),
      );
  }, [paid, scopedSessions]);

  const userTrend = useMemo(
    () =>
      buildContinuousSeries(
        usersByDay,
        CHART_DAYS,
      ),
    [usersByDay],
  );

  const purchasesByDay = useMemo(() => {
    const map = new Map();

    for (const item of paid) {
      const key = dayKey(
        item.paid_at || item.created_at,
      );

      if (!key) continue;

      map.set(
        key,
        (map.get(key) || 0) + 1,
      );
    }

    return buildContinuousSeries(
      [...map.entries()].map(([label, value]) => ({
        label,
        value,
      })),
      CHART_DAYS,
    );
  }, [paid]);

  const projectedRevenue = useMemo(
    () =>
      revenueForecast.reduce(
        (total, item) => total + Number(item.value || 0),
        0,
      ),
    [revenueForecast],
  );

  const recentActualRevenue = useMemo(
    () =>
      revenueTrend
        .slice(-FORECAST_DAYS)
        .reduce(
          (total, item) => total + Number(item.value || 0),
          0,
        ),
    [revenueTrend],
  );

  const forecastDirection =
    projectedRevenue > recentActualRevenue * 1.05
      ? 'up'
      : projectedRevenue < recentActualRevenue * 0.95
        ? 'down'
        : 'flat';

  const insights = [];

  if (planRows[0]) {
    insights.push(
      `${planRows[0].label} is the most purchased plan with ${planRows[0].count} paid purchase${planRows[0].count === 1 ? '' : 's'}.`,
    );
  }

  if (siteRows[0] && siteRows[0].value > 0) {
    insights.push(
      `${siteRows[0].label} is the highest-revenue site for the selected period at ${money(siteRows[0].value)}.`,
    );
  }

  if (routers.length && onlineRouters.length < routers.length) {
    insights.push(
      `${routers.length - onlineRouters.length} router${routers.length - onlineRouters.length === 1 ? '' : 's'} are not currently reporting within the expected heartbeat window.`,
    );
  }

  if (activeRouterTotal > activeDetailed) {
    insights.push(
      'Router telemetry reports more live users than the detailed active-session feed.',
    );
  }

  if (revenueForecast.length) {
    const directionText =
      forecastDirection === 'up'
        ? 'higher than'
        : forecastDirection === 'down'
          ? 'lower than'
          : 'similar to';

    insights.push(
      `The simple 7-day revenue trend estimate is ${money(projectedRevenue)}, ${directionText} the most recent 7-day actual total of ${money(recentActualRevenue)}.`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Decision support"
        title="Analytics & Decision Support"
        description="Revenue trends, customer activity, plan popularity, site performance and network health."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw
              className={loading ? 'animate-spin' : ''}
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

      <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-blue-800">
          <FiCalendar />
          Analytics filters
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            Site
            <select
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2.5"
            >
              <option value="all">All sites</option>

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

          <label className="text-sm font-semibold text-slate-700">
            Period
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2.5"
            >
              <option value="today">Today</option>
              <option value="this_week">This week</option>
              <option value="last_7_days">Last 7 days</option>
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="this_year">This year</option>
              <option value="all">All time</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPeriod('custom');
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2.5"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            To
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setPeriod('custom');
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-2.5"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Revenue"
          value={loading ? '—' : money(revenue)}
        />

        <StatCard
          label="Paid purchases"
          value={paid.length}
        />

        <StatCard
          label="Paying customers"
          value={customerCount}
        />

        <StatCard
          label="ARPU"
          value={money(arpu)}
        />

        <StatCard
          label="Active users"
          value={activeUsers}
        />

        <StatCard
          label="Routers online"
          value={`${onlineRouters.length}/${routers.length}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Revenue trend & estimate
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Daily paid revenue with a simple 7-day linear trend estimate.
              </p>
            </div>

            <FiTrendingUp className="text-xl text-blue-600" />
          </div>

          <TrendChart
            actual={revenueTrend}
            forecast={revenueForecast}
            format={(value) => money(value)}
          />

          {revenueForecast.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recent 7 days
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {money(recentActualRevenue)}
                </div>
              </div>

              <div className="rounded-2xl bg-cyan-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  Next 7 days estimate
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {money(projectedRevenue)}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                User activity trend
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Unique daily users from purchases and session activity.
              </p>
            </div>

            <FiUsers className="text-xl text-blue-600" />
          </div>

          <TrendChart
            actual={userTrend}
            format={(value) =>
              Math.round(Number(value || 0)).toLocaleString()
            }
            emptyText="No user activity trend is available for this period."
          />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-slate-900">
            Purchases trend
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Number of successful paid purchases per day.
          </p>

          <TrendChart
            actual={purchasesByDay}
            format={(value) =>
              Math.round(Number(value || 0)).toLocaleString()
            }
            emptyText="No paid purchase trend is available for this period."
          />
        </section>

        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FiActivity className="text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Decision support
            </h2>
          </div>

          {insights.length ? (
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white bg-white p-4 text-sm text-slate-700 shadow-sm"
                >
                  {insight}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              More insights will appear as paid orders and session history accumulate.
            </p>
          )}

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-slate-600">
            Forecasts are directional estimates based only on recent recorded revenue.
            They are not guarantees and become more useful as more daily transaction
            history accumulates.
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Most purchased plans
          </h2>

          <Bars
            items={planRows.map((item) => ({
              label: `${item.label} (${item.count})`,
              value: item.value,
            }))}
            format={money}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold text-slate-900">
            Revenue by site
          </h2>

          <Bars
            items={siteRows}
            format={money}
          />
        </section>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 shadow-sm">
        Analytics uses tenant-scoped business and network records. Access points are
        excluded from router availability counts unless they are explicitly registered
        as router/gateway devices.
      </div>
    </div>
  );
}
