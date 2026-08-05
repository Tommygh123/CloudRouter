import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VerifyRequest = {
  reference?: string;
};

type HotspotOrder = {
  id: string;
  tenant_id: string;
  router_id: string;
  plan_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_mac_address: string | null;
  customer_ip_address: string | null;
  price_amount: number | string;
  currency_code: string;
  data_limit_bytes: number | string | null;
  time_limit_minutes: number | null;
  validity_minutes: number | null;
  download_speed_kbps: number | null;
  upload_speed_kbps: number | null;
  shared_users: number | null;
  mikrotik_profile_name: string | null;
  payment_status: string | null;
  provisioning_status: string | null;
  order_status: string | null;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function generateHotspotUsername(phone: string | null): string {
  const cleanPhone = (phone ?? "").replace(/\D/g, "");
  const phoneEnding = cleanPhone.slice(-6);
  const randomPart = crypto.randomUUID()
    .replaceAll("-", "")
    .slice(0, 4)
    .toUpperCase();

  if (phoneEnding) {
    return `CR${phoneEnding}${randomPart}`;
  }

  return `CR${Date.now().toString().slice(-6)}${randomPart}`;
}

function generateHotspotPassword(): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomValues = new Uint32Array(8);

  crypto.getRandomValues(randomValues);

  return Array.from(randomValues)
    .map((value) => characters[value % characters.length])
    .join("");
}

function getPaystackMetadata(
  metadata: unknown,
): Record<string, unknown> {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    return metadata as Record<string, unknown>;
  }

  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function mapPaystackStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "success":
      return "paid";

    case "failed":
    case "abandoned":
    case "reversed":
      return "failed";

    case "ongoing":
    case "pending":
    case "processing":
    case "queued":
      return "pending";

    default:
      return "pending";
  }
}

async function createProvisioningJob(
  supabase: ReturnType<typeof createClient>,
  order: HotspotOrder,
  reference: string,
): Promise<{
  jobId: string | null;
  username: string | null;
  password: string | null;
  alreadyExists: boolean;
}> {
  const { data: existingJobs, error: existingJobError } =
    await supabase
      .from("router_provisioning_jobs")
      .select("id, username, password, status")
      .eq("payment_reference", reference)
      .limit(1);

  if (existingJobError) {
    throw new Error(
      `Could not check provisioning jobs: ${existingJobError.message}`,
    );
  }

  const existingJob = existingJobs?.[0];

  if (existingJob) {
    return {
      jobId: existingJob.id,
      username: existingJob.username,
      password: existingJob.password,
      alreadyExists: true,
    };
  }

  const username = generateHotspotUsername(
    order.customer_phone,
  );
  const password = generateHotspotPassword();

  const uptimeLimitSeconds =
    order.time_limit_minutes &&
    order.time_limit_minutes > 0
      ? order.time_limit_minutes * 60
      : null;

  const expiresAt =
    order.validity_minutes &&
    order.validity_minutes > 0
      ? new Date(
          Date.now() + order.validity_minutes * 60 * 1000,
        ).toISOString()
      : null;

  const { data: job, error: jobError } = await supabase
    .from("router_provisioning_jobs")
    .insert({
      tenant_id: order.tenant_id,
      router_id: order.router_id,
      order_id: order.id,
      plan_id: order.plan_id,
      job_type: "create_user",
      status: "pending",
      username,
      password,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_mac_address: order.customer_mac_address,
      customer_ip_address: order.customer_ip_address,
      mikrotik_profile_name:
        order.mikrotik_profile_name,
      data_limit_bytes: order.data_limit_bytes,
      uptime_limit_seconds: uptimeLimitSeconds,
      validity_minutes: order.validity_minutes,
      download_speed_kbps:
        order.download_speed_kbps,
      upload_speed_kbps:
        order.upload_speed_kbps,
      shared_users: order.shared_users ?? 1,
      payment_reference: reference,
      attempt_count: 0,
      maximum_attempts: 5,
      available_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select("id, username, password")
    .single();

  if (jobError || !job) {
    throw new Error(
      jobError?.message ??
        "Could not create the router provisioning job.",
    );
  }

  return {
    jobId: job.id,
    username: job.username,
    password: job.password,
    alreadyExists: false,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        message: "Method not allowed.",
      },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SECRET_KEY");
    const paystackSecretKey = Deno.env.get(
      "PAYSTACK_SECRET_KEY",
    );

    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !paystackSecretKey
    ) {
      console.error(
        "Required server environment variables are missing.",
      );

      return jsonResponse(
        {
          success: false,
          message:
            "The payment server configuration is incomplete.",
        },
        500,
      );
    }

    let body: VerifyRequest;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          message: "Invalid JSON request body.",
        },
        400,
      );
    }

    const reference = cleanText(body.reference);

    if (!reference) {
      return jsonResponse(
        {
          success: false,
          message: "Payment reference is required.",
        },
        400,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: transactions, error: transactionError } =
      await supabase
        .from("hotspot_payment_transactions")
        .select(`
          id,
          tenant_id,
          order_id,
          provider_reference,
          internal_reference,
          amount,
          currency_code,
          status
        `)
        .or(
          `provider_reference.eq.${reference},internal_reference.eq.${reference}`,
        )
        .limit(1);

    if (transactionError) {
      console.error(
        "Transaction lookup failed:",
        transactionError,
      );

      return jsonResponse(
        {
          success: false,
          message:
            "Could not locate the payment transaction.",
        },
        500,
      );
    }

    const transaction = transactions?.[0];

    if (!transaction) {
      return jsonResponse(
        {
          success: false,
          message: "Payment transaction was not found.",
        },
        404,
      );
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const paystackResult = await paystackResponse.json();

    if (
      !paystackResponse.ok ||
      paystackResult?.status !== true ||
      !paystackResult?.data
    ) {
      console.error(
        "Paystack verification failed:",
        paystackResult,
      );

      return jsonResponse(
        {
          success: false,
          message:
            paystackResult?.message ??
            "Paystack could not verify the payment.",
        },
        502,
      );
    }

    const paymentData = paystackResult.data;
    const paystackStatus = cleanText(paymentData.status)
      .toLowerCase();
    const mappedStatus = mapPaystackStatus(
      paystackStatus,
    );

    const expectedAmountPesewas = Math.round(
      Number(transaction.amount) * 100,
    );
    const receivedAmountPesewas = Number(
      paymentData.amount,
    );

    const expectedCurrency = cleanText(
      transaction.currency_code,
    ).toUpperCase();
    const receivedCurrency = cleanText(
      paymentData.currency,
    ).toUpperCase();

    const amountMatches =
      Number.isFinite(receivedAmountPesewas) &&
      receivedAmountPesewas === expectedAmountPesewas;

    const currencyMatches =
      expectedCurrency === receivedCurrency;

    const metadata = getPaystackMetadata(
      paymentData.metadata,
    );
    const metadataOrderId = cleanText(
      metadata.order_id,
    );

    if (
      metadataOrderId &&
      metadataOrderId !== transaction.order_id
    ) {
      console.error(
        "Paystack metadata order ID does not match.",
      );

      return jsonResponse(
        {
          success: false,
          status: "failed",
          message:
            "The payment order information does not match.",
        },
        400,
      );
    }

    if (paystackStatus === "success") {
      if (!amountMatches) {
        await supabase
          .from("hotspot_payment_transactions")
          .update({
            status: "failed",
            verification_response: paystackResult,
            failed_at: new Date().toISOString(),
            failure_message:
              "The verified payment amount does not match the order amount.",
          })
          .eq("id", transaction.id);

        return jsonResponse(
          {
            success: false,
            status: "failed",
            message:
              "The verified payment amount is incorrect.",
          },
          400,
        );
      }

      if (!currencyMatches) {
        await supabase
          .from("hotspot_payment_transactions")
          .update({
            status: "failed",
            verification_response: paystackResult,
            failed_at: new Date().toISOString(),
            failure_message:
              "The verified payment currency does not match the order currency.",
          })
          .eq("id", transaction.id);

        return jsonResponse(
          {
            success: false,
            status: "failed",
            message:
              "The verified payment currency is incorrect.",
          },
          400,
        );
      }
    }

    const now = new Date().toISOString();

    const transactionUpdate: Record<string, unknown> = {
      status: mappedStatus,
      provider_reference:
        paymentData.reference ?? reference,
      verification_response: paystackResult,
    };

    if (mappedStatus === "paid") {
      transactionUpdate.verified_at = now;
      transactionUpdate.paid_at =
        paymentData.paid_at ?? now;
      transactionUpdate.failure_message = null;
      transactionUpdate.failed_at = null;
    }

    if (mappedStatus === "failed") {
      transactionUpdate.failed_at = now;
      transactionUpdate.failure_message =
        paymentData.gateway_response ??
        paymentData.message ??
        `Paystack transaction status: ${paystackStatus}`;
    }

    const { error: updateTransactionError } =
      await supabase
        .from("hotspot_payment_transactions")
        .update(transactionUpdate)
        .eq("id", transaction.id);

    if (updateTransactionError) {
      console.error(
        "Transaction update failed:",
        updateTransactionError,
      );

      return jsonResponse(
        {
          success: false,
          message:
            "Payment was verified, but the transaction record could not be updated.",
        },
        500,
      );
    }

    if (mappedStatus === "pending") {
      await supabase
        .from("hotspot_orders")
        .update({
          payment_status: "pending",
          order_status: "pending",
        })
        .eq("id", transaction.order_id);

      return jsonResponse({
        success: false,
        status: "pending",
        message:
          "Payment is still being processed by Paystack.",
        reference,
      });
    }

    if (mappedStatus === "failed") {
      const failureMessage =
        paymentData.gateway_response ??
        paymentData.message ??
        "Payment was not completed.";

      await supabase
        .from("hotspot_orders")
        .update({
          payment_status: "failed",
          provisioning_status: "not_started",
          order_status: "failed",
          failed_at: now,
          failure_reason: failureMessage,
        })
        .eq("id", transaction.order_id);

      return jsonResponse({
        success: false,
        status: "failed",
        message: failureMessage,
        reference,
      });
    }

    const { data: orderData, error: orderError } =
      await supabase
        .from("hotspot_orders")
        .select(`
          id,
          tenant_id,
          router_id,
          plan_id,
          customer_name,
          customer_phone,
          customer_mac_address,
          customer_ip_address,
          price_amount,
          currency_code,
          data_limit_bytes,
          time_limit_minutes,
          validity_minutes,
          download_speed_kbps,
          upload_speed_kbps,
          shared_users,
          mikrotik_profile_name,
          payment_status,
          provisioning_status,
          order_status
        `)
        .eq("id", transaction.order_id)
        .single();

    if (orderError || !orderData) {
      console.error("Order lookup failed:", orderError);

      return jsonResponse(
        {
          success: false,
          message:
            "Payment succeeded, but the hotspot order could not be loaded.",
        },
        500,
      );
    }

    const order = orderData as HotspotOrder;

    await supabase
      .from("hotspot_orders")
      .update({
        payment_status: "paid",
        provisioning_status: "pending",
        order_status: "paid",
        failed_at: null,
        failure_reason: null,
      })
      .eq("id", order.id);

    let provisioningResult;

    try {
      provisioningResult =
        await createProvisioningJob(
          supabase,
          order,
          reference,
        );
    } catch (provisioningError) {
      const errorMessage =
        provisioningError instanceof Error
          ? provisioningError.message
          : "Could not create the provisioning job.";

      console.error(
        "Provisioning job creation failed:",
        provisioningError,
      );

      await supabase
        .from("hotspot_orders")
        .update({
          provisioning_status: "failed",
          failure_reason: errorMessage,
        })
        .eq("id", order.id);

      return jsonResponse(
        {
          success: false,
          status: "paid",
          paymentSuccessful: true,
          provisioningStatus: "failed",
          message:
            "Payment succeeded, but router provisioning could not be queued.",
          reference,
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      status: "success",
      paymentSuccessful: true,
      provisioningStatus: "pending",
      message:
        "Payment verified. Internet access is being prepared.",
      reference,
      orderId: order.id,
      jobId: provisioningResult.jobId,
      username: provisioningResult.username,
      password: provisioningResult.password,
      provisioningAlreadyQueued:
        provisioningResult.alreadyExists,
    });
  } catch (error) {
    console.error(
      "Unexpected payment verification error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        message:
          "An unexpected payment verification error occurred.",
      },
      500,
    );
  }
});