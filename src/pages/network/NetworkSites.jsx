import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiEdit2,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import {
  createNetworkSite,
  deleteNetworkSite,
  getNetworkSites,
  setNetworkSiteStatus,
  updateNetworkSite,
} from "../../services/networkSiteService";

const emptyForm = {
  name: "",
  code: "",
  description: "",
  address: "",
  city: "",
  region: "",
  country: "Ghana",
  latitude: "",
  longitude: "",
  is_primary: false,
  is_active: true,
};

function NetworkSites() {
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySiteId, setBusySiteId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadSites() {
    try {
      setLoading(true);
      setErrorMessage("");
      const data = await getNetworkSites();
      setSites(data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load network sites.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  const filteredSites = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    return sites.filter((site) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && site.is_active) ||
        (statusFilter === "inactive" && !site.is_active);

      const haystack = [
        site.name,
        site.code,
        site.address,
        site.city,
        site.region,
        site.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [sites, searchText, statusFilter]);

  const totals = useMemo(
    () => ({
      total: sites.length,
      active: sites.filter((site) => site.is_active).length,
      inactive: sites.filter((site) => !site.is_active).length,
      primary: sites.filter((site) => site.is_primary).length,
    }),
    [sites]
  );

  function openCreateModal() {
    setEditingSiteId(null);
    setForm(emptyForm);
    setErrorMessage("");
    setStatusMessage("");
    setShowModal(true);
  }

  function openEditModal(site) {
    setEditingSiteId(site.id);
    setForm({
      name: site.name ?? "",
      code: site.code ?? "",
      description: site.description ?? "",
      address: site.address ?? "",
      city: site.city ?? "",
      region: site.region ?? "",
      country: site.country ?? "Ghana",
      latitude: site.latitude ?? "",
      longitude: site.longitude ?? "",
      is_primary: Boolean(site.is_primary),
      is_active: Boolean(site.is_active),
    });
    setErrorMessage("");
    setStatusMessage("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingSiteId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function validateForm() {
    if (!form.name.trim()) return "Site name is required.";

    if (form.latitude !== "") {
      const latitude = Number(form.latitude);
      if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
        return "Latitude must be between -90 and 90.";
      }
    }

    if (form.longitude !== "") {
      const longitude = Number(form.longitude);
      if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
        return "Longitude must be between -180 and 180.";
      }
    }

    const duplicateCode = sites.some(
      (site) =>
        site.id !== editingSiteId &&
        form.code.trim() &&
        site.code?.toLowerCase() === form.code.trim().toLowerCase()
    );

    if (duplicateCode) return "Another site already uses this site code.";

    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setStatusMessage("");

      if (editingSiteId) {
        await updateNetworkSite(editingSiteId, form);
        setStatusMessage("Network site updated successfully.");
      } else {
        await createNetworkSite(form);
        setStatusMessage("Network site created successfully.");
      }

      setShowModal(false);
      setEditingSiteId(null);
      setForm(emptyForm);
      await loadSites();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save the network site.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(site) {
    try {
      setBusySiteId(site.id);
      setErrorMessage("");
      setStatusMessage("");
      await setNetworkSiteStatus(site.id, !site.is_active);
      setStatusMessage(
        site.is_active
          ? `${site.name} has been deactivated.`
          : `${site.name} has been activated.`
      );
      await loadSites();
    } catch (error) {
      setErrorMessage(error.message || "Failed to update site status.");
    } finally {
      setBusySiteId(null);
    }
  }

  async function handleDelete(site) {
    const confirmed = window.confirm(
      `Delete ${site.name}? This will fail if routers or other records still depend on this site.`
    );

    if (!confirmed) return;

    try {
      setBusySiteId(site.id);
      setErrorMessage("");
      setStatusMessage("");
      await deleteNetworkSite(site.id);
      setStatusMessage(`${site.name} has been deleted.`);
      await loadSites();
    } catch (error) {
      setErrorMessage(
        error.message ||
          "This site could not be deleted. Deactivate it if related records already exist."
      );
    } finally {
      setBusySiteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
            <FiMapPin />
            Network Infrastructure
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Network Sites</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage branches, hotspot locations and points of presence.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <FiPlus />
          Add Network Site
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {statusMessage}
        </div>
      )}

      {errorMessage && !showModal && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Sites" value={totals.total} />
        <SummaryCard label="Active Sites" value={totals.active} />
        <SummaryCard label="Inactive Sites" value={totals.inactive} />
        <SummaryCard label="Primary Site" value={totals.primary} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search name, code, city or region"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              onClick={loadSites}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
            <FiRefreshCw className="mr-2 animate-spin" />
            Loading network sites...
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <FiMapPin className="h-6 w-6" />
            </div>
            <h2 className="font-semibold text-slate-900">No network sites found</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Add your first physical hotspot location or change the current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>Site</TableHeading>
                  <TableHeading>Location</TableHeading>
                  <TableHeading>Status</TableHeading>
                  <TableHeading>GPS</TableHeading>
                  <TableHeading align="right">Actions</TableHeading>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <FiMapPin />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            {site.name}
                            {site.is_primary && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                <FiStar /> Primary
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{site.code || "No site code"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      <p>{[site.city, site.region].filter(Boolean).join(", ") || "Not specified"}</p>
                      <p className="text-xs text-slate-400">{site.address || site.country}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <StatusBadge active={site.is_active} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {site.latitude !== null && site.longitude !== null
                        ? `${site.latitude}, ${site.longitude}`
                        : "Not captured"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(site)}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                          aria-label={`Edit ${site.name}`}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(site)}
                          disabled={busySiteId === site.id}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {site.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(site)}
                          disabled={busySiteId === site.id}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                          aria-label={`Delete ${site.name}`}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingSiteId ? "Edit Network Site" : "Add Network Site"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the physical location details for this hotspot site.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close site form"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Site Name" required>
                  <input name="name" value={form.name} onChange={handleChange} className="form-input" placeholder="Main Office" />
                </FormField>
                <FormField label="Site Code">
                  <input name="code" value={form.code} onChange={handleChange} className="form-input uppercase" placeholder="MAIN-POP" />
                </FormField>
              </div>

              <FormField label="Description">
                <textarea name="description" value={form.description} onChange={handleChange} rows="3" className="form-input resize-y" placeholder="Describe the coverage area or purpose of this site." />
              </FormField>

              <FormField label="Street Address">
                <input name="address" value={form.address} onChange={handleChange} className="form-input" placeholder="Street, building or landmark" />
              </FormField>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField label="City">
                  <input name="city" value={form.city} onChange={handleChange} className="form-input" placeholder="Kumasi" />
                </FormField>
                <FormField label="Region">
                  <input name="region" value={form.region} onChange={handleChange} className="form-input" placeholder="Ashanti" />
                </FormField>
                <FormField label="Country">
                  <input name="country" value={form.country} onChange={handleChange} className="form-input" placeholder="Ghana" />
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Latitude">
                  <input type="number" step="any" name="latitude" value={form.latitude} onChange={handleChange} className="form-input" placeholder="6.6885" />
                </FormField>
                <FormField label="Longitude">
                  <input type="number" step="any" name="longitude" value={form.longitude} onChange={handleChange} className="form-input" placeholder="-1.6244" />
                </FormField>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <CheckboxField
                  name="is_primary"
                  checked={form.is_primary}
                  onChange={handleChange}
                  title="Primary network site"
                  description="Marks this as the tenant's principal operating site."
                  icon={<FiStar />}
                />
                <CheckboxField
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                  title="Active site"
                  description="Allows this site to be used for network operations."
                  icon={<FiCheckCircle />}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeModal} disabled={saving} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving && <FiRefreshCw className="animate-spin" />}
                  {editingSiteId ? "Save Changes" : "Create Site"}
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
        }
        .form-input:focus {
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 3px rgb(219 234 254);
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function TableHeading({ children, align = "left" }) {
  const alignmentClass = align === "right" ? "text-right" : "text-left";

  return (
    <th className={`px-4 py-3 ${alignmentClass} text-xs font-semibold uppercase tracking-wide text-slate-500`}>
      {children}
    </th>
  );
}

function FormField({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function CheckboxField({ name, checked, onChange, title, description, icon }) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" />
      <span className="text-blue-600">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
  );
}

export default NetworkSites;
