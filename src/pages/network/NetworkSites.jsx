import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiServer,
  FiStar,
  FiTrash2,
  FiUsers,
  FiWifi,
  FiX,
  FiXCircle,
} from 'react-icons/fi';

import {
  createNetworkSite,
  deleteNetworkSite,
  setNetworkSiteStatus,
  updateNetworkSite,
} from '../../services/networkSiteService';

import {
  getSiteNetworkOverview,
} from '../../services/operationsService';

import { useTenant } from '../../hooks/useTenant';


const emptyForm = {
  name: '',
  code: '',
  description: '',
  address: '',
  city: '',
  region: '',
  country: 'Ghana',
  latitude: '',
  longitude: '',
  is_primary: false,
  is_active: true,
};


/* =========================================================
   TIME HELPERS
========================================================= */

function formatLastSeen(value) {
  if (!value) {
    return 'Never connected';
  }

  const timestamp =
    new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 'Unknown';
  }

  const difference =
    Date.now() - timestamp;

  const seconds =
    Math.floor(difference / 1000);

  if (seconds < 60) {
    return `${Math.max(
      seconds,
      0,
    )} sec ago`;
  }

  const minutes =
    Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr${
      hours === 1 ? '' : 's'
    } ago`;
  }

  const days =
    Math.floor(hours / 24);

  return `${days} day${
    days === 1 ? '' : 's'
  } ago`;
}


/* =========================================================
   MAIN PAGE
========================================================= */

function NetworkSites() {
  const { tenantId } = useTenant();

  const [sites, setSites] =
    useState([]);

  const [form, setForm] =
    useState(emptyForm);

  const [
    editingSiteId,
    setEditingSiteId,
  ] = useState(null);

  const [
    searchText,
    setSearchText,
  ] = useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('all');

  const [
    showModal,
    setShowModal,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    busySiteId,
    setBusySiteId,
  ] = useState(null);

  const [
    statusMessage,
    setStatusMessage,
  ] = useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');


  /* =======================================================
     LOAD SITES + NETWORK INFORMATION
  ======================================================= */

  async function loadSites() {
    if (!tenantId) {
      setSites([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const data =
        await getSiteNetworkOverview(
          tenantId,
        );

      setSites(
        Array.isArray(data)
          ? data
          : [],
      );
    } catch (error) {
      console.error(
        'Network site load error:',
        error,
      );

      setErrorMessage(
        error?.message ||
          'Failed to load network sites.',
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadSites();

    /*
     * Refresh every 30 seconds so network
     * status follows router heartbeat.
     */
    const timer =
      window.setInterval(
        loadSites,
        30000,
      );

    return () => {
      window.clearInterval(timer);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);


  /* =======================================================
     FILTERS
  ======================================================= */

  const filteredSites =
    useMemo(() => {
      const term =
        searchText
          .trim()
          .toLowerCase();

      return sites.filter(
        (site) => {
          const matchesStatus =
            statusFilter === 'all' ||
            site.operational_status ===
              statusFilter;

          const haystack = [
            site.name,
            site.code,
            site.address,
            site.city,
            site.region,
            site.country,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          const matchesSearch =
            !term ||
            haystack.includes(term);

          return (
            matchesStatus &&
            matchesSearch
          );
        },
      );
    }, [
      sites,
      searchText,
      statusFilter,
    ]);


  /* =======================================================
     SUMMARY COUNTS
  ======================================================= */

  const totals =
    useMemo(
      () => ({
        total:
          sites.length,

        online:
          sites.filter(
            (site) =>
              site.operational_status ===
              'online',
          ).length,

        needsSetup:
          sites.filter(
            (site) =>
              [
                'needs_setup',
                'not_connected',
              ].includes(
                site.operational_status,
              ),
          ).length,

        offline:
          sites.filter(
            (site) =>
              [
                'offline',
                'warning',
              ].includes(
                site.operational_status,
              ),
          ).length,

        enabled:
          sites.filter(
            (site) => site.is_active,
          ).length,

        disabled:
          sites.filter(
            (site) => !site.is_active,
          ).length,

        routers:
          sites.reduce(
            (sum, site) =>
              sum +
              Number(
                site.router_count || 0,
              ),
            0,
          ),

        aps:
          sites.reduce(
            (sum, site) =>
              sum +
              Number(
                site.access_point_count ||
                  0,
              ),
            0,
          ),

        users:
          sites.reduce(
            (sum, site) =>
              sum +
              Number(
                site.active_hotspot_users ||
                  0,
              ),
            0,
          ),
      }),
      [sites],
    );


  /* =======================================================
     FORM
  ======================================================= */

  function openCreateModal() {
    setEditingSiteId(null);

    setForm(emptyForm);

    setErrorMessage('');
    setStatusMessage('');

    setShowModal(true);
  }


  function openEditModal(site) {
    setEditingSiteId(site.id);

    setForm({
      name:
        site.name ?? '',

      code:
        site.code ?? '',

      description:
        site.description ?? '',

      address:
        site.address ?? '',

      city:
        site.city ?? '',

      region:
        site.region ?? '',

      country:
        site.country ??
        'Ghana',

      latitude:
        site.latitude ?? '',

      longitude:
        site.longitude ?? '',

      is_primary:
        Boolean(
          site.is_primary,
        ),

      is_active:
        Boolean(
          site.is_active,
        ),
    });

    setErrorMessage('');
    setStatusMessage('');

    setShowModal(true);
  }


  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);

    setEditingSiteId(null);

    setForm(emptyForm);
  }


  function handleChange(event) {
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


  function validateForm() {
    if (!form.name.trim()) {
      return 'Site name is required.';
    }

    if (
      form.latitude !== ''
    ) {
      const latitude =
        Number(form.latitude);

      if (
        Number.isNaN(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        return 'Latitude must be between -90 and 90.';
      }
    }

    if (
      form.longitude !== ''
    ) {
      const longitude =
        Number(form.longitude);

      if (
        Number.isNaN(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return 'Longitude must be between -180 and 180.';
      }
    }

    const duplicateCode =
      sites.some(
        (site) =>
          site.id !==
            editingSiteId &&
          form.code.trim() &&
          site.code?.toLowerCase() ===
            form.code
              .trim()
              .toLowerCase(),
      );

    if (duplicateCode) {
      return 'Another site already uses this site code.';
    }

    return null;
  }


  async function handleSubmit(
    event,
  ) {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setErrorMessage(
        validationError,
      );

      return;
    }

    try {
      setSaving(true);

      setErrorMessage('');
      setStatusMessage('');

      if (editingSiteId) {
        await updateNetworkSite(
          editingSiteId,
          form,
        );

        setStatusMessage(
          'Network site updated successfully.',
        );
      } else {
        await createNetworkSite(
          form,
        );

        setStatusMessage(
          'Network site created successfully.',
        );
      }

      setShowModal(false);

      setEditingSiteId(null);

      setForm(emptyForm);

      await loadSites();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          'Failed to save the network site.',
      );
    } finally {
      setSaving(false);
    }
  }


  /* =======================================================
     ENABLE / DISABLE
  ======================================================= */

  async function handleToggleStatus(
    site,
  ) {
    try {
      setBusySiteId(site.id);

      setErrorMessage('');
      setStatusMessage('');

      await setNetworkSiteStatus(
        site.id,
        !site.is_active,
      );

      setStatusMessage(
        site.is_active
          ? `${site.name} has been disabled.`
          : `${site.name} has been enabled.`,
      );

      await loadSites();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          'Failed to update site status.',
      );
    } finally {
      setBusySiteId(null);
    }
  }


  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete(site) {
    const confirmed =
      window.confirm(
        `Delete ${site.name}? This will fail if routers, access points, vouchers or other records still depend on this site.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusySiteId(site.id);

      setErrorMessage('');
      setStatusMessage('');

      await deleteNetworkSite(
        site.id,
      );

      setStatusMessage(
        `${site.name} has been deleted.`,
      );

      await loadSites();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          'This site could not be deleted. Disable it instead if related records already exist.',
      );
    } finally {
      setBusySiteId(null);
    }
  }


  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-100">
              <FiMapPin />

              Network Infrastructure
            </div>

            <h1 className="text-3xl font-bold">
              Network Sites
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Manage every hotspot
              location and see its
              actual network condition,
              equipment and connected
              users.
            </p>
          </div>

          <button
            type="button"
            onClick={
              openCreateModal
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
          >
            <FiPlus />

            Add Network Site
          </button>
        </div>
      </div>


      {/* MESSAGES */}

      {statusMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {statusMessage}
        </div>
      )}

      {errorMessage &&
        !showModal && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}


      {/* SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <SummaryCard
          label="Total Sites"
          value={totals.total}
          icon={<FiMapPin />}
          tone="blue"
          subtitle={`${totals.enabled} enabled`}
        />

        <SummaryCard
          label="Online Sites"
          value={totals.online}
          icon={
            <FiCheckCircle />
          }
          tone="green"
          subtitle="Reporting normally"
        />

        <SummaryCard
          label="Needs Setup"
          value={totals.needsSetup}
          icon={
            <FiAlertTriangle />
          }
          tone="amber"
          subtitle="No live router yet"
        />

        <SummaryCard
          label="Offline / Warning"
          value={totals.offline}
          icon={<FiXCircle />}
          tone="red"
          subtitle="Needs attention"
        />

      </div>


      {/* NETWORK TOTALS */}

      <div className="grid gap-4 md:grid-cols-3">

        <MiniMetric
          icon={<FiServer />}
          label="Registered Routers"
          value={totals.routers}
        />

        <MiniMetric
          icon={<FiWifi />}
          label="Access Points"
          value={totals.aps}
        />

        <MiniMetric
          icon={<FiUsers />}
          label="Active Hotspot Users"
          value={totals.users}
        />

      </div>


      {/* SITE TABLE */}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="relative w-full lg:max-w-md">

            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value,
                )
              }
              placeholder="Search site, code, city or region"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

          </div>


          <div className="flex flex-col gap-2 sm:flex-row">

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">
                All network statuses
              </option>

              <option value="online">
                Online
              </option>

              <option value="needs_setup">
                Needs Setup
              </option>

              <option value="not_connected">
                Not Connected
              </option>

              <option value="warning">
                Warning
              </option>

              <option value="offline">
                Offline
              </option>

              <option value="disabled">
                Disabled
              </option>

            </select>


            <button
              type="button"
              onClick={loadSites}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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

          </div>
        </div>


        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
            <FiRefreshCw className="mr-2 animate-spin" />

            Loading network sites...
          </div>
        ) : filteredSites.length ===
          0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">

            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <FiMapPin className="h-7 w-7" />
            </div>

            <h2 className="font-semibold text-slate-900">
              No network sites found
            </h2>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              Add a hotspot location
              or change the current
              filter.
            </p>

          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="min-w-full divide-y divide-slate-200">

              <thead className="bg-slate-50">

                <tr>
                  <TableHeading>
                    Site
                  </TableHeading>

                  <TableHeading>
                    Location
                  </TableHeading>

                  <TableHeading>
                    Routers
                  </TableHeading>

                  <TableHeading>
                    APs
                  </TableHeading>

                  <TableHeading>
                    Active Users
                  </TableHeading>

                  <TableHeading>
                    Network Status
                  </TableHeading>

                  <TableHeading>
                    Last Contact
                  </TableHeading>

                  <TableHeading align="right">
                    Actions
                  </TableHeading>
                </tr>

              </thead>


              <tbody className="divide-y divide-slate-100">

                {filteredSites.map(
                  (site) => (
                    <tr
                      key={site.id}
                      className="transition hover:bg-blue-50/30"
                    >

                      {/* SITE */}

                      <td className="px-4 py-4">

                        <div className="flex min-w-[190px] items-center gap-3">

                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <FiMapPin />
                          </div>

                          <div>

                            <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">

                              {site.name}

                              {site.is_primary && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                  <FiStar />

                                  Primary
                                </span>
                              )}

                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {site.code ||
                                'No site code'}
                            </p>

                          </div>
                        </div>

                      </td>


                      {/* LOCATION */}

                      <td className="px-4 py-4 text-sm text-slate-600">

                        <p>
                          {[
                            site.city,
                            site.region,
                          ]
                            .filter(Boolean)
                            .join(', ') ||
                            'Not specified'}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {site.address ||
                            site.country ||
                            '—'}
                        </p>

                      </td>


                      {/* ROUTERS */}

                      <td className="px-4 py-4">

                        <EquipmentMetric
                          icon={
                            <FiServer />
                          }
                          value={
                            site.router_count
                          }
                          secondary={
                            site.router_count >
                            0
                              ? `${site.online_router_count} online`
                              : 'None'
                          }
                        />

                      </td>


                      {/* APS */}

                      <td className="px-4 py-4">

                        <EquipmentMetric
                          icon={<FiWifi />}
                          value={
                            site.access_point_count
                          }
                          secondary={
                            site.access_point_count >
                            0
                              ? 'Registered'
                              : 'None'
                          }
                        />

                      </td>


                      {/* USERS */}

                      <td className="px-4 py-4">

                        <div className="flex items-center gap-2">

                          <FiUsers className="text-violet-500" />

                          <span className="font-bold text-slate-900">
                            {site.active_hotspot_users ||
                              0}
                          </span>

                        </div>

                      </td>


                      {/* STATUS */}

                      <td className="whitespace-nowrap px-4 py-4">

                        <OperationalStatusBadge
                          status={
                            site.operational_status
                          }
                        />

                        {!site.is_active && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            Site disabled
                          </div>
                        )}

                      </td>


                      {/* LAST CONTACT */}

                      <td className="whitespace-nowrap px-4 py-4">

                        <div className="flex items-center gap-2 text-sm text-slate-600">

                          <FiClock className="text-slate-400" />

                          {formatLastSeen(
                            site.last_seen_at,
                          )}

                        </div>

                      </td>


                      {/* ACTIONS */}

                      <td className="whitespace-nowrap px-4 py-4 text-right">

                        <div className="inline-flex items-center gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                site,
                              )
                            }
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-blue-600"
                            title="Edit site"
                          >
                            <FiEdit2 />
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              handleToggleStatus(
                                site,
                              )
                            }
                            disabled={
                              busySiteId ===
                              site.id
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                          >
                            {site.is_active
                              ? 'Disable'
                              : 'Enable'}
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                site,
                              )
                            }
                            disabled={
                              busySiteId ===
                              site.id
                            }
                            className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                            title="Delete site"
                          >
                            <FiTrash2 />
                          </button>

                        </div>

                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>


      {/* MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingSiteId
                    ? 'Edit Network Site'
                    : 'Add Network Site'}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the physical
                  location details for
                  this hotspot site.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>

            </div>


            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5"
            >

              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}


              <div className="grid gap-4 md:grid-cols-2">

                <FormField
                  label="Site Name"
                  required
                >
                  <input
                    name="name"
                    value={form.name}
                    onChange={
                      handleChange
                    }
                    className="form-input"
                    placeholder="Main Hotspot"
                  />
                </FormField>


                <FormField label="Site Code">

                  <input
                    name="code"
                    value={form.code}
                    onChange={
                      handleChange
                    }
                    className="form-input uppercase"
                    placeholder="MAIN-POP"
                  />

                </FormField>

              </div>


              <FormField label="Description">

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  rows="3"
                  className="form-input resize-y"
                  placeholder="Describe the coverage area or purpose of this site."
                />

              </FormField>


              <FormField label="Street Address">

                <input
                  name="address"
                  value={form.address}
                  onChange={
                    handleChange
                  }
                  className="form-input"
                  placeholder="Street, building or landmark"
                />

              </FormField>


              <div className="grid gap-4 md:grid-cols-3">

                <FormField label="City">

                  <input
                    name="city"
                    value={form.city}
                    onChange={
                      handleChange
                    }
                    className="form-input"
                    placeholder="Kumasi"
                  />

                </FormField>


                <FormField label="Region">

                  <input
                    name="region"
                    value={form.region}
                    onChange={
                      handleChange
                    }
                    className="form-input"
                    placeholder="Ashanti"
                  />

                </FormField>


                <FormField label="Country">

                  <input
                    name="country"
                    value={form.country}
                    onChange={
                      handleChange
                    }
                    className="form-input"
                    placeholder="Ghana"
                  />

                </FormField>

              </div>


              <div className="grid gap-4 md:grid-cols-2">

                <FormField label="Latitude">

                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={
                      form.latitude
                    }
                    onChange={
                      handleChange
                    }
                    className="form-input"
                    placeholder="6.6885"
                  />

                </FormField>


                <FormField label="Longitude">

                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={
                      form.longitude
                    }
                    onChange={
                      handleChange
                    }
                    className="form-input"
                    placeholder="-1.6244"
                  />

                </FormField>

              </div>


              <div className="grid gap-3 md:grid-cols-2">

                <CheckboxField
                  name="is_primary"
                  checked={
                    form.is_primary
                  }
                  onChange={
                    handleChange
                  }
                  title="Primary network site"
                  description="Marks this location as the tenant's principal hotspot site."
                  icon={<FiStar />}
                />


                <CheckboxField
                  name="is_active"
                  checked={
                    form.is_active
                  }
                  onChange={
                    handleChange
                  }
                  title="Enable site"
                  description="Allows CloudRouter to use this location. Network online status is detected automatically."
                  icon={
                    <FiCheckCircle />
                  }
                />

              </div>


              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving && (
                    <FiRefreshCw className="animate-spin" />
                  )}

                  {editingSiteId
                    ? 'Save Changes'
                    : 'Create Site'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      <style>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          padding: 0.7rem 0.85rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
          background: white;
        }

        .form-input:focus {
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 3px rgb(219 234 254);
        }
      `}</style>

    </div>
  );
}


/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  tone = 'blue',
}) {
  const tones = {
    blue:
      'bg-blue-50 text-blue-600',

    green:
      'bg-emerald-50 text-emerald-600',

    amber:
      'bg-amber-50 text-amber-600',

    red:
      'bg-red-50 text-red-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start justify-between">

        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   MINI METRIC
========================================================= */

function MiniMetric({
  icon,
  label,
  value,
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-blue-600">
        {icon}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>

        <p className="text-xl font-bold text-slate-900">
          {value}
        </p>
      </div>

    </div>
  );
}


/* =========================================================
   EQUIPMENT METRIC
========================================================= */

function EquipmentMetric({
  icon,
  value,
  secondary,
}) {
  return (
    <div>

      <div className="flex items-center gap-2 text-sm">

        <span className="text-blue-500">
          {icon}
        </span>

        <span className="font-bold text-slate-900">
          {value || 0}
        </span>

      </div>

      <div className="mt-1 text-[11px] text-slate-400">
        {secondary}
      </div>

    </div>
  );
}


/* =========================================================
   NETWORK STATUS
========================================================= */

function OperationalStatusBadge({
  status,
}) {
  const config = {
    online: {
      text: 'Online',
      className:
        'bg-emerald-50 text-emerald-700 ring-emerald-200',
    },

    needs_setup: {
      text: 'Needs Setup',
      className:
        'bg-amber-50 text-amber-700 ring-amber-200',
    },

    not_connected: {
      text: 'Not Connected',
      className:
        'bg-orange-50 text-orange-700 ring-orange-200',
    },

    warning: {
      text: 'Warning',
      className:
        'bg-yellow-50 text-yellow-700 ring-yellow-200',
    },

    offline: {
      text: 'Offline',
      className:
        'bg-red-50 text-red-700 ring-red-200',
    },

    disabled: {
      text: 'Disabled',
      className:
        'bg-slate-100 text-slate-600 ring-slate-200',
    },
  };

  const current =
    config[status] ||
    config.needs_setup;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${current.className}`}
    >
      {current.text}
    </span>
  );
}


/* =========================================================
   TABLE HEADING
========================================================= */

function TableHeading({
  children,
  align = 'left',
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        align === 'right'
          ? 'text-right'
          : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}


/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  required = false,
  children,
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-sm font-semibold text-slate-700">

        {label}

        {required && (
          <span className="text-red-500">
            {' '}*
          </span>
        )}

      </span>

      {children}

    </label>
  );
}


/* =========================================================
   CHECKBOX
========================================================= */

function CheckboxField({
  name,
  checked,
  onChange,
  title,
  description,
  icon,
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">

      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
      />

      <span className="text-blue-600">
        {icon}
      </span>

      <span>

        <span className="block text-sm font-semibold text-slate-800">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>

      </span>

    </label>
  );
}


export default NetworkSites;