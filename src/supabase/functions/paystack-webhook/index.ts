import { createClient } from "jsr:@supabase/supabase-js@2";

type PaystackEvent = {
  event?: string;
  data?: Record<string, unknown>;
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
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
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

async function createHmacSignature(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-512",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function secureCompare(
  firstValue: string,
  secondValue: string,
): boolean {
  if (firstValue.length !== secondValue.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < firstValue.length; index += 1) {
    difference |=
      firstValue.charCodeAt(index) ^
      secondValue.charCodeAt(index);
  }

  return difference === 0;
}

async function createProvisioningJob(
  supabase: ReturnType<typeof createClient>,
  order: HotspotOrder,
  reference: string,
): Promise<void> {
  const { data: existingJobs, error: existingJobError } =
    await supabase
      .from("router_provisioning_jobs")
      .select("id")
      .eq("payment_reference", reference)
      .limit(1);

  if (existingJobError) {
    throw new Error(existingJobError.message);
  }

  if (existingJobs && existingJobs.length > 0) {
    return;
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

  const { error: jobError } = await supabase
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
    });

  if (jobError) {
    throw new Error(jobError.message);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        received: false,
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
        "Webhook environment variables are missing.",
      );

      return jsonResponse(
        {
          received: false,
          message:
            "Webhook server configuration is incomplete.",
        },
        500,
      );
    }

    const rawBody = await request.text();

    const receivedSignature = cleanText(
      request.headers.get("x-paystack-signature"),
    ).toLowerCase();

    if (!receivedSignature) {
      return jsonResponse(
        {
          received: false,
          message: "Paystack signature is missing.",
        },
        401,
      );
    }

    const calculatedSignature =
      await createHmacSignature(
        rawBody,
        paystackSecretKey,
      );

    if (
      !secureCompare(
        calculatedSignature,
        receivedSignature,
      )
    ) {
      console.error("Invalid Paystack webhook signature.");

      return jsonResponse(
        {
          received: false,
          message: "Invalid Paystack signature.",
        },
        401,
      );
    }

    let event: PaystackEvent;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return jsonResponse(
        {
          received: false,
          message: "Invalid webhook JSON.",
        },
        400,
      );
    }

    if (event.event !== "charge.success") {
      return jsonResponse({
        received: true,
        processed: false,
        message: `Event ${event.event ?? "unknown"} was ignored.`,
      });
    }

    const paymentData = event.data ?? {};
    const reference = cleanText(
      paymentData.reference,
    );
    const paymentStatus = cleanText(
      paymentData.status,
    ).toLowerCase();

    if (!reference) {
      return jsonResponse(
        {
          received: false,
          message:
            "Webhook payment reference is missing.",
        },
        400,
      );
    }

    if (paymentStatus !== "success") {
      return jsonResponse({
        received: true,
        processed: false,
        message:
          "The webhook transaction is not successful.",
      });
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
        "Webhook transaction lookup failed:",
        transactionError,
      );

      return jsonResponse(
        {
          received: false,
          message:
            "Could not load the payment transaction.",
        },
        500,
      );
    }

    const transaction = transactions?.[0];

    if (!transaction) {
      console.error(
        `No local transaction found for ${reference}.`,
      );

      return jsonResponse(
        {
          received: false,
          message:
            "No matching CloudRouter transaction was found.",
        },
        404,
      );
    }

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

    if (
      !Number.isFinite(receivedAmountPesewas) ||
      receivedAmountPesewas !== expectedAmountPesewas
    ) {
      console.error(
        `Webhook amount mismatch for ${reference}.`,
      );

      await supabase
        .from("hotspot_payment_transactions")
        .update({
          status: "failed",
          provider_response: event,
          webhook_received_at:
            new Date().toISOString(),
          failed_at: new Date().toISOString(),
          failure_message:
            "Webhook payment amount does not match the order amount.",
        })
        .eq("id", transaction.id);

      return jsonResponse(
        {
          received: false,
          message: "Payment amount mismatch.",
        },
        400,
      );
    }

    if (expectedCurrency !== receivedCurrency) {
      console.error(
        `Webhook currency mismatch for ${reference}.`,
      );

      await supabase
        .from("hotspot_payment_transactions")
        .update({
          status: "failed",
          provider_response: event,
          webhook_received_at:
            new Date().toISOString(),
          failed_at: new Date().toISOString(),
          failure_message:
            "Webhook payment currency does not match the order currency.",
        })
        .eq("id", transaction.id);

      return jsonResponse(
        {
          received: false,
          message: "Payment currency mismatch.",
        },
        400,
      );
    }

    const now = new Date().toISOString();

    const { error: paymentUpdateError } =
      await supabase
        .from("hotspot_payment_transactions")
        .update({
          provider_reference: reference,
          status: "paid",
          provider_response: event,
          webhook_received_at: now,
          verified_at: now,
          paid_at:
            cleanText(paymentData.paid_at) || now,
          failed_at: null,
          failure_message: null,
        })
        .eq("id", transaction.id);

    if (paymentUpdateError) {
      console.error(
        "Webhook payment update failed:",
        paymentUpdateError,
      );

      return jsonResponse(
        {
          received: false,
          message:
            "Could not update the payment transaction.",
        },
        500,
      );
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
          mikrotik_profile_name
        `)
        .eq("id", transaction.order_id)
        .single();

    if (orderError || !orderData) {
      console.error(
        "Webhook order lookup failed:",
        orderError,
      );

      return jsonResponse(
        {
          received: false,
          message:
            "Payment was recorded, but the order could not be loaded.",
        },
        500,
      );
    }

    const order = orderData as HotspotOrder;

    const { error: orderUpdateError } = await supabase
      .from("hotspot_orders")
      .update({
        payment_status: "paid",
        provisioning_status: "pending",
        order_status: "paid",
        failed_at: null,
        failure_reason: null,
      })
      .eq("id", order.id);

    if (orderUpdateError) {
      console.error(
        "Webhook order update failed:",
        orderUpdateError,
      );

      return jsonResponse(
        {
          received: false,
          message:
            "Payment was recorded, but the order could not be updated.",
        },
        500,
      );
    }

    try {
      await createProvisioningJob(
        supabase,
        order,
        reference,
      );
    } catch (provisioningError) {
      const failureMessage =
        provisioningError instanceof Error
          ? provisioningError.message
          : "Could not queue router provisioning.";

      console.error(
        "Webhook provisioning failed:",
        provisioningError,
      );

      await supabase
        .from("hotspot_orders")
        .update({
          provisioning_status: "failed",
          failure_reason: failureMessage,
        })
        .eq("id", order.id);

      return jsonResponse(
        {
          received: false,
          processed: false,
          paymentSuccessful: true,
          message:
            "Payment succeeded, but router provisioning could not be queued.",
        },
        500,
      );
    }

    return jsonResponse({
      received: true,
      processed: true,
      paymentSuccessful: true,
      provisioningStatus: "pending",
      message:
        "Payment confirmed and router provisioning queued.",
    });
  } catch (error) {
    console.error(
      "Unexpected Paystack webhook error:",
      error,
    );

    return jsonResponse(
      {
        received: false,
        message:
          "An unexpected webhook error occurred.",
      },
      500,
    );
  }
});