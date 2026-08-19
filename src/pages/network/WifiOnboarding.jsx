import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FiDownload,
  FiEdit3,
  FiPlus,
  FiPrinter,
  FiRefreshCw,
  FiSave,
  FiTrash2,
  FiWifi,
} from 'react-icons/fi';

import { useTenant } from '../../hooks/useTenant';
import { getSites } from '../../services/operationsService';

import {
  buildWifiQrPayload,
  createSiteWifiNetwork,
  deleteSiteWifiNetwork,
  getSiteWifiNetworks,
  updateSiteWifiNetwork,
} from '../../services/wifiOnboardingService';

import {
  PageHeader,
  StatCard,
} from '../../components/operations/OperationsUI';

import WifiPoster from '../../components/operations/WifiPoster';

const emptyForm = {
  site_id: '',
  display_name: '',
  ssid: '',
  security_type: 'nopass',
  wifi_password: '',
  is_hidden: false,
  qr_enabled: true,
  show_cloudrouter_branding: true,
  is_primary: true,
  is_customer_network: true,
  is_active: true,
  customer_message:
    'Scan to connect, choose a bundle and get online.',
};

function networkLabel(network) {
  return (
    network?.display_name ||
    network?.ssid ||
    'Wi-Fi network'
  );
}

function downloadSvg(svgId, filename) {
  const svg =
    document.getElementById(svgId);

  if (!svg) {
    throw new Error(
      'QR preview is not available yet.',
    );
  }

  const serializer =
    new XMLSerializer();

  const content =
    serializer.serializeToString(svg);

  const source =
    content.includes('xmlns=')
      ? content
      : content.replace(
          '<svg',
          '<svg xmlns="http://www.w3.org/2000/svg"',
        );

  const blob =
    new Blob(
      [source],
      {
        type: 'image/svg+xml;charset=utf-8',
      },
    );

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement('a');

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function printPoster() {
  const poster =
    document.getElementById(
      'cloudrouter-wifi-poster',
    );

  if (!poster) {
    return;
  }

  const printWindow =
    window.open(
      '',
      '_blank',
      'width=900,height=1000',
    );

  if (!printWindow) {
    throw new Error(
      'Your browser blocked the print window. Allow pop-ups for CloudRouter and try again.',
    );
  }

  const appStyles = [
    ...document.querySelectorAll(
      'link[rel="stylesheet"], style',
    ),
  ]
    .map((node) => node.outerHTML)
    .join('\n');

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Wi-Fi Onboarding Poster</title>
        <meta charset="utf-8" />
        ${appStyles}
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 12mm;
            background: white !important;
          }
          #cloudrouter-wifi-poster {
            max-width: 180mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
          }
          #cloudrouter-wifi-poster svg {
            max-width: 72mm;
            height: auto;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        </style>
      </head>
      <body>
        ${poster.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
}

export default function WifiOnboarding() {
  const { tenantId } =
    useTenant();

  const [sites, setSites] =
    useState([]);

  const [networks, setNetworks] =
    useState([]);

  const [
    selectedNetworkId,
    setSelectedNetworkId,
  ] = useState('');

  const [form, setForm] =
    useState(emptyForm);

  const [editing, setEditing] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  async function load() {
    if (!tenantId) {
      setSites([]);
      setNetworks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [
        siteRows,
        wifiRows,
      ] = await Promise.all([
        getSites(tenantId),
        getSiteWifiNetworks(tenantId),
      ]);

      const safeSites =
        Array.isArray(siteRows)
          ? siteRows
          : [];

      const safeNetworks =
        Array.isArray(wifiRows)
          ? wifiRows
          : [];

      setSites(safeSites);
      setNetworks(safeNetworks);

      setSelectedNetworkId(
        (current) => {
          if (
            current &&
            safeNetworks.some(
              (item) =>
                item.id === current,
            )
          ) {
            return current;
          }

          return (
            safeNetworks.find(
              (item) =>
                item.is_primary &&
                item.is_active,
            )?.id ||
            safeNetworks[0]?.id ||
            ''
          );
        },
      );

      if (
        !safeNetworks.length &&
        safeSites.length
      ) {
        setForm((current) => ({
          ...current,
          site_id:
            safeSites[0].id,
        }));
      }
    } catch (loadError) {
      console.error(
        'Could not load Wi-Fi onboarding:',
        loadError,
      );

      setError(
        loadError?.message ||
          'Could not load Wi-Fi onboarding.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const selectedNetwork =
    useMemo(
      () =>
        networks.find(
          (item) =>
            item.id ===
            selectedNetworkId,
        ) || null,
      [
        networks,
        selectedNetworkId,
      ],
    );

  const selectedSite =
    useMemo(() => {
      const site =
        selectedNetwork?.site_id ||
        form.site_id;

      return (
        sites.find(
          (item) =>
            String(item.id) ===
            String(site),
        ) || null
      );
    }, [
      sites,
      selectedNetwork,
      form.site_id,
    ]);

  const customerNetworks =
    useMemo(
      () =>
        networks.filter(
          (network) =>
            network.is_customer_network,
        ),
      [networks],
    );

  const activeNetworks =
    useMemo(
      () =>
        customerNetworks.filter(
          (network) =>
            network.is_active,
        ),
      [customerNetworks],
    );

  const qrEnabled =
    useMemo(
      () =>
        activeNetworks.filter(
          (network) =>
            network.qr_enabled,
        ).length,
      [activeNetworks],
    );

  function beginCreate() {
    setError('');
    setSuccess('');

    const targetSiteId =
      selectedSite?.id ||
      sites[0]?.id ||
      '';

    const siteAlreadyHasPrimary =
      networks.some(
        (network) =>
          String(network.site_id) ===
            String(targetSiteId) &&
          network.is_customer_network &&
          network.is_primary,
      );

    setForm({
      ...emptyForm,
      site_id: targetSiteId,
      is_primary:
        !siteAlreadyHasPrimary,
    });

    setEditing('new');
  }

  function beginEdit() {
    if (!selectedNetwork) {
      return;
    }

    setError('');
    setSuccess('');

    setForm({
      site_id:
        selectedNetwork.site_id ||
        '',

      display_name:
        selectedNetwork.display_name ||
        '',

      ssid:
        selectedNetwork.ssid ||
        '',

      security_type:
        selectedNetwork.security_type ||
        'nopass',

      wifi_password:
        selectedNetwork.wifi_password ||
        '',

      is_hidden:
        Boolean(
          selectedNetwork.is_hidden,
        ),

      qr_enabled:
        selectedNetwork.qr_enabled !==
        false,

      show_cloudrouter_branding:
        selectedNetwork.show_cloudrouter_branding !==
        false,

      is_primary:
        Boolean(
          selectedNetwork.is_primary,
        ),

      is_customer_network:
        selectedNetwork.is_customer_network !==
        false,

      is_active:
        selectedNetwork.is_active !==
        false,

      customer_message:
        selectedNetwork.customer_message ||
        '',
    });

    setEditing('edit');
  }

  function cancelEdit() {
    setEditing(false);
    setError('');
  }

  function change(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }));
  }

  async function save(event) {
    event.preventDefault();

    if (!tenantId) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      let saved;

      if (
        editing === 'edit' &&
        selectedNetwork
      ) {
        saved =
          await updateSiteWifiNetwork(
            selectedNetwork.id,
            tenantId,
            form,
          );
      } else {
        saved =
          await createSiteWifiNetwork(
            tenantId,
            form,
          );
      }

      await load();

      setSelectedNetworkId(
        saved.id,
      );

      setEditing(false);

      setSuccess(
        `${networkLabel(saved)} saved successfully.`,
      );
    } catch (saveError) {
      console.error(
        'Could not save Wi-Fi network:',
        saveError,
      );

      setError(
        saveError?.message ||
          'Could not save Wi-Fi configuration.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (
      !selectedNetwork ||
      !tenantId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${networkLabel(selectedNetwork)}? This removes its QR onboarding configuration only; it does not change the MikroTik access point.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await deleteSiteWifiNetwork(
        selectedNetwork.id,
        tenantId,
      );

      setSelectedNetworkId('');
      await load();

      setSuccess(
        'Wi-Fi onboarding configuration deleted.',
      );
    } catch (deleteError) {
      console.error(
        'Could not delete Wi-Fi configuration:',
        deleteError,
      );

      setError(
        deleteError?.message ||
          'Could not delete Wi-Fi configuration.',
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadQr() {
    if (!selectedNetwork) {
      return;
    }

    try {
      const filename =
        `${selectedNetwork.ssid || 'wifi'}-qr.svg`
          .replace(
            /[^a-z0-9_.-]+/gi,
            '-',
          )
          .toLowerCase();

      downloadSvg(
        'cloudrouter-wifi-qr',
        filename,
      );
    } catch (downloadError) {
      setError(
        downloadError?.message ||
          'Could not download QR code.',
      );
    }
  }

  function handlePrintPoster() {
    try {
      printPoster();
    } catch (printError) {
      setError(
        printError?.message ||
          'Could not open the poster for printing.',
      );
    }
  }

  const previewNetwork =
    editing
      ? {
          ...form,
          id:
            selectedNetwork?.id ||
            'preview',
        }
      : selectedNetwork;

  const qrPayload =
    previewNetwork
      ? buildWifiQrPayload(
          previewNetwork,
        )
      : '';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="Wi-Fi Onboarding"
        description="Create zero-data Wi-Fi QR onboarding for each ISP/site and generate customer posters branded Powered by CloudRouter."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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

            <button
              type="button"
              onClick={beginCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <FiPlus />
              Add Wi-Fi
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Customer Wi-Fi"
          value={
            customerNetworks.length
          }
        />

        <StatCard
          label="Active"
          value={
            activeNetworks.length
          }
        />

        <StatCard
          label="QR enabled"
          value={qrEnabled}
        />

        <StatCard
          label="Sites covered"
          value={
            new Set(
              customerNetworks
                .map(
                  (network) =>
                    network.site_id,
                )
                .filter(Boolean),
            ).size
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 font-bold text-slate-900">
              <FiWifi className="text-blue-600" />
              Wi-Fi configuration
            </div>

            {editing ? (
              <form
                onSubmit={save}
                className="space-y-4"
              >
                <label className="block text-sm font-semibold text-slate-700">
                  Network site
                  <select
                    name="site_id"
                    value={form.site_id}
                    onChange={change}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
                  >
                    <option value="">
                      Select site
                    </option>

                    {sites.map(
                      (site) => (
                        <option
                          key={site.id}
                          value={site.id}
                        >
                          {site.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Service display name
                  <input
                    name="display_name"
                    value={form.display_name}
                    onChange={change}
                    placeholder="KanWave Internet"
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Customer Wi-Fi SSID
                  <input
                    name="ssid"
                    value={form.ssid}
                    onChange={change}
                    placeholder="KanWave"
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Wi-Fi security
                  <select
                    name="security_type"
                    value={form.security_type}
                    onChange={change}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
                  >
                    <option value="nopass">
                      Open / Captive portal
                    </option>
                    <option value="WPA">
                      WPA/WPA2
                    </option>
                    <option value="WEP">
                      WEP
                    </option>
                  </select>
                </label>

                {form.security_type !==
                  'nopass' && (
                  <label className="block text-sm font-semibold text-slate-700">
                    Wi-Fi password
                    <input
                      type="password"
                      name="wifi_password"
                      value={
                        form.wifi_password
                      }
                      onChange={change}
                      autoComplete="new-password"
                      className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                    />
                  </label>
                )}

                <label className="block text-sm font-semibold text-slate-700">
                  Customer message
                  <textarea
                    name="customer_message"
                    value={
                      form.customer_message
                    }
                    onChange={change}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                  />
                </label>

                <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
                  {[
                    ['qr_enabled', 'Enable QR onboarding'],
                    ['show_cloudrouter_branding', 'Show “Powered by CloudRouter”'],
                    ['is_primary', 'Primary customer Wi-Fi for this site'],
                    ['is_customer_network', 'Customer-facing network'],
                    ['is_active', 'Configuration active'],
                    ['is_hidden', 'Hidden SSID'],
                  ].map(
                    ([name, label]) => (
                      <label
                        key={name}
                        className="flex items-center gap-3"
                      >
                        <input
                          type="checkbox"
                          name={name}
                          checked={
                            Boolean(
                              form[name],
                            )
                          }
                          onChange={change}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span>
                          {label}
                        </span>
                      </label>
                    ),
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    <FiSave />
                    {saving
                      ? 'Saving…'
                      : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {loading ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Loading Wi-Fi configuration…
                  </p>
                ) : networks.length ===
                  0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-slate-500">
                      No Wi-Fi onboarding configuration exists yet.
                    </p>

                    <button
                      type="button"
                      onClick={beginCreate}
                      className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Create first Wi-Fi QR
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Wi-Fi network
                      <select
                        value={
                          selectedNetworkId
                        }
                        onChange={(event) =>
                          setSelectedNetworkId(
                            event.target.value,
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
                      >
                        {networks.map(
                          (network) => {
                            const site =
                              sites.find(
                                (item) =>
                                  item.id ===
                                  network.site_id,
                              );

                            return (
                              <option
                                key={
                                  network.id
                                }
                                value={
                                  network.id
                                }
                              >
                                {networkLabel(
                                  network,
                                )}
                                {site
                                  ? ` — ${site.name}`
                                  : ''}
                              </option>
                            );
                          },
                        )}
                      </select>
                    </label>

                    {selectedNetwork && (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                        <div className="font-bold text-slate-900">
                          {networkLabel(
                            selectedNetwork,
                          )}
                        </div>

                        <div className="mt-2 space-y-1 text-slate-600">
                          <div>
                            SSID:{' '}
                            <strong>
                              {
                                selectedNetwork.ssid
                              }
                            </strong>
                          </div>
                          <div>
                            Site:{' '}
                            <strong>
                              {selectedSite?.name ||
                                '—'}
                            </strong>
                          </div>
                          <div>
                            Security:{' '}
                            <strong>
                              {selectedNetwork.security_type ===
                              'nopass'
                                ? 'Open / captive portal'
                                : selectedNetwork.security_type}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={beginEdit}
                        disabled={
                          !selectedNetwork
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700"
                      >
                        <FiEdit3 />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={
                          removeSelected
                        }
                        disabled={
                          !selectedNetwork ||
                          saving
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-3 text-sm font-semibold text-rose-600"
                      >
                        <FiTrash2 />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {qrPayload && (
            <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 text-sm text-slate-700">
              <div className="font-bold text-blue-900">
                Zero-data onboarding
              </div>

              <p className="mt-2 leading-6">
                The QR contains the Wi-Fi connection details, not an Internet URL. The phone joins the selected SSID first; your existing captive portal then opens for bundle purchase or voucher login.
              </p>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={
                handleDownloadQr
              }
              disabled={
                !selectedNetwork ||
                editing ||
                selectedNetwork.qr_enabled ===
                  false
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              <FiDownload />
              Download QR
            </button>

            <button
              type="button"
              onClick={
                handlePrintPoster
              }
              disabled={
                !selectedNetwork ||
                editing ||
                selectedNetwork.qr_enabled ===
                  false
              }
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <FiPrinter />
              Print Poster
            </button>
          </div>

          <WifiPoster
            network={previewNetwork}
            site={selectedSite}
          />
        </div>
      </div>
    </div>
  );
}
