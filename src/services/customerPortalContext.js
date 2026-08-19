const STORAGE_KEY = "cloudrouter_customer_portal_context";

function clean(value) {
  return String(value ?? "").trim();
}

export function readCustomerPortalContext() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCustomerPortalContext(values = {}) {
  if (typeof window === "undefined") {
    return {};
  }

  const current = readCustomerPortalContext();
  const next = {
    ...current,
    tenantId: clean(values.tenantId || current.tenantId),
    macAddress: clean(values.macAddress || current.macAddress),
    username: clean(values.username || current.username),
    ipAddress: clean(values.ipAddress || current.ipAddress),
    savedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage failure must never block captive-portal access.
  }

  return next;
}

export function resolveCustomerPortalContext() {
  const stored = readCustomerPortalContext();

  if (typeof window === "undefined") {
    return stored;
  }

  const params = new URLSearchParams(window.location.search);

  const context = {
    tenantId: clean(
      params.get("tenant_id") ||
      params.get("tenantId") ||
      stored.tenantId,
    ),
    macAddress: clean(
      params.get("mac") ||
      params.get("mac_address") ||
      stored.macAddress,
    ),
    username: clean(
      params.get("username") ||
      params.get("user") ||
      stored.username,
    ),
    ipAddress: clean(
      params.get("ip") ||
      params.get("ip_address") ||
      stored.ipAddress,
    ),
  };

  if (context.tenantId && (context.macAddress || context.username || context.ipAddress)) {
    saveCustomerPortalContext(context);
  }

  return context;
}

export function buildCustomerPurchaseUrl(context = {}) {
  const url = new URL("/buy-plan", window.location.origin);

  if (context.tenantId) url.searchParams.set("tenant_id", context.tenantId);
  if (context.macAddress) url.searchParams.set("mac", context.macAddress);
  if (context.ipAddress) url.searchParams.set("ip", context.ipAddress);
  if (context.username) url.searchParams.set("username", context.username);

  return url.toString();
}
