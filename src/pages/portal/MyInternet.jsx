import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiRefreshCw,
  FiWifi,
} from "react-icons/fi";

import { getCustomerAccessStatus } from "../../services/onlinePlanService";
import {
  buildCustomerPurchaseUrl,
  resolveCustomerPortalContext,
} from "../../services/customerPortalContext";

import "./MyInternet.css";

function bytesToText(bytes, unlimited = false) {
  if (bytes == null) return unlimited ? "Unlimited" : "—";

  const numeric = Number(bytes || 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = numeric;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const decimals = value >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[index]}`;
}

function secondsToText(seconds) {
  if (seconds == null) return "No fixed expiry";

  const value = Math.max(0, Number(seconds || 0));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (days) return `${days} day${days === 1 ? "" : "s"}${hours ? ` ${hours} hr` : ""}`;
  if (hours) return `${hours} hr${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} min` : ""}`;
  return `${Math.max(minutes, 1)} min`;
}

export default function MyInternet() {
  const context = useMemo(() => resolveCustomerPortalContext(), []);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const identifiable = Boolean(
    context.tenantId &&
    (context.macAddress || context.username || context.ipAddress),
  );

  const load = useCallback(async () => {
    if (!identifiable) {
      setLoading(false);
      setStatus(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await getCustomerAccessStatus(context);
      setStatus(data);
    } catch (loadError) {
      console.error("My Internet status load failed:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your Internet usage.",
      );
    } finally {
      setLoading(false);
    }
  }, [context, identifiable]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!identifiable || typeof window === "undefined") {
      return undefined;
    }

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };

    const timer = window.setInterval(refreshIfVisible, 30000);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [identifiable, load]);

  const purchaseUrl =
    context.tenantId
      ? buildCustomerPurchaseUrl(context)
      : "";

  const warning = String(status?.warning_level || "normal").toLowerCase();
  const percentage = Math.min(100, Math.max(0, Number(status?.data_used_percent || 0)));

  return (
    <main className="my-internet-page">
      <section className="my-internet-shell">
        <header className="my-internet-header">
          <div className="my-internet-brand">
            <span className="my-internet-logo"><FiWifi /></span>
            <div>
              <strong>My Internet</strong>
              <span>Powered by CloudRouter</span>
            </div>
          </div>

          <button type="button" onClick={load} disabled={loading} className="my-internet-refresh">
            <FiRefreshCw className={loading ? "my-internet-spin" : ""} />
            Refresh
          </button>
        </header>

        {!identifiable ? (
          <section className="my-internet-empty">
            <FiWifi />
            <h1>Open My Internet from your Wi-Fi access page</h1>
            <p>
              This browser has not yet received your hotspot device details.
              Open <strong>Check Balance / My Internet</strong> from the KanWave
              captive portal on this same device. After that, this short page can
              be bookmarked and opened directly.
            </p>
            <p className="my-internet-note">
              No account details are required here. KanWave supplies the device
              identity automatically from the hotspot page.
            </p>
          </section>
        ) : loading ? (
          <section className="my-internet-empty">
            <FiRefreshCw className="my-internet-spin" />
            <h1>Checking your Internet package...</h1>
          </section>
        ) : error ? (
          <section className="my-internet-empty my-internet-error">
            <FiAlertTriangle />
            <h1>Unable to load your Internet usage</h1>
            <p>{error}</p>
            <button type="button" onClick={load}>Try again</button>
          </section>
        ) : !status?.hasAccess ? (
          <section className="my-internet-empty">
            <FiWifi />
            <h1>No active Internet package found</h1>
            <p>Choose a package to get connected or renew your access.</p>
            {purchaseUrl ? (
              <a href={purchaseUrl}>Buy Internet <FiArrowRight /></a>
            ) : null}
          </section>
        ) : (
          <>
            <section className={`my-internet-card my-internet-${warning}`}>
              <div className="my-internet-card-head">
                <div>
                  <p>Current package</p>
                  <h1>{status.plan_name || "Internet Access"}</h1>
                </div>
                <span>{String(status.effective_status || status.status || "active").toUpperCase()}</span>
              </div>

              {status.data_limit_bytes != null && (
                <>
                  <div className="my-internet-progress">
                    <span style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="my-internet-percent">{percentage.toFixed(1)}% used</div>
                </>
              )}

              <div className="my-internet-stats">
                <div><span>Used</span><strong>{bytesToText(status.bytes_used)}</strong></div>
                <div><span>Remaining</span><strong>{status.data_limit_bytes == null ? "Unlimited" : bytesToText(status.data_remaining_bytes)}</strong></div>
                <div><span>Time left</span><strong>{secondsToText(status.validity_remaining_seconds)}</strong></div>
              </div>

              {status.message && (
                <div className="my-internet-message"><FiAlertTriangle /> <span>{status.message}</span></div>
              )}
            </section>

            {purchaseUrl ? (
              <a className="my-internet-buy" href={purchaseUrl}>
                Buy / Renew Internet <FiArrowRight />
              </a>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
