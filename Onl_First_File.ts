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