import { useEffect, useMemo, useState } from 'react';

import {
  FiCheckCircle,
  FiMessageSquare,
  FiPlus,
  FiPrinter,
  FiShare2,
  FiShoppingBag,
} from 'react-icons/fi';

import { useTenant } from '../../hooks/useTenant';

import {
  generateVouchers,
  getDevices,
  getPlans,
  getSites,
  getVouchers,
  markVoucherSold,
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


/* =========================================================
   HELPERS
========================================================= */

function displayPassword(voucher) {
  /*
   * The full password exists only immediately after
   * voucher generation.
   */
  if (voucher?.password) {
    return voucher.password;
  }

  /*
   * Persisted voucher records only expose the last
   * four characters.
   */
  if (voucher?.password_last_four) {
    return `••••${voucher.password_last_four}`;
  }

  return 'Not available';
}


function displayPrice(voucher) {
  const currency =
    voucher?.currency_code ||
    voucher?.currency ||
    'GHS';

  const price = Number(
    voucher?.price ||
      voucher?.selling_price ||
      0,
  );

  return `${currency} ${price.toFixed(2)}`;
}


function isSold(voucher) {
  return Boolean(voucher?.sold_at);
}


function canBeSold(voucher) {
  /*
   * READY means the voucher can be issued/sold.
   *
   * Selling the voucher does NOT change its lifecycle
   * status. sold_at records the commercial transaction.
   */
  return (
    voucher?.status === 'ready' &&
    !voucher?.sold_at
  );
}


function displayValidity(voucher) {
  const minutes = Number(voucher?.validity_minutes || 0);
  if (!minutes) return 'No expiry';
  if (minutes % 43200 === 0) return `${minutes / 43200} month(s)`;
  if (minutes % 1440 === 0) return `${minutes / 1440} day(s)`;
  if (minutes % 60 === 0) return `${minutes / 60} hour(s)`;
  return `${minutes} minute(s)`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function voucherSaleLabel(voucher) {
  if (voucher?.sold_at) {
    return 'Sold';
  }

  if (voucher?.status === 'ready') {
    return 'For sale';
  }

  if (voucher?.status === 'generated') {
    return 'Generated';
  }

  return '—';
}


/* =========================================================
   COMPONENT
========================================================= */

export default function Vouchers() {
  const { tenantId, currentTenant } = useTenant();

  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  const [rows, setRows] = useState([]);
  const [sites, setSites] = useState([]);
  const [plans, setPlans] = useState([]);
  const [devices, setDevices] = useState([]);


  /* -------------------------------------------------------
     FILTERS
  ------------------------------------------------------- */

  const [search, setSearch] =
    useState('');

  const [siteId, setSiteId] =
    useState('all');

  const [status, setStatus] =
    useState('all');


  /* -------------------------------------------------------
     UI STATE
  ------------------------------------------------------- */

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [open, setOpen] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  /*
   * Full plaintext passwords live only in this state
   * immediately after generation.
   */
  const [generated, setGenerated] =
    useState([]);


  /* -------------------------------------------------------
     GENERATION FORM
  ------------------------------------------------------- */

  const [form, setForm] = useState({
    plan_id: '',
    site_id: '',
    router_id: '',
    quantity: 10,
    mode: 'manual',
    vendor_name: '',
  });


  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function load() {
    if (!tenantId) {
      setRows([]);
      setSites([]);
      setPlans([]);
      setDevices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [
        voucherRows,
        siteRows,
        planRows,
        deviceRows,
      ] = await Promise.all([
        getVouchers(tenantId),
        getSites(tenantId),
        getPlans(tenantId),
        getDevices(tenantId),
      ]);

      setRows(voucherRows || []);
      setSites(siteRows || []);
      setPlans(planRows || []);
      setDevices(deviceRows || []);
    } catch (err) {
      console.error(
        'Voucher load error:',
        err,
      );

      setError(
        err?.message ||
          'Could not load vouchers.',
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    load();
  }, [tenantId]);


  /* =======================================================
     FILTER VOUCHERS
  ======================================================= */

  const filtered = useMemo(() => {
    const needle =
      search.trim().toLowerCase();

    return rows.filter(
      (voucher) => {
        const searchable = [
          voucher.username,
          voucher.password_last_four,
          voucher.plan_name,
          voucher.vendor_name,
          voucher.customer_name,
          voucher.customer_phone,
          voucher.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          !needle ||
          searchable.includes(needle);

        const matchesSite =
          siteId === 'all' ||
          voucher.site_id === siteId;

        const matchesStatus =
          status === 'all' ||
          voucher.status === status;

        return (
          matchesSearch &&
          matchesSite &&
          matchesStatus
        );
      },
    );
  }, [
    rows,
    search,
    siteId,
    status,
  ]);


  /* =======================================================
     STATISTICS
  ======================================================= */

  const readyCount = useMemo(
    () =>
      rows.filter(
        (voucher) =>
          voucher.status === 'ready' &&
          !voucher.sold_at,
      ).length,
    [rows],
  );


  const soldCount = useMemo(
    () =>
      rows.filter(
        (voucher) =>
          Boolean(voucher.sold_at),
      ).length,
    [rows],
  );


  const activeCount = useMemo(
    () =>
      rows.filter(
        (voucher) =>
          voucher.status === 'active',
      ).length,
    [rows],
  );


  const usedCount = useMemo(
    () =>
      rows.filter(
        (voucher) =>
          [
            'used',
            'expired',
          ].includes(
            voucher.status,
          ),
      ).length,
    [rows],
  );


  /* =======================================================
     GENERATE VOUCHERS
  ======================================================= */

  async function submit(event) {
    event.preventDefault();

    const plan = plans.find(
      (item) =>
        item.id === form.plan_id,
    );

    if (!plan) {
      setError(
        'Select an internet plan.',
      );

      return;
    }

    const quantity = Math.max(
      1,
      Math.min(
        500,
        Number(form.quantity) || 1,
      ),
    );

    try {
      setSaving(true);
      setError('');

      const data =
        await generateVouchers({
          tenantId,

          siteId:
            form.site_id,

          routerId:
            form.router_id,

          plan,

          quantity,

          mode:
            form.mode,

          vendorName:
            form.vendor_name,
        });

      /*
       * generateVouchers returns the one-time plaintext
       * password together with each created voucher.
       */
      setGenerated(
        data || [],
      );

      setOpen(false);

      await load();
    } catch (err) {
      console.error(
        'Voucher generation error:',
        err,
      );

      setError(
        err?.message ||
          'Could not generate vouchers.',
      );
    } finally {
      setSaving(false);
    }
  }


  /* =======================================================
     VOUCHER TEXT
  ======================================================= */

  function textFor(voucher) {
    const tenantName =
      currentTenant?.business_name ||
      currentTenant?.name ||
      'Your hotspot business';

    return [
      tenantName,
      'Internet Voucher',
      'Powered by CloudRouter',
      '',
      `Plan: ${voucher.plan_name || 'Internet Plan'}`,
      `Price: ${displayPrice(voucher)}`,
      `Validity: ${displayValidity(voucher)}`,
      `Username: ${voucher.username}`,
      `Password: ${displayPassword(voucher)}`,
    ].join('\n');
  }


  /* =======================================================
     PRINT
  ======================================================= */

  function printVouchers(list) {
    if (!list?.length) return;

    const tenantName =
      currentTenant?.business_name ||
      currentTenant?.name ||
      'Your hotspot business';

    const tenantLogo = currentTenant?.logo_url || '';
    const safeTenantName = escapeHtml(tenantName);
    const safeLogo = tenantLogo ? escapeHtml(tenantLogo) : '';

    const html = list.map((voucher) => `
      <div style="width:300px;display:inline-block;vertical-align:top;margin:10px;padding:18px;border:2px dashed #1d4ed8;border-radius:14px;font-family:Arial,sans-serif;color:#0f172a;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          ${safeLogo ? `<div style="width:48px;height:48px;border:1px solid #e2e8f0;border-radius:10px;padding:4px;background:#fff;"><img src="${safeLogo}" alt="${safeTenantName}" style="width:100%;height:100%;object-fit:contain;" /></div>` : `<div style="width:48px;height:48px;border-radius:10px;background:#1d4ed8;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;">CR</div>`}
          <div style="min-width:0;">
            <div style="font-size:17px;font-weight:800;line-height:1.2;">${safeTenantName}</div>
            <div style="color:#64748b;font-size:10px;margin-top:3px;">Internet Voucher</div>
          </div>
        </div>

        <div style="background:#eff6ff;border-radius:10px;padding:10px 12px;margin-bottom:12px;">
          <div style="font-size:15px;font-weight:800;color:#1e3a8a;">${escapeHtml(voucher.plan_name || 'Internet Plan')}</div>
          <div style="margin-top:4px;font-size:12px;color:#475569;">${escapeHtml(displayPrice(voucher))} • ${escapeHtml(displayValidity(voucher))}</div>
        </div>

        <div style="font-size:13px;line-height:1.9;">
          Username: <strong>${escapeHtml(voucher.username)}</strong><br>
          Password: <strong>${escapeHtml(displayPassword(voucher))}</strong>
        </div>

        <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b;display:flex;justify-content:space-between;gap:8px;">
          <span>Connect to ${safeTenantName}</span>
          <strong style="color:#1d4ed8;">Powered by CloudRouter</strong>
        </div>
      </div>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('The browser blocked the print window. Allow pop-ups and try again.');
      return;
    }

    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTenantName} Vouchers</title><style>body{padding:16px;background:#fff}@media print{body{padding:0}}</style></head><body>${html}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 350);
  }


  /* =======================================================
     SHARE
  ======================================================= */

  async function share(voucher) {
    const text =
      textFor(voucher);

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            `${currentTenant?.business_name || currentTenant?.name || 'CloudRouter'} voucher`,

          text,
        });

        return;
      }

      await navigator.clipboard.writeText(
        text,
      );

      window.alert(
        'Voucher copied to clipboard.',
      );
    } catch (err) {
      /*
       * Closing the phone share panel should not
       * show as a system error.
       */
      if (
        err?.name !==
        'AbortError'
      ) {
        setError(
          err?.message ||
            'Could not share voucher.',
        );
      }
    }
  }


  /* =======================================================
     RECORD SALE
  ======================================================= */

  async function sell(voucher) {
    if (!canBeSold(voucher)) {
      return;
    }

    const phone =
      window.prompt(
        'Customer phone number (optional):',
        '',
      );

    if (phone === null) {
      return;
    }

    const name =
      window.prompt(
        'Customer name (optional):',
        '',
      );

    if (name === null) {
      return;
    }

    try {
      setError('');

      await markVoucherSold(
        voucher.id,
        tenantId,
        {
          name:
            name.trim() || null,

          phone:
            phone.trim() || null,
        },
      );

      await load();
    } catch (err) {
      console.error(
        'Voucher sale error:',
        err,
      );

      setError(
        err?.message ||
          'Could not record voucher sale.',
      );
    }
  }


  /* =======================================================
     ROUTERS AVAILABLE FOR SELECTED SITE
  ======================================================= */

  const routerOptions =
    useMemo(
      () =>
        devices.filter(
          (device) => {
            const isRouter =
              device.device_type ===
                'router' ||
              device.device_type ===
                'mikrotik_router';

            const matchesSite =
              !form.site_id ||
              device.site_id ===
                form.site_id;

            return (
              isRouter &&
              matchesSite
            );
          },
        ),
      [
        devices,
        form.site_id,
      ],
    );


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">

      {/* ===================================================
          HEADER
      =================================================== */}

      <PageHeader
        eyebrow="Hotspot business"
        title="Vouchers"
        description="Generate prepaid internet vouchers from active plans, assign stock to sites or vendors, print batches, share credentials and record sales."
        actions={
          <button
            type="button"
            onClick={() => {
              setError('');

              const firstPlan =
                plans.find(
                  (plan) =>
                    plan.is_active !==
                    false,
                );

              setForm({
                plan_id:
                  firstPlan?.id ||
                  '',

                site_id:
                  sites[0]?.id ||
                  '',

                router_id:
                  '',

                quantity:
                  10,

                mode:
                  'manual',

                vendor_name:
                  '',
              });

              setOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <FiPlus />

            Generate vouchers
          </button>
        }
      />


      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}


      {/* ===================================================
          STATISTICS
      =================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

        <StatCard
          label="Total vouchers"
          value={
            rows.length
          }
        />

        <StatCard
          label="Ready for sale"
          value={
            readyCount
          }
        />

        <StatCard
          label="Sold"
          value={
            soldCount
          }
        />

        <StatCard
          label="Active"
          value={
            activeCount
          }
        />

        <StatCard
          label="Used / expired"
          value={
            usedCount
          }
        />

      </div>


      {/* ===================================================
          VOUCHER TABLE
      =================================================== */}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

        <Toolbar
          search={
            search
          }

          onSearch={
            setSearch
          }

          siteId={
            siteId
          }

          onSiteChange={
            setSiteId
          }

          sites={
            sites
          }

          status={
            status
          }

          onStatusChange={
            setStatus
          }

          statuses={[
            ...new Set(
              rows
                .map(
                  (voucher) =>
                    voucher.status,
                )
                .filter(Boolean),
            ),
          ]}

          loading={
            loading
          }

          onRefresh={
            load
          }
        />


        <div className="overflow-x-auto">

          <table className="min-w-full divide-y divide-slate-200">

            <thead className="bg-slate-50">

              <tr>

                {[
                  'Voucher',
                  'Plan',
                  'Site',
                  'Vendor',
                  'Lifecycle',
                  'Sale',
                  'Price',
                  'Actions',
                ].map(
                  (heading) => (
                    <th
                      key={
                        heading
                      }
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
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

                <EmptyRow
                  colSpan={
                    8
                  }
                  text="Loading vouchers…"
                />

              ) : filtered.length ===
                0 ? (

                <EmptyRow
                  colSpan={
                    8
                  }
                  text="No vouchers match the selected site, status or search."
                />

              ) : (

                filtered.map(
                  (voucher) => (

                    <tr
                      key={
                        voucher.id
                      }
                      className="transition hover:bg-slate-50"
                    >

                      {/* VOUCHER */}

                      <td className="px-5 py-4">

                        <div className="font-semibold text-slate-900">
                          {
                            voucher.username
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Password:{' '}
                          {displayPassword(
                            voucher,
                          )}
                        </div>

                      </td>


                      {/* PLAN */}

                      <td className="px-5 py-4 text-sm text-slate-700">

                        {
                          voucher.plan_name ||
                          '—'
                        }

                      </td>


                      {/* SITE */}

                      <td className="px-5 py-4">

                        <SiteBadge
                          siteId={
                            voucher.site_id
                          }
                          sites={
                            sites
                          }
                        />

                      </td>


                      {/* VENDOR */}

                      <td className="px-5 py-4 text-sm text-slate-700">

                        {
                          voucher.vendor_name ||
                          'Direct sale'
                        }

                      </td>


                      {/* LIFECYCLE */}

                      <td className="px-5 py-4">

                        <StatusBadge
                          value={
                            voucher.status
                          }
                        />

                      </td>


                      {/* SALE STATUS */}

                      <td className="px-5 py-4">

                        {isSold(
                          voucher,
                        ) ? (

                          <div>

                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">

                              <FiCheckCircle />

                              Sold

                            </span>

                            {voucher.customer_phone && (
                              <div className="mt-1 text-xs text-slate-500">
                                {
                                  voucher.customer_phone
                                }
                              </div>
                            )}

                          </div>

                        ) : (

                          <span className="text-xs font-semibold text-slate-500">
                            {
                              voucherSaleLabel(
                                voucher,
                              )
                            }
                          </span>

                        )}

                      </td>


                      {/* PRICE */}

                      <td className="px-5 py-4 text-sm font-semibold text-slate-800">

                        {displayPrice(
                          voucher,
                        )}

                      </td>


                      {/* ACTIONS */}

                      <td className="px-5 py-4">

                        <div className="flex flex-wrap gap-2">

                          <button
                            type="button"
                            title="Print voucher"
                            onClick={() =>
                              printVouchers([
                                voucher,
                              ])
                            }
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                          >
                            <FiPrinter />
                          </button>


                          <button
                            type="button"
                            title="Share voucher"
                            onClick={() =>
                              share(
                                voucher,
                              )
                            }
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                          >
                            <FiShare2 />
                          </button>


                          <a
                            title="Send voucher by SMS"
                            href={`sms:${
                              voucher.customer_phone ||
                              ''
                            }?body=${encodeURIComponent(
                              textFor(
                                voucher,
                              ),
                            )}`}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                          >
                            <FiMessageSquare />
                          </a>


                          {canBeSold(
                            voucher,
                          ) && (

                            <button
                              type="button"
                              title="Record voucher sale"
                              onClick={() =>
                                sell(
                                  voucher,
                                )
                              }
                              className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 transition hover:bg-emerald-100"
                            >
                              <FiShoppingBag />
                            </button>

                          )}

                        </div>

                      </td>

                    </tr>

                  ),
                )

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* ===================================================
          GENERATE MODAL
      =================================================== */}

      <Modal
        open={
          open
        }
        title="Generate vouchers"
        onClose={() =>
          setOpen(false)
        }
      >

        <form
          onSubmit={
            submit
          }
          className="grid gap-4 sm:grid-cols-2"
        >

          {/* PLAN */}

          <label className="text-sm font-semibold text-slate-700">

            Internet plan

            <select
              value={
                form.plan_id
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    plan_id:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
            >

              <option value="">
                Select plan
              </option>

              {plans
                .filter(
                  (plan) =>
                    plan.is_active !==
                    false,
                )
                .map(
                  (plan) => (

                    <option
                      key={
                        plan.id
                      }
                      value={
                        plan.id
                      }
                    >

                      {
                        plan.name
                      }{' '}
                      —{' '}
                      {
                        plan.currency_code ||
                        'GHS'
                      }{' '}
                      {Number(
                        plan.price ||
                          0,
                      ).toFixed(
                        2,
                      )}

                    </option>

                  ),
                )}

            </select>

          </label>


          {/* SITE */}

          <label className="text-sm font-semibold text-slate-700">

            Network site

            <select
              value={
                form.site_id
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    site_id:
                      event
                        .target
                        .value,

                    router_id:
                      '',
                  }),
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
            >

              <option value="">
                Unassigned
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

          </label>


          {/* ROUTER */}

          <label className="text-sm font-semibold text-slate-700">

            Router

            <select
              value={
                form.router_id
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    router_id:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
            >

              <option value="">
                Select Router
              </option>

              {routerOptions.map(
                (device) => (

                  <option
                    key={
                      device.id
                    }
                    value={
                      device.id
                    }
                  >
                    {
                      device.name
                    }
                  </option>

                ),
              )}

            </select>

          </label>


          {/* QUANTITY */}

          <label className="text-sm font-semibold text-slate-700">

            Quantity

            <input
              type="number"
              min="1"
              max="500"
              value={
                form.quantity
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    quantity:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
            />

          </label>


          {/* MODE */}

          <label className="text-sm font-semibold text-slate-700">

            Generation mode

            <select
              value={
                form.mode
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    mode:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
            >

              <option value="manual">
                Manual batch
              </option>

              <option value="automatic">
                Automatic stock batch
              </option>

            </select>

          </label>


          {/* VENDOR */}

          <label className="text-sm font-semibold text-slate-700">

            Vendor / agent

            <input
              value={
                form.vendor_name
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    current,
                  ) => ({
                    ...current,

                    vendor_name:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
              placeholder="Optional vendor name"
            />

          </label>


          {/* SECURITY NOTICE */}

          <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">

            The complete voucher password
            is shown only immediately after
            generation. Print or share the
            vouchers before closing the
            generated batch window.

          </div>


          {/* BUTTONS */}

          <div className="sm:col-span-2 flex justify-end gap-2">

            <button
              type="button"
              onClick={() =>
                setOpen(
                  false,
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700"
            >
              Cancel
            </button>


            <button
              type="submit"
              disabled={
                saving
              }
              className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? 'Generating…'
                : 'Generate batch'}
            </button>

          </div>

        </form>

      </Modal>


      {/* ===================================================
          GENERATED BATCH MODAL
      =================================================== */}

      <Modal
        open={
          generated.length >
          0
        }
        title={`${generated.length} vouchers generated`}
        onClose={() =>
          setGenerated([])
        }
        wide
      >

        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">

          <strong>
            Save these credentials now.
          </strong>

          {' '}

          The complete passwords are
          available only in this generated
          batch window.

        </div>


        <div className="mb-4 flex flex-wrap justify-end gap-2">

          <button
            type="button"
            onClick={() =>
              printVouchers(
                generated,
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            <FiPrinter />

            Print complete batch
          </button>

        </div>


        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

          {generated.map(
            (voucher) => (

              <div
                key={
                  voucher.id
                }
                className="rounded-2xl border border-dashed border-blue-300 bg-white p-4 shadow-sm"
              >

                <p className="font-bold text-blue-950">
                  {
                    voucher.plan_name
                  }
                </p>


                <p className="mt-3 text-sm leading-7 text-slate-700">

                  Username:{' '}

                  <b className="text-slate-950">
                    {
                      voucher.username
                    }
                  </b>

                  <br />

                  Password:{' '}

                  <b className="text-slate-950">
                    {
                      voucher.password
                    }
                  </b>

                  <br />

                  Price:{' '}

                  <b className="text-slate-950">
                    {displayPrice(
                      voucher,
                    )}
                  </b>

                </p>


                <div className="mt-4 flex gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      printVouchers([
                        voucher,
                      ])
                    }
                    className="rounded-lg border border-slate-200 p-2"
                    title="Print voucher"
                  >
                    <FiPrinter />
                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      share(
                        voucher,
                      )
                    }
                    className="rounded-lg border border-slate-200 p-2"
                    title="Share voucher"
                  >
                    <FiShare2 />
                  </button>

                </div>

              </div>

            ),
          )}

        </div>

      </Modal>

    </div>
  );
}