import { useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiWifi,
  FiX,
} from "react-icons/fi";

import {
  createHotspotPlan,
  getHotspotPlans,
  hotspotPlanCodeExists,
  setHotspotPlanStatus,
  updateHotspotPlan,
} from "../../services/hotspotPlanService";

const emptyForm = {
  name: "",
  code: "",
  description: "",
  price: "",
  currency_code: "GHS",
  data_limit_bytes: "",
  time_limit_minutes: "",
  validity_minutes: "",
  download_speed_kbps: "",
  upload_speed_kbps: "",
  shared_users: 1,
  mikrotik_profile_name: "",
  display_order: 0,
  is_public: true,
  is_active: true,
};

function bytesToReadable(bytes) {
  if (!bytes) return "Unlimited";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 10 || Number.isInteger(value)
    ? 0
    : 1;

  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function minutesToReadable(minutes) {
  if (!minutes) return "No expiry";

  const value = Number(minutes);

  if (value % 43200 === 0) {
    return `${value / 43200} month(s)`;
  }

  if (value % 1440 === 0) {
    return `${value / 1440} day(s)`;
  }

  if (value % 60 === 0) {
    return `${value / 60} hour(s)`;
  }

  return `${value} minute(s)`;
}

function kbpsToReadable(kbps) {
  if (!kbps) return "Unlimited";

  const value = Number(kbps);

  if (value >= 1024) {
    const mbps = value / 1024;
    return `${Number.isInteger(mbps) ? mbps : mbps.toFixed(1)} Mbps`;
  }

  return `${value} Kbps`;
}

function InternetPlans() {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingPlanId, setEditingPlanId] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadPlans() {
    try {
      setLoading(true);
      setErrorMessage("");

      const data = await getHotspotPlans();
      setPlans(data);
    } catch (error) {
      setErrorMessage(
        error.message || "Failed to load internet plans."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  const filteredPlans = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    if (!term) {
      return plans;
    }

    return plans.filter((plan) => {
      return (
        plan.name?.toLowerCase().includes(term) ||
        plan.code?.toLowerCase().includes(term) ||
        plan.mikrotik_profile_name
          ?.toLowerCase()
          .includes(term)
      );
    });
  }, [plans, searchText]);

  function openCreateModal() {
    setEditingPlanId(null);
    setForm(emptyForm);
    setErrorMessage("");
    setStatusMessage("");
    setShowModal(true);
  }

  function openEditModal(plan) {
    setEditingPlanId(plan.id);

    setForm({
      name: plan.name ?? "",
      code: plan.code ?? "",
      description: plan.description ?? "",
      price: plan.price ?? "",
      currency_code: plan.currency_code ?? "GHS",
      data_limit_bytes: plan.data_limit_bytes ?? "",
      time_limit_minutes: plan.time_limit_minutes ?? "",
      validity_minutes: plan.validity_minutes ?? "",
      download_speed_kbps:
        plan.download_speed_kbps ?? "",
      upload_speed_kbps:
        plan.upload_speed_kbps ?? "",
      shared_users: plan.shared_users ?? 1,
      mikrotik_profile_name:
        plan.mikrotik_profile_name ?? "",
      display_order: plan.display_order ?? 0,
      is_public: Boolean(plan.is_public),
      is_active: Boolean(plan.is_active),
    });

    setErrorMessage("");
    setStatusMessage("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingPlanId(null);
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
    if (!form.name.trim()) {
      return "Plan name is required.";
    }

    if (!form.code.trim()) {
      return "Plan code is required.";
    }

    if (
      form.price === "" ||
      Number.isNaN(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      return "Enter a valid plan price.";
    }

    if (!form.mikrotik_profile_name.trim()) {
      return "MikroTik profile name is required.";
    }

    if (
      form.data_limit_bytes &&
      Number(form.data_limit_bytes) <= 0
    ) {
      return "Data limit must be greater than zero.";
    }

    if (
      form.validity_minutes &&
      Number(form.validity_minutes) <= 0
    ) {
      return "Validity must be greater than zero.";
    }

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

      const duplicateCode = await hotspotPlanCodeExists(
        form.code,
        editingPlanId
      );

      if (duplicateCode) {
        throw new Error(
          "A plan with this code already exists for your business."
        );
      }

      if (editingPlanId) {
        await updateHotspotPlan(editingPlanId, form);
        setStatusMessage("Internet plan updated successfully.");
      } else {
        await createHotspotPlan(form);
        setStatusMessage("Internet plan created successfully.");
      }

      closeModal();
      await loadPlans();
    } catch (error) {
      setErrorMessage(
        error.message || "Failed to save internet plan."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(plan) {
    try {
      setErrorMessage("");
      setStatusMessage("");

      await setHotspotPlanStatus(
        plan.id,
        !plan.is_active
      );

      setStatusMessage(
        plan.is_active
          ? `${plan.name} has been deactivated.`
          : `${plan.name} has been activated.`
      );

      await loadPlans();
    } catch (error) {
      setErrorMessage(
        error.message || "Failed to update plan status."
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
            <FiWifi />
            Hotspot Billing
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Internet Plans
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage prices, data limits, validity periods and
            MikroTik profile mappings.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <FiPlus />
          Add Internet Plan
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
        <SummaryCard
          label="Total Plans"
          value={plans.length}
        />

        <SummaryCard
          label="Active Plans"
          value={plans.filter((plan) => plan.is_active).length}
        />

        <SummaryCard
          label="Public Plans"
          value={plans.filter((plan) => plan.is_public).length}
        />

        <SummaryCard
          label="Inactive Plans"
          value={plans.filter((plan) => !plan.is_active).length}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="search"
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="Search plans or profile names"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={loadPlans}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FiRefreshCw
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <TableHeading>Plan</TableHeading>
                <TableHeading>Price</TableHeading>
                <TableHeading>Data</TableHeading>
                <TableHeading>Validity</TableHeading>
                <TableHeading>Speed</TableHeading>
                <TableHeading>Router Profile</TableHeading>
                <TableHeading>Status</TableHeading>
                <TableHeading>Actions</TableHeading>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Loading internet plans...
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-12 text-center"
                  >
                    <FiWifi className="mx-auto mb-3 text-3xl text-slate-300" />

                    <p className="font-medium text-slate-700">
                      No internet plans found
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Add a plan or adjust your search.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <p className="font-semibold text-slate-900">
                        {plan.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {plan.code}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                      {plan.currency_code}{" "}
                      {Number(plan.price).toFixed(2)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {bytesToReadable(plan.data_limit_bytes)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {minutesToReadable(
                        plan.validity_minutes
                      )}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      <div>
                        ↓{" "}
                        {kbpsToReadable(
                          plan.download_speed_kbps
                        )}
                      </div>

                      <div>
                        ↑{" "}
                        {kbpsToReadable(
                          plan.upload_speed_kbps
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                        {plan.mikrotik_profile_name}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge active={plan.is_active}>
                          {plan.is_active
                            ? "Active"
                            : "Inactive"}
                        </StatusBadge>

                        <span className="text-xs text-slate-500">
                          {plan.is_public
                            ? "Public"
                            : "Private"}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(plan)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FiEdit2 />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleStatus(plan)
                          }
                          className={`rounded-lg px-3 py-2 text-xs font-medium ${
                            plan.is_active
                              ? "bg-red-50 text-red-700 hover:bg-red-100"
                              : "bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {plan.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingPlanId
                    ? "Edit Internet Plan"
                    : "Add Internet Plan"}
                </h2>

                <p className="text-sm text-slate-500">
                  Plans are saved in CloudRouter. RB4011 cloud synchronization
                  will be connected in the network-device module.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6 p-6"
            >
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Plan name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="GHS5 - 2GB"
                  required
                />

                <FormField
                  label="Plan code"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  placeholder="GHS5-2GB"
                  required
                />

                <FormField
                  label="Price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={handleChange}
                  required
                />

                <FormField
                  label="Currency"
                  name="currency_code"
                  value={form.currency_code}
                  onChange={handleChange}
                  maxLength={3}
                  required
                />

                <FormField
                  label="Data limit in bytes"
                  name="data_limit_bytes"
                  type="number"
                  min="1"
                  value={form.data_limit_bytes}
                  onChange={handleChange}
                  placeholder="2147483648"
                />

                <FormField
                  label="Validity in minutes"
                  name="validity_minutes"
                  type="number"
                  min="1"
                  value={form.validity_minutes}
                  onChange={handleChange}
                  placeholder="1440"
                />

                <FormField
                  label="Session time limit in minutes"
                  name="time_limit_minutes"
                  type="number"
                  min="1"
                  value={form.time_limit_minutes}
                  onChange={handleChange}
                  placeholder="Leave blank for no session limit"
                />

                <FormField
                  label="Shared users"
                  name="shared_users"
                  type="number"
                  min="1"
                  value={form.shared_users}
                  onChange={handleChange}
                />

                <FormField
                  label="Download speed in Kbps"
                  name="download_speed_kbps"
                  type="number"
                  min="1"
                  value={form.download_speed_kbps}
                  onChange={handleChange}
                  placeholder="8192"
                />

                <FormField
                  label="Upload speed in Kbps"
                  name="upload_speed_kbps"
                  type="number"
                  min="1"
                  value={form.upload_speed_kbps}
                  onChange={handleChange}
                  placeholder="4096"
                />

                <FormField
                  label="MikroTik profile name"
                  name="mikrotik_profile_name"
                  value={form.mikrotik_profile_name}
                  onChange={handleChange}
                  placeholder="GHS5-2GB"
                  required
                />

                <FormField
                  label="Display order"
                  name="display_order"
                  type="number"
                  min="0"
                  value={form.display_order}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="2GB valid for one day"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-wrap gap-6 rounded-xl bg-slate-50 p-4">
                <CheckboxField
                  label="Visible on public purchase page"
                  name="is_public"
                  checked={form.is_public}
                  onChange={handleChange}
                />

                <CheckboxField
                  label="Plan is active"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingPlanId
                      ? "Update Plan"
                      : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function TableHeading({ children }) {
  return (
    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function StatusBadge({ active, children }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-green-100 text-green-700"
          : "bg-slate-200 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  ...rest
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        {...rest}
      />
    </div>
  );
}

function CheckboxField({
  label,
  name,
  checked,
  onChange,
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 text-blue-600"
      />

      {label}
    </label>
  );
}

export default InternetPlans;