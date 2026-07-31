import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiWifi,
} from "react-icons/fi";

import {
  getProvisioningStatus,
  verifyOnlinePlanPayment,
} from "../../services/onlinePlanService";

import "./PaymentCallback.css";

const PROVISIONING_POLL_INTERVAL_MS = 2000;
const PROVISIONING_MAX_ATTEMPTS = 60;

function getSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

function getReferenceFromUrl() {
  const searchParams = getSearchParams();

  return String(
    searchParams.get("reference") ||
      searchParams.get("trxref") ||
      searchParams.get("transaction_reference") ||
      "",
  ).trim();
}

function getTenantIdFromUrl() {
  const searchParams = getSearchParams();

  return String(
    searchParams.get("tenant_id") ||
      searchParams.get("tenantId") ||
      "",
  ).trim();
}

function getPlanIdFromUrl() {
  const searchParams = getSearchParams();

  return String(
    searchParams.get("plan_id") ||
      searchParams.get("planId") ||
      "",
  ).trim();
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function PaymentCallback() {
  const reference = useMemo(() => getReferenceFromUrl(), []);
  const tenantId = useMemo(() => getTenantIdFromUrl(), []);
  const planId = useMemo(() => getPlanIdFromUrl(), []);

  const initialVerificationStarted = useRef(false);
  const componentMounted = useRef(true);

  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState(
    "Confirming your payment with Paystack...",
  );
  const [paymentResult, setPaymentResult] = useState(null);
  const [provisioningResult, setProvisioningResult] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const pollProvisioning = useCallback(async () => {
    setStatus("activating");
    setMessage(
      "Payment confirmed. Activating your internet account...",
    );

    for (
      let attempt = 1;
      attempt <= PROVISIONING_MAX_ATTEMPTS;
      attempt += 1
    ) {
      if (!componentMounted.current) {
        return;
      }

      const result = await getProvisioningStatus({
        reference,
        tenantId,
      });

      if (!componentMounted.current) {
        return;
      }

      setProvisioningResult(result);

      const provisioningStatus = normalizeStatus(
        result?.status ||
          result?.provisioningStatus ||
          result?.provisioning_status,
      );

      if (
        provisioningStatus === "completed" ||
        provisioningStatus === "success" ||
        provisioningStatus === "successful"
      ) {
        setStatus("success");
        setMessage(
          result?.message ||
            "Your internet account has been activated successfully.",
        );
        return;
      }

      if (
        provisioningStatus === "failed" ||
        provisioningStatus === "cancelled" ||
        provisioningStatus === "error"
      ) {
        throw new Error(
          result?.message ||
            result?.error ||
            "Router provisioning failed.",
        );
      }

      setMessage(
        `Payment confirmed. Activating your internet account... (${attempt}/${PROVISIONING_MAX_ATTEMPTS})`,
      );

      if (attempt < PROVISIONING_MAX_ATTEMPTS) {
        await wait(PROVISIONING_POLL_INTERVAL_MS);
      }
    }

    if (!componentMounted.current) {
      return;
    }

    setStatus("pending");
    setMessage(
      "Payment was confirmed, but router activation is taking longer than expected. Use Check again shortly.",
    );
  }, [reference, tenantId]);

  const verifyPayment = useCallback(
    async ({ retry = false } = {}) => {
      try {
        if (retry) {
          setIsRetrying(true);
        }

        setProvisioningResult(null);
        setStatus("verifying");
        setMessage("Confirming your payment with Paystack...");

        if (!reference) {
          throw new Error(
            "The Paystack payment reference is missing from the callback URL.",
          );
        }

        const result = await verifyOnlinePlanPayment({
          reference,
          tenantId,
          planId,
        });

        if (!componentMounted.current) {
          return;
        }

        setPaymentResult(result);

        const resultStatus = normalizeStatus(
          result?.status ||
            result?.paymentStatus ||
            result?.payment_status,
        );

        const paymentSuccessful =
          result?.verified === true ||
          result?.paymentSuccessful === true ||
          resultStatus === "success" ||
          resultStatus === "paid" ||
          resultStatus === "completed";

        if (paymentSuccessful) {
          await pollProvisioning();
          return;
        }

        const paymentPending =
          resultStatus === "pending" ||
          resultStatus === "processing" ||
          resultStatus === "ongoing";

        if (paymentPending) {
          setStatus("pending");
          setMessage(
            result?.message ||
              "Your payment is still being processed. Please check again shortly.",
          );
          return;
        }

        setStatus("failed");
        setMessage(
          result?.message ||
            result?.error ||
            "The payment could not be confirmed.",
        );
      } catch (error) {
        if (!componentMounted.current) {
          return;
        }

        setStatus("failed");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to complete payment verification and router activation.",
        );
      } finally {
        if (componentMounted.current) {
          setIsRetrying(false);
        }
      }
    },
    [planId, pollProvisioning, reference, tenantId],
  );

  useEffect(() => {
    componentMounted.current = true;

    if (!initialVerificationStarted.current) {
      initialVerificationStarted.current = true;
      verifyPayment();
    }

    return () => {
      componentMounted.current = false;
    };
  }, [verifyPayment]);

  function handleRetry() {
    verifyPayment({ retry: true });
  }

  function returnToPlans() {
    const url = new URL("/buy-plan", window.location.origin);

    if (tenantId) {
      url.searchParams.set("tenant_id", tenantId);
    }

    window.location.assign(url.toString());
  }

  const activeResult = provisioningResult || paymentResult;

  const verifiedReference =
    activeResult?.reference ||
    paymentResult?.reference ||
    paymentResult?.raw?.reference ||
    paymentResult?.raw?.data?.reference ||
    reference;

  const username =
    activeResult?.username ||
    activeResult?.voucherUsername ||
    activeResult?.voucher_username ||
    activeResult?.credentials?.username ||
    activeResult?.raw?.username ||
    null;

  const password =
    activeResult?.password ||
    activeResult?.voucherPassword ||
    activeResult?.voucher_password ||
    activeResult?.credentials?.password ||
    activeResult?.raw?.password ||
    null;

  return (
    <main className="payment-callback-page">
      <section className="payment-callback-card">
        <div className="payment-callback-brand">
          <FiWifi />
          <span>CloudRouter</span>
        </div>

        {status === "verifying" && (
          <div className="payment-callback-state">
            <FiRefreshCw className="payment-callback-spin" />
            <h1>Verifying payment</h1>
            <p>{message}</p>
          </div>
        )}

        {status === "activating" && (
          <div className="payment-callback-state payment-callback-pending">
            <FiRefreshCw className="payment-callback-spin" />
            <h1>Activating internet</h1>
            <p>{message}</p>

            {verifiedReference && (
              <div className="payment-callback-reference">
                <span>Payment reference</span>
                <strong>{verifiedReference}</strong>
              </div>
            )}
          </div>
        )}

        {status === "success" && (
          <div className="payment-callback-state payment-callback-success">
            <FiCheckCircle />
            <h1>Internet activated</h1>
            <p>{message}</p>

            {username && password && (
              <div className="payment-callback-credentials">
                <span>Hotspot username</span>
                <strong>{username}</strong>
                <span>Hotspot password</span>
                <strong>{password}</strong>
              </div>
            )}

            {verifiedReference && (
              <div className="payment-callback-reference">
                <span>Payment reference</span>
                <strong>{verifiedReference}</strong>
              </div>
            )}

            {!username && (
              <p>
                Your account was activated, but the hotspot credentials were
                not returned. Keep your payment reference and contact the
                network operator.
              </p>
            )}

            <button
              type="button"
              onClick={returnToPlans}
              className="payment-callback-secondary-button"
            >
              Return to plans
            </button>
          </div>
        )}

        {status === "pending" && (
          <div className="payment-callback-state payment-callback-pending">
            <FiClock />
            <h1>Activation pending</h1>
            <p>{message}</p>

            {verifiedReference && (
              <div className="payment-callback-reference">
                <span>Payment reference</span>
                <strong>{verifiedReference}</strong>
              </div>
            )}

            <div className="payment-callback-actions">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="payment-callback-primary-button"
              >
                {isRetrying ? "Checking..." : "Check again"}
              </button>

              <button
                type="button"
                onClick={returnToPlans}
                className="payment-callback-secondary-button"
              >
                Return to plans
              </button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="payment-callback-state payment-callback-failed">
            <FiAlertCircle />
            <h1>Activation not completed</h1>
            <p>{message}</p>

            {reference && (
              <div className="payment-callback-reference">
                <span>Payment reference</span>
                <strong>{reference}</strong>
              </div>
            )}

            <div className="payment-callback-actions">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying || !reference}
                className="payment-callback-primary-button"
              >
                {isRetrying ? "Checking..." : "Try again"}
              </button>

              <button
                type="button"
                onClick={returnToPlans}
                className="payment-callback-secondary-button"
              >
                Return to plans
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default PaymentCallback;
