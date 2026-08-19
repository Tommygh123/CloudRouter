import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InitializePaymentRequest = {
  planId?: string;
  plan_id?: string;

  customerName?: string;
  fullName?: string;
  full_name?: string;

  customerPhone?: string;
  phone?: string;
  customer_phone?: string;

  customerEmail?: string;
  email?: string;
  customer_email?: string;

  customerMacAddress?: string;
  customer_mac_address?: string;

  customerIpAddress?: string;
  customer_ip_address?: string;

  customerUsername?: string;
  customer_username?: string;

  callbackUrl?: string;
  callback_url?: string;
};

type HotspotPlan = {
  id: string;
  tenant_id: string;
  router_id: string;
  name: string;
  code: string | null;
  price: number | string | null;
  selling_price: number | string | null;
  currency_code: string | null;
  currency: string | null;
  data_limit_bytes: number | string | null;
  time_limit_minutes: number | null;
  validity_minutes: number | null;
  validity_days: number | null;
  validity_hours: number | null;
  download_speed_kbps: number | null;
  upload_speed_kbps: number | null;
  shared_users: number | null;
  mikrotik_profile_name: string | null;
  is_public: boolean | null;
  is_active: boolean | null;
  available_for_sale: boolean | null;
  requires_customer_registration: boolean | null;
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

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function generateReference(): string {
  const timestamp = Date.now();
  const randomPart = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

  return `CR-${timestamp}-${randomPart}`;
}

function generateOrderNumber(): string {
  const timestamp = Date.now();
  const randomPart = crypto.randomUUID().replaceAll("-", "").slice(0, 8);

  return `ORD-${timestamp}-${randomPart}`;
}

function resolvePrice(plan: HotspotPlan): number {
  const sellingPrice = Number(plan.selling_price);
  const regularPrice = Number(plan.price);

  if (Number.isFinite(sellingPrice) && sellingPrice > 0) {
    return sellingPrice;
  }

  if (Number.isFinite(regularPrice) && regularPrice > 0) {
    return regularPrice;
  }

  return 0;
}

function resolveCurrency(plan: HotspotPlan): string {
  const currencyCode = cleanText(plan.currency_code).toUpperCase();

  if (currencyCode) {
    return currencyCode;
  }

  const fallbackCurrency = cleanText(plan.currency).toUpperCase();

  if (fallbackCurrency) {
    return fallbackCurrency;
  }

  return "GHS";
}

function resolveValidityMinutes(plan: HotspotPlan): number | null {
  if (
    typeof plan.validity_minutes === "number" &&
    plan.validity_minutes > 0
  ) {
    return plan.validity_minutes;
  }

  if (
    typeof plan.validity_days === "number" &&
    plan.validity_days > 0
  ) {
    return plan.validity_days * 24 * 60;
  }

  if (
    typeof plan.validity_hours === "number" &&
    plan.validity_hours > 0
  ) {
    return plan.validity_hours * 60;
  }

  return null;
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
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const defaultCallbackUrl = Deno.env.get(
      "PAYSTACK_CALLBACK_URL",
    );

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase server environment variables are missing.");

      return jsonResponse(
        {
          success: false,
          message: "Server database configuration is incomplete.",
        },
        500,
      );
    }

    if (!paystackSecretKey) {
      console.error("PAYSTACK_SECRET_KEY is missing.");

      return jsonResponse(
        {
          success: false,
          message: "Paystack configuration is incomplete.",
        },
        500,
      );
    }

    let body: InitializePaymentRequest;

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

    const planId =
      cleanText(body.planId) ||
      cleanText(body.plan_id);

    const customerName =
      cleanText(body.customerName) ||
      cleanText(body.fullName) ||
      cleanText(body.full_name);

    const customerPhone = normalizePhone(
      cleanText(body.customerPhone) ||
      cleanText(body.phone) ||
      cleanText(body.customer_phone),
    );

    const suppliedEmail = (
      cleanText(body.customerEmail) ||
      cleanText(body.email) ||
      cleanText(body.customer_email)
    ).toLowerCase();

    const customerMacAddress =
      cleanText(body.customerMacAddress) ||
      cleanText(body.customer_mac_address) ||
      null;

    const customerIpAddress =
      cleanText(body.customerIpAddress) ||
      cleanText(body.customer_ip_address) ||
      null;

    const customerUsername =
      cleanText(body.customerUsername) ||
      cleanText(body.customer_username) ||
      null;

    const callbackUrl =
      cleanText(body.callbackUrl) ||
      cleanText(body.callback_url) ||
      cleanText(defaultCallbackUrl);

    if (!planId) {
      return jsonResponse(
        {
          success: false,
          message: "A hotspot plan must be selected.",
        },
        400,
      );
    }

    if (!customerName) {
      return jsonResponse(
        {
          success: false,
          message: "Customer name is required.",
        },
        400,
      );
    }

    if (!customerPhone) {
      return jsonResponse(
        {
          success: false,
          message: "Customer phone number is required.",
        },
        400,
      );
    }

    if (!callbackUrl) {
      return jsonResponse(
        {
          success: false,
          message: "The payment callback URL is not configured.",
        },
        500,
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

    const { data: planData, error: planError } = await supabase
      .from("hotspot_plans")
      .select(`
        id,
        tenant_id,
        router_id,
        name,
        code,
        price,
        selling_price,
        currency_code,
        currency,
        data_limit_bytes,
        time_limit_minutes,
        validity_minutes,
        validity_days,
        validity_hours,
        download_speed_kbps,
        upload_speed_kbps,
        shared_users,
        mikrotik_profile_name,
        is_public,
        is_active,
        available_for_sale,
        requires_customer_registration
      `)
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      console.error("Plan lookup failed:", planError);

      return jsonResponse(
        {
          success: false,
          message: "Could not load the selected hotspot plan.",
        },
        500,
      );
    }

    if (!planData) {
      return jsonResponse(
        {
          success: false,
          message: "The selected hotspot plan was not found.",
        },
        404,
      );
    }

    const plan = planData as HotspotPlan;

    if (!plan.tenant_id || !plan.router_id) {
      return jsonResponse(
        {
          success: false,
          message:
            "The selected plan is not connected to a tenant and router.",
        },
        400,
      );
    }

    if (plan.is_active === false) {
      return jsonResponse(
        {
          success: false,
          message: "The selected hotspot plan is inactive.",
        },
        400,
      );
    }

    if (plan.is_public === false) {
      return jsonResponse(
        {
          success: false,
          message: "The selected hotspot plan is not publicly available.",
        },
        403,
      );
    }

    if (plan.available_for_sale === false) {
      return jsonResponse(
        {
          success: false,
          message: "The selected hotspot plan is not available for sale.",
        },
        400,
      );
    }

    const amount = resolvePrice(plan);

    if (amount <= 0) {
      return jsonResponse(
        {
          success: false,
          message:
            "The selected plan does not have a valid selling price.",
        },
        400,
      );
    }

    const currencyCode = resolveCurrency(plan);
    const validityMinutes = resolveValidityMinutes(plan);
    const reference = generateReference();
    const orderNumber = generateOrderNumber();

    const generatedEmail =
      `customer-${customerPhone.replace(/\D/g, "")}-${Date.now()}@payments.cloudrouter.local`;

    const customerEmail = suppliedEmail || generatedEmail;

    const { data: order, error: orderError } = await supabase
      .from("hotspot_orders")
      .insert({
        tenant_id: plan.tenant_id,
        router_id: plan.router_id,
        plan_id: plan.id,
        order_number: orderNumber,
        sales_channel: "online",
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_mac_address: customerMacAddress,
        customer_ip_address: customerIpAddress,
        plan_name: plan.name,
        plan_code: plan.code,
        price_amount: amount,
        currency_code: currencyCode,
        data_limit_bytes: plan.data_limit_bytes,
        time_limit_minutes: plan.time_limit_minutes,
        validity_minutes: validityMinutes,
        download_speed_kbps: plan.download_speed_kbps,
        upload_speed_kbps: plan.upload_speed_kbps,
        shared_users: plan.shared_users ?? 1,
        mikrotik_profile_name: plan.mikrotik_profile_name,
        payment_method: "paystack",
        payment_status: "pending",
        provisioning_status: "pending",
        order_status: "pending",
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Order creation failed:", orderError);

      return jsonResponse(
        {
          success: false,
          message: "Could not create the hotspot order.",
        },
        500,
      );
    }

    const { data: transaction, error: transactionError } =
      await supabase
        .from("hotspot_payment_transactions")
        .insert({
          tenant_id: plan.tenant_id,
          order_id: order.id,
          provider: "paystack",
          provider_reference: reference,
          internal_reference: reference,
          payment_method: "mobile_money",
          amount,
          currency_code: currencyCode,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          status: "pending",
        })
        .select("id")
        .single();

    if (transactionError || !transaction) {
      console.error(
        "Payment transaction creation failed:",
        transactionError,
      );

      await supabase
        .from("hotspot_orders")
        .update({
          payment_status: "failed",
          order_status: "failed",
          failed_at: new Date().toISOString(),
          failure_reason:
            "Could not create the payment transaction record.",
        })
        .eq("id", order.id);

      return jsonResponse(
        {
          success: false,
          message: "Could not create the payment transaction.",
        },
        500,
      );
    }

    const paystackAmount = Math.round(amount * 100);

    const paystackPayload = {
      email: customerEmail,
      amount: String(paystackAmount),
      currency: currencyCode,
      reference,
      callback_url: callbackUrl,
      channels: ["mobile_money"],
      metadata: JSON.stringify({
        product: "CloudRouter Hotspot",
        tenant_id: plan.tenant_id,
        router_id: plan.router_id,
        plan_id: plan.id,
        order_id: order.id,
        order_number: order.order_number,
        transaction_id: transaction.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_mac_address: customerMacAddress,
        customer_ip_address: customerIpAddress,
        customer_username: customerUsername,
      }),
    };

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paystackPayload),
      },
    );

    const paystackResult = await paystackResponse.json();

    if (
      !paystackResponse.ok ||
      paystackResult?.status !== true ||
      !paystackResult?.data?.authorization_url
    ) {
      console.error(
        "Paystack initialization failed:",
        paystackResult,
      );

      const failureMessage =
        paystackResult?.message ??
        "Paystack could not initialize the payment.";

      await supabase
        .from("hotspot_payment_transactions")
        .update({
          status: "failed",
          provider_response: paystackResult,
          failed_at: new Date().toISOString(),
          failure_message: failureMessage,
        })
        .eq("id", transaction.id);

      await supabase
        .from("hotspot_orders")
        .update({
          payment_status: "failed",
          order_status: "failed",
          failed_at: new Date().toISOString(),
          failure_reason: failureMessage,
        })
        .eq("id", order.id);

      return jsonResponse(
        {
          success: false,
          message: failureMessage,
        },
        502,
      );
    }

    await supabase
      .from("hotspot_payment_transactions")
      .update({
        provider_reference: paystackResult.data.reference,
        provider_response: paystackResult,
        status: "initialized",
      })
      .eq("id", transaction.id);

    return jsonResponse({
      success: true,
      message: "Payment initialized successfully.",
      authorizationUrl:
        paystackResult.data.authorization_url,
      accessCode: paystackResult.data.access_code,
      reference: paystackResult.data.reference,
      orderId: order.id,
      orderNumber: order.order_number,
      transactionId: transaction.id,
      amount,
      currency: currencyCode,
    });
  } catch (error) {
    console.error("Unexpected initialization error:", error);

    return jsonResponse(
      {
        success: false,
        message: "An unexpected server error occurred.",
      },
      500,
    );
  }
});