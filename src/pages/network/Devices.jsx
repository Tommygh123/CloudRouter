import { useEffect, useMemo, useState } from 'react';
import {
  FiCopy,
  FiDownload,
  FiPlus,
  FiServer,
  FiWifi,
} from 'react-icons/fi';

import { useTenant } from '../../hooks/useTenant';
import {
  buildRouterScript,
  createDevice,
  createSecret,
  getDevices,
  getSites,
} from '../../services/operationsService';

import {
  EmptyRow,
  Modal,
  PageHeader,
  SiteBadge,
  StatCard,
  StatusBadge,
  Toolbar,
} from '../../components/operations/OperationsUI';

const emptyForm = {
  name: '',
  device_type: 'router',
  site_id: '',
  model: '',
  serial_number: '',
  mac_address: '',
  ip_address: '',
  router_identity: '',
};

function projectRefFromEnvironment() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';

  return (
    url.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1] ||
    'YOUR_PROJECT_REF'
  );
}


function isRouterDevice(device) {
  const type = String(device?.device_type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['router', 'mikrotik_router', 'routeros', 'gateway'].includes(type) || Boolean(device?.router_identity || device?.identity_name);
}

export default function Devices() {
  const { tenantId } = useTenant();

  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const [script, setScript] = useState('');
  const [showScript, setShowScript] = useState(false);

  const [search, setSearch] = useState('');
  const [siteId, setSiteId] = useState('all');
  const [status, setStatus] = useState('all');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!tenantId) {
      setDevices([]);
      setSites([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [deviceRows, siteRows] = await Promise.all([
        getDevices(tenantId),
        getSites(tenantId),
      ]);

      setDevices(Array.isArray(deviceRows) ? deviceRows : []);
      setSites(Array.isArray(siteRows) ? siteRows : []);
    } catch (loadError) {
      console.error('Could not load devices:', loadError);

      setError(
        loadError?.message ||
          'Could not load routers and access points.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return devices.filter((row) => {
      const haystack = [
        row.name,
        row.device_type,
        row.model,
        row.management_ip,
        row.router_identity,
        row.serial_number,
        row.mac_address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        haystack.includes(normalizedSearch);

      const matchesSite =
        siteId === 'all' ||
        String(row.site_id) === String(siteId);

      const matchesStatus =
        status === 'all' ||
        String(row.status || '').toLowerCase() ===
          String(status).toLowerCase();

      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [devices, search, siteId, status]);

  const routers = useMemo(
    () =>
      devices.filter(isRouterDevice),
    [devices],
  );

  const accessPoints = useMemo(
    () =>
      devices.filter((device) =>
        ['access_point', 'ap'].includes(
          device.device_type,
        ),
      ),
    [devices],
  );

  const onlineCount = useMemo(
    () =>
      devices.filter((device) =>
        ['online', 'active'].includes(
          String(device.status || '').toLowerCase(),
        ),
      ).length,
    [devices],
  );

  const availableStatuses = useMemo(
    () => [
      ...new Set(
        devices
          .map((device) => device.status)
          .filter(Boolean),
      ),
    ],
    [devices],
  );

  function openDeviceForm() {
    setError('');

    setForm({
      ...emptyForm,
      site_id: sites[0]?.id || '',
    });

    setShowForm(true);
  }

  function closeDeviceForm() {
    if (saving) return;

    setShowForm(false);
    setForm(emptyForm);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (!tenantId) {
      setError(
        'No active tenant was found. Sign in again or complete tenant onboarding.',
      );
      return;
    }

    if (!form.name.trim()) {
      setError('Device name is required.');
      return;
    }

    if (!form.site_id) {
      setError('Select a network site.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const isRouter = form.device_type === 'router';

      const routerSecret = isRouter
        ? createSecret()
        : null;

      const payload = {
        ...form,
        name: form.name.trim(),
        router_secret: routerSecret,
      };

      const created = await createDevice(
        tenantId,
        payload,
      );

      setShowForm(false);
      setForm(emptyForm);

      await load();

      if (isRouter) {
        const routerId = created?.id;

        if (!routerId) {
          throw new Error(
            'The router record was created, but no router ID was returned.',
          );
        }

        const generatedScript = buildRouterScript({
          projectRef: projectRefFromEnvironment(),
          tenantId,
          routerId,
          routerSecret,
        });

        setScript(generatedScript);
        setShowScript(true);
      }
    } catch (saveError) {
      console.error('Could not register device:', saveError);

      setError(
        `${
          saveError?.message ||
          'Could not register the device.'
        } Run the CloudRouter operations SQL if the required device columns are missing.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(script);
    } catch (copyError) {
      console.error('Could not copy script:', copyError);

      setError(
        'The browser could not copy the script. Select the script manually and copy it.',
      );
    }
  }

  function downloadScript() {
    if (!script) return;

    const blob = new Blob([script], {
      type: 'text/plain;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'cloudrouter-provision.rsc';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="Routers & Access Points"
        description="Register each tenant router against a network site and generate a unique RouterOS installation script. Access points are recorded for coverage and inventory but do not run the provisioning script."
        actions={
          <button
            type="button"
            onClick={openDeviceForm}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <FiPlus />
            Add Router or AP
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
          label="All devices"
          value={devices.length}
        />

        <StatCard
          label="MikroTik routers"
          value={routers.length}
        />

        <StatCard
          label="Access points"
          value={accessPoints.length}
        />

        <StatCard
          label="Online"
          value={onlineCount}
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <Toolbar
          search={search}
          onSearch={setSearch}
          siteId={siteId}
          onSiteChange={setSiteId}
          sites={sites}
          status={status}
          onStatusChange={setStatus}
          statuses={availableStatuses}
          loading={loading}
          onRefresh={load}
        />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {[
                  'Device',
                  'Type',
                  'Site',
                  'Identity / IP',
                  'Model',
                  'Status',
                  'Last seen',
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <EmptyRow
                  colSpan={7}
                  text="Loading devices…"
                />
              ) : filtered.length === 0 ? (
                <EmptyRow
                  colSpan={7}
                  text="No routers or access points match the selected filters."
                />
              ) : (
                filtered.map((row) => {
                  const isRouter =
                    isRouterDevice(row);

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            {isRouter ? (
                              <FiServer />
                            ) : (
                              <FiWifi />
                            )}
                          </span>

                          <span className="font-semibold text-slate-900">
                            {row.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm capitalize text-slate-600">
                        {String(
                          row.device_type || 'device',
                        ).replaceAll('_', ' ')}
                      </td>

                      <td className="px-5 py-4">
                        <SiteBadge
                          siteId={row.site_id}
                          sites={sites}
                        />
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div>
                          {row.router_identity || '—'}
                        </div>

                        <div className="text-xs text-slate-400">
                          {row.management_ip ||
                            'No IP recorded'}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {row.model || '—'}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge value={row.status} />
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {row.last_seen_at
                          ? new Date(
                              row.last_seen_at,
                            ).toLocaleString()
                          : 'Never'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={showForm}
        title="Register router or access point"
        onClose={closeDeviceForm}
      >
        <form
          onSubmit={submit}
          className="grid gap-4 sm:grid-cols-2"
        >
          <label className="text-sm font-semibold text-slate-700">
            Device type

            <select
              name="device_type"
              value={form.device_type}
              onChange={handleFormChange}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            >
              <option value="router">
                MikroTik router
              </option>

              <option value="access_point">
                Access point
              </option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Network site

            <select
              name="site_id"
              value={form.site_id}
              onChange={handleFormChange}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            >
              <option value="">Select site</option>

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
            Device name

            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder="Main MikroTik RB4011"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Router identity

            <input
              name="router_identity"
              value={form.router_identity}
              onChange={handleFormChange}
              placeholder="CloudRouter-RB4011"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Model

            <input
              name="model"
              value={form.model}
              onChange={handleFormChange}
              placeholder="RB4011iGS+RM"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Serial number

            <input
              name="serial_number"
              value={form.serial_number}
              onChange={handleFormChange}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            MAC address

            <input
              name="mac_address"
              value={form.mac_address}
              onChange={handleFormChange}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Management IP

            <input
              name="ip_address"
              value={form.ip_address}
              onChange={handleFormChange}
              placeholder="192.168.88.1"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            />
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={closeDeviceForm}
              className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? 'Registering…'
                : 'Register device'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showScript}
        title="Tenant-specific RouterOS script"
        onClose={() => setShowScript(false)}
        wide
      >
        <p className="mb-4 text-sm text-slate-600">
          Install this script only on the router that
          was just registered. It contains the current
          tenant ID, router ID and a unique router
          secret.
        </p>

        <textarea
          readOnly
          value={script}
          spellCheck={false}
          className="h-[430px] w-full resize-none rounded-2xl bg-slate-950 p-4 font-mono text-xs text-emerald-300"
        />

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={copyScript}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700"
          >
            <FiCopy />
            Copy
          </button>

          <button
            type="button"
            onClick={downloadScript}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white"
          >
            <FiDownload />
            Download .rsc
          </button>
        </div>
      </Modal>
    </div>
  );
}