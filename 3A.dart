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