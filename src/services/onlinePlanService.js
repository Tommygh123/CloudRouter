import { supabase } from "../lib/supabase";

/**
 * Resolves the tenant ID used for the public plan-purchase page.
 *
 * Supported URL formats:
 *
 * /buy-plan?tenant_id=TENANT_ID
 * /buy-plan?tenantId=TENANT_ID
 * /buy-plan/TENANT_ID
 * /tenant/TENANT_ID
 */
export function resolvePurchaseTenantId() {
  if (typeof window === "undefined") {
    return "";
  }

  const searchParams = new URLSearchParams(
    window.location.search,
  );

  const tenantIdFromQuery =
    searchParams.get("tenant_id") ||
    searchParams.get("tenantId");

  if (tenantIdFromQuery?.trim()) {
    return tenantIdFromQuery.trim();
  }

  const pathParts = window.location.pathname
    .split("/")
    .filter(Boolean);

  const buyPlanIndex = pathParts.findIndex(
    (part) => part === "buy-plan",
  );

  if (
    buyPlanIndex >= 0 &&
    pathParts[buyPlanIndex + 1]
  ) {
    return pathParts[buyPlanIndex + 1];
  }

  const tenantIndex = pathParts.findIndex(
    (part) => part === "tenant",
  );

  if (
    tenantIndex >= 0 &&
    pathParts[tenantIndex + 1]
  ) {
    return pathParts[tenantIndex + 1];
  }

  return "";
}

/**
 * Loads active public hotspot plans for a tenant.
 */
export async function getPublicOnlinePlans(
  tenantId,
) {
  const cleanTenantId = String(
    tenantId || "",
  ).trim();

  if (!cleanTenantId) {
    throw new Error(
      "Tenant ID is required to load internet plans.",
    );
  }

  const { data, error } = await supabase
    .from("hotspot_plans")
    .select("*")
    .eq("tenant_id", cleanTenantId)
    .eq("is_active", true)
    .order("selling_price", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Failed to load public hotspot plans:",
      error,
    );

    throw new Error(
      error.message ||
        "Failed to load internet plans.",
    );
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Attempts to extract a useful error message from a failed
 * Supabase Edge Function response.
 */
async function extractFunctionError(
  error,
  fallbackMessage = "The request failed.",
) {
  let message =
    error?.message ||
    fallbackMessage;

  const response = error?.context;

  if (!(response instanceof Response)) {
    return message;
  }

  try {
    const responseText =
      await response.clone().text();

    if (!responseText) {
      return message;
    }

    try {
      const responseJson =
        JSON.parse(responseText);

      return (
        responseJson?.error ||
        responseJson?.message ||
        responseJson?.paystackResponse
          ?.message ||
        responseJson?.data?.message ||
        message
      );
    } catch {
      return responseText;
    }
  } catch (readError) {
    console.error(
      "Could not read Edge Function error:",
      readError,
    );

    return message;
  }
}
/**
 * Initializes a Paystack transaction for a public hotspot
 * plan purchase.
 */
export async function initializeOnlinePlanPayment({
  tenantId,
  planId,
  routerId,
  amount,
  fullName,
  phone,
  email,
  callbackUrl,
}) {
  const cleanTenantId = String(
    tenantId || "",
  ).trim();

  const cleanPlanId = String(
    planId || "",
  ).trim();

  const cleanRouterId = String(
    routerId || "",
  ).trim();

  const cleanFullName = String(
    fullName || "",
  ).trim();

  const cleanPhone = String(
    phone || "",
  ).trim();

  const cleanEmail = String(
    email || "",
  )
    .trim()
    .toLowerCase();

  const cleanCallbackUrl = String(
    callbackUrl || "",
  ).trim();

  const numericAmount = Number(amount);

  if (!cleanTenantId) {
    throw new Error("Tenant ID is required.");
  }

  if (!cleanPlanId) {
    throw new Error("Plan ID is required.");
  }

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      "A valid payment amount is required.",
    );
  }

  if (!cleanFullName) {
    throw new Error(
      "Customer name is required.",
    );
  }

  if (!cleanPhone) {
    throw new Error(
      "Customer phone number is required.",
    );
  }

  if (!cleanEmail) {
    throw new Error(
      "Customer email address is required.",
    );
  }

  if (!cleanCallbackUrl) {
    throw new Error(
      "Payment callback URL is required.",
    );
  }

  const requestBody = {
    tenantId: cleanTenantId,
    tenant_id: cleanTenantId,

    planId: cleanPlanId,
    plan_id: cleanPlanId,

    routerId:
      cleanRouterId || null,

    router_id:
      cleanRouterId || null,

    amount:
      Math.round(numericAmount),

    fullName:
      cleanFullName,

    full_name:
      cleanFullName,

    phone:
      cleanPhone,

    customer_phone:
      cleanPhone,

    email:
      cleanEmail,

    customer_email:
      cleanEmail,

    callbackUrl:
      cleanCallbackUrl,

    callback_url:
      cleanCallbackUrl,

    metadata: {
      tenant_id:
        cleanTenantId,

      plan_id:
        cleanPlanId,

      router_id:
        cleanRouterId || null,

      customer_name:
        cleanFullName,

      customer_phone:
        cleanPhone,

      customer_email:
        cleanEmail,
    },
  };

  console.log(
    "Calling paystack-initialize:",
    requestBody,
  );

  const { data, error } =
    await supabase.functions.invoke(
      "paystack-initialize",
      {
        body: requestBody,
      },
    );

  console.log(
    "paystack-initialize result:",
    {
      data,
      error,
    },
  );

  if (error) {
    const message =
      await extractFunctionError(
        error,
        "Payment initialization failed.",
      );

    throw new Error(message);
  }

  if (!data) {
    throw new Error(
      "The payment server returned no data.",
    );
  }

  if (data.success === false) {
    throw new Error(
      data.error ||
        data.message ||
        data.paystackResponse
          ?.message ||
        "Paystack initialization failed.",
    );
  }

  const authorizationUrl =
    data.authorizationUrl ||
    data.authorization_url ||
    data.data?.authorization_url;

  const reference =
    data.reference ||
    data.data?.reference ||
    null;

  const accessCode =
    data.accessCode ||
    data.access_code ||
    data.data?.access_code ||
    null;

  if (!authorizationUrl) {
    console.error(
      "Unexpected payment initialization response:",
      data,
    );

    throw new Error(
      "Paystack did not return a payment authorization URL.",
    );
  }

  return {
    success: true,
    authorizationUrl,
    reference,
    accessCode,
    raw: data,
  };
}
/**
 * Verifies a completed Paystack transaction.
 *
 * A generic success:true response is not treated as proof that
 * the payment was verified. The response must contain a valid
 * payment status or an explicit verified flag.
 */
export async function verifyOnlinePlanPayment({
  reference,
  tenantId,
  planId,
}) {
  const cleanReference = String(
    reference || "",
  ).trim();

  const cleanTenantId = String(
    tenantId || "",
  ).trim();

  const cleanPlanId = String(
    planId || "",
  ).trim();

  if (!cleanReference) {
    throw new Error(
      "Payment reference is required.",
    );
  }

  if (!cleanTenantId) {
    throw new Error(
      "Tenant ID is required for payment verification.",
    );
  }

  if (!cleanPlanId) {
    throw new Error(
      "Plan ID is required for payment verification.",
    );
  }

  const requestBody = {
    reference: cleanReference,

    tenantId: cleanTenantId,

    tenant_id: cleanTenantId,

    planId: cleanPlanId,

    plan_id: cleanPlanId,
  };

  console.log(
    "Calling verify-payment:",
    requestBody,
  );

  const { data, error } =
    await supabase.functions.invoke(
      "verify-payment",
      {
        body: requestBody,
      },
    );

  console.log(
    "verify-payment result:",
    {
      data,
      error,
    },
  );

  if (error) {
    const message =
      await extractFunctionError(
        error,
        "Payment verification failed.",
      );

    throw new Error(message);
  }

  if (!data) {
    throw new Error(
      "The payment verification server returned no data.",
    );
  }

  if (data.success === false) {
    throw new Error(
      data.error ||
        data.message ||
        data.paystackResponse?.message ||
        "Payment verification failed.",
    );
  }

  const paymentData =
    data.data || data;

  const paymentStatus = String(
    data.paymentStatus ||
      data.payment_status ||
      paymentData.paymentStatus ||
      paymentData.payment_status ||
      paymentData.status ||
      "",
  )
    .trim()
    .toLowerCase();

  const verified =
    data.verified === true ||
    data.paymentVerified === true ||
    data.payment_verified === true ||
    data.paymentSuccessful === true ||
    data.payment_successful === true ||
    paymentStatus === "success" ||
    paymentStatus === "paid" ||
    paymentStatus === "completed";

  /*
   * Do not use data.success === true here.
   *
   * Some Edge Functions use success:true only to mean that
   * the HTTP request was processed successfully. It does not
   * necessarily mean that Paystack confirmed payment.
   */
  if (!verified) {
    throw new Error(
      data.message ||
        data.error ||
        `Payment verification returned an invalid status: ${
          paymentStatus || "missing"
        }.`,
    );
  }

  const orderId =
    data.orderId ||
    data.order_id ||
    paymentData.orderId ||
    paymentData.order_id ||
    null;

  const transactionId =
    data.transactionId ||
    data.transaction_id ||
    paymentData.transactionId ||
    paymentData.transaction_id ||
    null;

  const provisioningJobId =
    data.provisioningJobId ||
    data.provisioning_job_id ||
    paymentData.provisioningJobId ||
    paymentData.provisioning_job_id ||
    null;

  const provisioningStatus = String(
    data.provisioningStatus ||
      data.provisioning_status ||
      paymentData.provisioningStatus ||
      paymentData.provisioning_status ||
      "",
  )
    .trim()
    .toLowerCase();

  /*
   * The backend must create or locate an order after a
   * successful payment verification.
   */
  if (!orderId) {
    throw new Error(
      "Payment was verified, but no hotspot order was created.",
    );
  }
    /*
   * The backend must record the Paystack transaction.
   */
  if (!transactionId) {
    throw new Error(
      "Payment was verified, but no payment transaction was recorded.",
    );
  }

  /*
   * The backend must create a job for the MikroTik router.
   */
  if (!provisioningJobId) {
    throw new Error(
      "Payment was verified, but no router provisioning job was created.",
    );
  }

  const responseReference =
    data.reference ||
    paymentData.reference ||
    cleanReference;

  const username =
    data.username ||
    data.voucherUsername ||
    data.voucher_username ||
    data.credentials?.username ||
    paymentData.username ||
    paymentData.voucherUsername ||
    paymentData.voucher_username ||
    paymentData.credentials?.username ||
    null;

  const password =
    data.password ||
    data.voucherPassword ||
    data.voucher_password ||
    data.credentials?.password ||
    paymentData.password ||
    paymentData.voucherPassword ||
    paymentData.voucher_password ||
    paymentData.credentials?.password ||
    null;

  return {
    success: true,
    verified: true,
    status: paymentStatus,

    reference:
      responseReference,

    orderId,
    order_id:
      orderId,

    transactionId,
    transaction_id:
      transactionId,

    provisioningJobId,
    provisioning_job_id:
      provisioningJobId,

    provisioningStatus:
      provisioningStatus || "pending",

    provisioning_status:
      provisioningStatus || "pending",

    username,
    password,

    credentials:
      username && password
        ? {
            username,
            password,
          }
        : null,

    authorization:
      data.authorization ||
      paymentData.authorization ||
      null,

    customer:
      data.customer ||
      paymentData.customer ||
      null,

    amount:
      data.amount ??
      paymentData.amount ??
      null,

    currency:
      data.currency ||
      paymentData.currency ||
      null,

    metadata:
      data.metadata ||
      paymentData.metadata ||
      null,

    message:
      data.message ||
      "Payment verified and queued for router provisioning.",

    raw: data,
  };
}
/**
 * Polls the backend until the MikroTik router has finished
 * provisioning the hotspot account.
 */
export async function getProvisioningStatus({
  reference,
  tenantId,
}) {
  const cleanReference = String(reference || "").trim();
  const cleanTenantId = String(tenantId || "").trim();

  if (!cleanReference) {
    throw new Error("Payment reference is required.");
  }

  if (!cleanTenantId) {
    throw new Error("Tenant ID is required.");
  }

  const { data, error } = await supabase.functions.invoke(
    "provisioning-status",
    {
      body: {
        reference: cleanReference,
        tenantId: cleanTenantId,
        tenant_id: cleanTenantId,
      },
    }
  );

  if (error) {
    const message = await extractFunctionError(
      error,
      "Failed to check provisioning status."
    );

    throw new Error(message);
  }

  if (!data) {
    throw new Error(
      "Provisioning status server returned no data."
    );
  }

  const status = String(
    data.status ||
      data.provisioningStatus ||
      data.provisioning_status ||
      ""
  )
    .trim()
    .toLowerCase();

  return {
    success: data.success !== false,
    status,

    username:
      data.username ||
      data.credentials?.username ||
      null,

    password:
      data.password ||
      data.credentials?.password ||
      null,

    credentials:
      data.credentials ||
      (data.username && data.password
        ? {
            username: data.username,
            password: data.password,
          }
        : null),

    message:
      data.message ||
      null,

    raw: data,
  };
}