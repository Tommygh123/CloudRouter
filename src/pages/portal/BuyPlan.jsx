import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FiArrowRight,
  FiCheck,
  FiClock,
  FiPhone,
  FiRefreshCw,
  FiShield,
  FiUser,
  FiWifi,
} from "react-icons/fi";

import {
  getCustomerAccessStatus,
  getPublicOnlinePlans,
  initializeOnlinePlanPayment,
  resolvePurchaseTenantId,
} from "../../services/onlinePlanService";

import "./BuyPlan.css";

const initialCustomer = {
  fullName: "",
  phone: "",
};

function formatMoney(value, currency = "GHS") {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: String(currency || "GHS").trim(),
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "GHS"} ${amount.toFixed(2)}`;
  }
}

function bytesToText(bytes) {
  const numericBytes = Number(bytes || 0);

  if (!numericBytes) {
    return "Unlimited data";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = numericBytes;
  let index = 0;

  while (
    value >= 1024 &&
    index < units.length - 1
  ) {
    value /= 1024;
    index += 1;
  }

  const decimals =
    value >= 10 || Number.isInteger(value)
      ? 0
      : 1;

  return `${value.toFixed(decimals)} ${units[index]}`;
}

function minutesToText(minutes, days, hours) {
  const numericDays = Number(days || 0);
  const numericHours = Number(hours || 0);
  const numericMinutes = Number(minutes || 0);

  if (numericDays || numericHours) {
    const parts = [];

    if (numericDays) {
      parts.push(
        `${numericDays} day${
          numericDays === 1 ? "" : "s"
        }`,
      );
    }

    if (numericHours) {
      parts.push(
        `${numericHours} hour${
          numericHours === 1 ? "" : "s"
        }`,
      );
    }

    return parts.join(" ");
  }

  if (!numericMinutes) {
    return "No fixed expiry";
  }

  if (numericMinutes % 43200 === 0) {
    const months = numericMinutes / 43200;

    return `${months} month${
      months === 1 ? "" : "s"
    }`;
  }

  if (numericMinutes % 1440 === 0) {
    const calculatedDays =
      numericMinutes / 1440;

    return `${calculatedDays} day${
      calculatedDays === 1 ? "" : "s"
    }`;
  }

  if (numericMinutes % 60 === 0) {
    const calculatedHours =
      numericMinutes / 60;

    return `${calculatedHours} hour${
      calculatedHours === 1 ? "" : "s"
    }`;
  }

  return `${numericMinutes} minute${
    numericMinutes === 1 ? "" : "s"
  }`;
}

function speedToText(download, upload) {
  if (!download && !upload) {
    return "Unlimited speed";
  }

  const readable = (kbps) => {
    const value = Number(kbps || 0);

    if (!value) {
      return "Unlimited";
    }

    return value >= 1024
      ? `${Number(
          (value / 1024).toFixed(1),
        )} Mbps`
      : `${value} Kbps`;
  };

  return `${readable(
    download,
  )} down / ${readable(upload)} up`;
}

function normalizePhone(phone) {
  return String(phone || "")
    .trim()
    .replace(/[^\d+]/g, "");
}

function createFallbackEmail(phone) {
  const digits = String(phone || "").replace(
    /\D/g,
    "",
  );

  const customerId = digits || Date.now();

  return `cloudrouter.customer.${customerId}@gmail.com`;
}


function secondsToText(seconds) {
  const value = Math.max(0, Number(seconds || 0));

  if (!value) {
    return "0 minutes";
  }

  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (days) {
    return `${days} day${days === 1 ? "" : "s"}${
      hours ? ` ${hours} hr` : ""
    }`;
  }

  if (hours) {
    return `${hours} hr${hours === 1 ? "" : "s"}${
      minutes ? ` ${minutes} min` : ""
    }`;
  }

  return `${Math.max(minutes, 1)} min`;
}

function BuyPlan() {
  const tenantId = useMemo(
    () => resolvePurchaseTenantId(),
    [],
  );

  const requestedPlan = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const params = new URLSearchParams(window.location.search);

    return String(
      params.get("plan") ||
      params.get("plan_id") ||
      "",
    ).trim();
  }, []);

  const hotspotContext = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        returnUrl: "",
        dst: "",
        macAddress: "",
        username: "",
        ipAddress: "",
      };
    }

    const params = new URLSearchParams(window.location.search);

    return {
      returnUrl: String(params.get("return_url") || "").trim(),
      dst: String(params.get("dst") || "").trim(),
      macAddress: String(
        params.get("mac") ||
        params.get("mac_address") ||
        "",
      ).trim(),
      username: String(
        params.get("username") ||
        params.get("user") ||
        "",
      ).trim(),
      ipAddress: String(
        params.get("ip") ||
        params.get("ip_address") ||
        "",
      ).trim(),
    };
  }, []);

  useEffect(() => {
    if (!hotspotContext.returnUrl || typeof window === "undefined") {
      return;
    }

    try {
      const parsed = new URL(hotspotContext.returnUrl);

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return;
      }

      window.localStorage.setItem(
        "cloudrouter_hotspot_return",
        JSON.stringify({
          returnUrl: parsed.toString(),
          dst: hotspotContext.dst || "http://neverssl.com/",
          savedAt: Date.now(),
        }),
      );
    } catch (error) {
      console.warn("Invalid hotspot return URL:", error);
    }
  }, [hotspotContext]);

  const [plans, setPlans] = useState([]);

  const [
    selectedPlanId,
    setSelectedPlanId,
  ] = useState("");

  const [customer, setCustomer] = useState(
    initialCustomer,
  );

  const [loading, setLoading] = useState(true);

  const [
    startingPayment,
    setStartingPayment,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [accessStatus, setAccessStatus] = useState(null);
  const [accessLoading, setAccessLoading] = useState(false);

  const selectedPlan = useMemo(
    () =>
      plans.find(
        (plan) => plan.id === selectedPlanId,
      ) || null,
    [plans, selectedPlanId],
  );

  const loadAccessStatus = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    const hasIdentity =
      hotspotContext.macAddress ||
      hotspotContext.username ||
      hotspotContext.ipAddress;

    if (!hasIdentity) {
      setAccessStatus(null);
      return;
    }

    try {
      setAccessLoading(true);

      const data = await getCustomerAccessStatus({
        tenantId,
        macAddress: hotspotContext.macAddress,
        username: hotspotContext.username,
        ipAddress: hotspotContext.ipAddress,
      });

      setAccessStatus(data);
    } catch (error) {
      // Usage status must never block buying Internet.
      console.warn("Current access lookup failed:", error);
      setAccessStatus(null);
    } finally {
      setAccessLoading(false);
    }
  }, [
    tenantId,
    hotspotContext.macAddress,
    hotspotContext.username,
    hotspotContext.ipAddress,
  ]);

  useEffect(() => {
    loadAccessStatus();
  }, [loadAccessStatus]);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      if (!tenantId) {
        throw new Error(
          "The purchase link is invalid because the tenant ID is missing.",
        );
      }

      const data =
        await getPublicOnlinePlans(tenantId);

      setPlans(data);

      const requested = String(requestedPlan || "")
        .trim()
        .toLowerCase();

      const requestedMatch = requested
        ? data.find((plan) =>
            [plan.id, plan.code]
              .filter(Boolean)
              .some(
                (value) =>
                  String(value).toLowerCase() === requested,
              ),
          )
        : null;

      if (requestedMatch) {
        setSelectedPlanId(requestedMatch.id);
      } else if (data.length === 1) {
        setSelectedPlanId(data[0].id);
      } else if (data.length > 1) {
        setSelectedPlanId((current) => {
          const stillExists = data.some(
            (plan) => plan.id === current,
          );

          return stillExists ? current : "";
        });
      }
    } catch (error) {
      console.error(
        "Plan loading failed:",
        error,
      );

      setPlans([]);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load internet plans.",
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId, requestedPlan]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  function handleCustomerChange(event) {
    const { name, value } = event.target;

    setCustomer((current) => ({
      ...current,
      [name]: value,
    }));

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function validatePurchase() {
    if (!tenantId) {
      return "The tenant ID is missing from the purchase link.";
    }

    if (!selectedPlan) {
      return "Select an internet plan.";
    }

    if (!selectedPlan.router_id) {
      return "The selected plan is not connected to a router.";
    }

    const planPrice = Number(
      selectedPlan.selling_price ??
        selectedPlan.price ??
        0,
    );

    if (
      !Number.isFinite(planPrice) ||
      planPrice <= 0
    ) {
      return "The selected plan has an invalid price.";
    }

    if (!customer.fullName.trim()) {
      return "Enter your full name.";
    }

    const phone = normalizePhone(
      customer.phone,
    );

    if (!phone) {
      return "Enter your Mobile Money phone number.";
    }

    const phoneDigits = phone.replace(
      /\D/g,
      "",
    );

    if (
      phoneDigits.length < 10 ||
      phoneDigits.length > 15
    ) {
      return "Enter a valid Mobile Money phone number.";
    }

    return null;
  }

  async function handlePay(event) {
    event.preventDefault();

    if (startingPayment) {
      return;
    }

    const validationError =
      validatePurchase();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setStartingPayment(true);
      setErrorMessage("");

      const cleanPhone = normalizePhone(
        customer.phone,
      );

      const customerEmail =
        createFallbackEmail(cleanPhone);

      const callbackUrl = new URL(
        "/payment/callback",
        window.location.origin,
      );

      callbackUrl.searchParams.set(
        "tenant_id",
        tenantId,
      );

      callbackUrl.searchParams.set(
        "plan_id",
        selectedPlan.id,
      );

      const planPrice = Number(
        selectedPlan.selling_price ??
          selectedPlan.price ??
          0,
      );

      if (
        !Number.isFinite(planPrice) ||
        planPrice <= 0
      ) {
        throw new Error(
          "The selected plan has an invalid price.",
        );
      }

      const amountPesewas = Math.round(
        planPrice * 100,
      );

      if (amountPesewas <= 0) {
        throw new Error(
          "The payment amount is invalid.",
        );
      }

      console.log(
        "Starting online plan payment:",
        {
          tenantId,
          planId: selectedPlan.id,
          routerId: selectedPlan.router_id,
          amountGhs: planPrice,
          amountPesewas,
          fullName:
            customer.fullName.trim(),
          phone: cleanPhone,
          email: customerEmail,
          callbackUrl:
            callbackUrl.toString(),
        },
      );

      const result =
        await initializeOnlinePlanPayment({
          tenantId,
          planId: selectedPlan.id,
          routerId:
            selectedPlan.router_id,
          amount: amountPesewas,
          fullName:
            customer.fullName.trim(),
          phone: cleanPhone,
          email: customerEmail,
          callbackUrl:
            callbackUrl.toString(),
        });

      if (!result?.authorizationUrl) {
        throw new Error(
          "Paystack did not return a payment URL.",
        );
      }

      console.log(
        "Redirecting to Paystack:",
        result.authorizationUrl,
      );

      window.location.assign(
        result.authorizationUrl,
      );
    } catch (error) {
      console.error(
        "Unable to start Paystack payment:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start payment.",
      );
    } finally {
      setStartingPayment(false);
    }
  }

  return (
    <main className="buy-plan-page">
      <section className="buy-plan-hero">
        <div className="buy-plan-hero-content">
          <div className="buy-plan-brand-mark">
            <FiWifi size={23} />
          </div>

          <div>
            <p className="buy-plan-eyebrow">
              CloudRouter Online Purchase
            </p>

            <h1 className="buy-plan-title">
              Choose your internet plan
            </h1>

            <p className="buy-plan-subtitle">
              Select a package and pay securely
              with Mobile Money.
            </p>
          </div>
        </div>
      </section>

      <section className="buy-plan-content">
        {(accessLoading || accessStatus?.hasAccess) && (
          <section
            className={`buy-plan-access-card buy-plan-access-${
              accessStatus?.warning_level || "normal"
            }`}
          >
            {accessLoading ? (
              <div className="buy-plan-access-loading">
                <FiRefreshCw size={20} />
                <strong>Checking your current Internet package...</strong>
              </div>
            ) : (
              <>
                <div className="buy-plan-access-head">
                  <div>
                    <p className="buy-plan-access-eyebrow">
                      Your Internet
                    </p>
                    <h2>{accessStatus.plan_name || "Current package"}</h2>
                  </div>

                  <span className="buy-plan-access-status">
                    {String(
                      accessStatus.effective_status ||
                      accessStatus.status ||
                      "active",
                    ).toUpperCase()}
                  </span>
                </div>

                {accessStatus.data_limit_bytes ? (
                  <>
                    <div className="buy-plan-progress">
                      <span
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Number(accessStatus.data_used_percent || 0),
                            ),
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="buy-plan-access-percent">
                      {Number(accessStatus.data_used_percent || 0).toFixed(1)}% used
                    </div>
                  </>
                ) : null}

                <div className="buy-plan-access-stats">
                  <div>
                    <span>Used</span>
                    <strong>{bytesToText(accessStatus.bytes_used)}</strong>
                  </div>

                  <div>
                    <span>Remaining</span>
                    <strong>
                      {accessStatus.data_limit_bytes
                        ? bytesToText(accessStatus.data_remaining_bytes)
                        : "Unlimited"}
                    </strong>
                  </div>

                  <div>
                    <span>Time left</span>
                    <strong>
                      {accessStatus.validity_remaining_seconds == null
                        ? "No fixed expiry"
                        : secondsToText(
                            accessStatus.validity_remaining_seconds,
                          )}
                    </strong>
                  </div>
                </div>

                {accessStatus.message && (
                  <p className="buy-plan-access-message">
                    {accessStatus.message}
                  </p>
                )}

                <a
                  href="#available-plans"
                  className="buy-plan-renew-button"
                >
                  Buy / Renew Internet
                  <FiArrowRight size={16} />
                </a>
              </>
            )}
          </section>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="buy-plan-error"
          >
            <strong>
              Unable to continue.
            </strong>

            <span>{errorMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="buy-plan-state">
            <FiRefreshCw size={24} />

            <strong>
              Loading available plans...
            </strong>
          </div>
        ) : plans.length === 0 ? (
          <div className="buy-plan-state">
            <FiWifi size={28} />

            <strong>
              No internet plans are currently
              available.
            </strong>

            <button
              type="button"
              className="buy-plan-secondary-button"
              onClick={loadPlans}
            >
              Try again
            </button>
          </div>
        ) : (
          <form onSubmit={handlePay}>
            <div className="buy-plan-layout">
              <section id="available-plans" className="buy-plan-plans-section">
                <div className="buy-plan-section-heading">
                  <span className="buy-plan-step">
                    1
                  </span>

                  <div>
                    <h2>Select a plan</h2>

                    <p>
                      Choose the package you want
                      to purchase.
                    </p>
                  </div>
                </div>

                <div className="buy-plan-grid">
                  {plans.map((plan) => {
                    const selected =
                      selectedPlanId ===
                      plan.id;

                    const price =
                      plan.selling_price ??
                      plan.price;

                    const currency =
                      plan.currency_code ||
                      plan.currency ||
                      "GHS";

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlanId(
                            plan.id,
                          );

                          setErrorMessage("");
                        }}
                        aria-pressed={selected}
                        className={`buy-plan-card ${
                          selected
                            ? "buy-plan-card-selected"
                            : ""
                        }`}
                      >
                        <div className="buy-plan-card-top">
                          <span className="buy-plan-code">
                            {plan.code}
                          </span>

                          {selected && (
                            <span className="buy-plan-selected-badge">
                              <FiCheck
                                size={13}
                              />

                              Selected
                            </span>
                          )}
                        </div>

                        <h3>{plan.name}</h3>

                        <div className="buy-plan-price">
                          {formatMoney(
                            price,
                            currency,
                          )}
                        </div>

                        <div className="buy-plan-features">
                          <span>
                            <FiWifi />

                            {plan.data_description ||
                              bytesToText(
                                plan.data_limit_bytes,
                              )}
                          </span>

                          <span>
                            <FiClock />

                            {plan.validity_description ||
                              minutesToText(
                                plan.validity_minutes,
                                plan.validity_days,
                                plan.validity_hours,
                              )}
                          </span>

                          <span>
                            <FiArrowRight />

                            {plan.speed_description ||
                              speedToText(
                                plan.download_speed_kbps,
                                plan.upload_speed_kbps,
                              )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <aside className="buy-plan-checkout">
                <div className="buy-plan-section-heading buy-plan-section-heading-compact">
                  <span className="buy-plan-step">
                    2
                  </span>

                  <div>
                    <h2>Customer details</h2>

                    <p>
                      Enter your name and MoMo
                      number.
                    </p>
                  </div>
                </div>

                <label className="buy-plan-label">
                  Full name

                  <span className="buy-plan-input-wrap">
                    <FiUser className="buy-plan-input-icon" />

                    <input
                      name="fullName"
                      value={
                        customer.fullName
                      }
                      onChange={
                        handleCustomerChange
                      }
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                    />
                  </span>
                </label>

                <label className="buy-plan-label">
                  Mobile Money number

                  <span className="buy-plan-input-wrap">
                    <FiPhone className="buy-plan-input-icon" />

                    <input
                      name="phone"
                      value={customer.phone}
                      onChange={
                        handleCustomerChange
                      }
                      placeholder="024 000 0000"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                    />
                  </span>
                </label>

                <div className="buy-plan-summary">
                  <span>Package</span>

                  <strong>
                    {selectedPlan?.name ||
                      "No plan selected"}
                  </strong>

                  <span>Total</span>

                  <strong className="buy-plan-summary-total">
                    {selectedPlan
                      ? formatMoney(
                          selectedPlan.selling_price ??
                            selectedPlan.price,
                          selectedPlan.currency_code ||
                            selectedPlan.currency ||
                            "GHS",
                        )
                      : "—"}
                  </strong>
                </div>

                <button
                  type="submit"
                  disabled={
                    startingPayment ||
                    !selectedPlan
                  }
                  className="buy-plan-pay-button"
                >
                  {startingPayment
                    ? "Opening Paystack..."
                    : selectedPlan
                      ? `Pay ${formatMoney(
                          selectedPlan.selling_price ??
                            selectedPlan.price,
                          selectedPlan.currency_code ||
                            selectedPlan.currency ||
                            "GHS",
                        )}`
                      : "Select a plan"}

                  {!startingPayment &&
                    selectedPlan && (
                      <FiArrowRight />
                    )}
                </button>

                <p className="buy-plan-secure-note">
                  <FiShield />
                  Payment is securely processed by
                  Paystack.
                </p>
              </aside>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default BuyPlan;