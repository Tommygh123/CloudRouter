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