import { supabase } from '../lib/supabase';

/* =========================================================
   CLOUDROUTER WI-FI ONBOARDING SERVICE

   Intentionally isolated from:
   - Paystack/payment flow
   - hotspot orders
   - vouchers
   - router provisioning
   - active session synchronization
========================================================= */

function requireTenantId(tenantId) {
  if (!tenantId) {
    throw new Error('No active tenant workspace was found.');
  }

  return tenantId;
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

/* =========================================================
   READERS
========================================================= */

export async function getSiteWifiNetworks(tenantId) {
  const tenant = requireTenantId(tenantId);

  const { data, error } = await supabase
    .from('site_wifi_networks')
    .select('*')
    .eq('tenant_id', tenant)
    .order('is_primary', { ascending: false })
    .order('display_name', { ascending: true });

  if (error) {
    throw new Error(
      `Could not load Wi-Fi networks: ${error.message}`,
    );
  }

  return data || [];
}

export async function getWifiNetworksForSite(
  tenantId,
  siteId,
) {
  const tenant = requireTenantId(tenantId);

  if (!siteId) {
    return [];
  }

  const { data, error } = await supabase
    .from('site_wifi_networks')
    .select('*')
    .eq('tenant_id', tenant)
    .eq('site_id', siteId)
    .order('is_primary', { ascending: false })
    .order('display_name', { ascending: true });

  if (error) {
    throw new Error(
      `Could not load site Wi-Fi networks: ${error.message}`,
    );
  }

  return data || [];
}

/* =========================================================
   WRITERS
========================================================= */

function buildPayload(tenantId, values) {
  const tenant = requireTenantId(tenantId);

  if (!values?.site_id) {
    throw new Error('Select a network site.');
  }

  if (!values?.display_name?.trim()) {
    throw new Error('Service display name is required.');
  }

  if (!values?.ssid?.trim()) {
    throw new Error('Wi-Fi SSID is required.');
  }

  const securityType =
    String(values.security_type || 'nopass').trim();

  if (
    securityType !== 'nopass' &&
    !values?.wifi_password?.trim()
  ) {
    throw new Error(
      'A Wi-Fi password is required for a secured network.',
    );
  }

  return {
    tenant_id: tenant,
    site_id: values.site_id,

    display_name:
      values.display_name.trim(),

    ssid:
      values.ssid.trim(),

    security_type:
      securityType,

    wifi_password:
      securityType === 'nopass'
        ? null
        : cleanText(values.wifi_password),

    is_hidden:
      Boolean(values.is_hidden),

    qr_enabled:
      values.qr_enabled !== false,

    show_cloudrouter_branding:
      values.show_cloudrouter_branding !== false,

    is_primary:
      Boolean(values.is_primary),

    is_customer_network:
      values.is_customer_network !== false,

    is_active:
      values.is_active !== false,

    customer_message:
      cleanText(values.customer_message),
  };
}

async function clearOtherPrimaryNetworks(
  tenantId,
  siteId,
  exceptId = null,
) {
  if (!siteId) {
    return;
  }

  let query = supabase
    .from('site_wifi_networks')
    .update({
      is_primary: false,
    })
    .eq('tenant_id', tenantId)
    .eq('site_id', siteId)
    .eq('is_primary', true);

  if (exceptId) {
    query = query.neq('id', exceptId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(
      `Could not update the site's primary Wi-Fi network: ${error.message}`,
    );
  }
}

export async function createSiteWifiNetwork(
  tenantId,
  values,
) {
  const payload = buildPayload(tenantId, values);

  if (
    payload.is_primary &&
    payload.is_customer_network
  ) {
    await clearOtherPrimaryNetworks(
      payload.tenant_id,
      payload.site_id,
    );
  }

  const { data, error } = await supabase
    .from('site_wifi_networks')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Could not create Wi-Fi network: ${error.message}`,
    );
  }

  return data;
}

export async function updateSiteWifiNetwork(
  wifiNetworkId,
  tenantId,
  values,
) {
  if (!wifiNetworkId) {
    throw new Error('Wi-Fi network ID is required.');
  }

  const tenant = requireTenantId(tenantId);
  const payload = buildPayload(tenant, values);

  if (
    payload.is_primary &&
    payload.is_customer_network
  ) {
    await clearOtherPrimaryNetworks(
      tenant,
      payload.site_id,
      wifiNetworkId,
    );
  }

  delete payload.tenant_id;

  const { data, error } = await supabase
    .from('site_wifi_networks')
    .update(payload)
    .eq('id', wifiNetworkId)
    .eq('tenant_id', tenant)
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Could not update Wi-Fi network: ${error.message}`,
    );
  }

  return data;
}

export async function deleteSiteWifiNetwork(
  wifiNetworkId,
  tenantId,
) {
  if (!wifiNetworkId) {
    throw new Error('Wi-Fi network ID is required.');
  }

  const tenant = requireTenantId(tenantId);

  const { error } = await supabase
    .from('site_wifi_networks')
    .delete()
    .eq('id', wifiNetworkId)
    .eq('tenant_id', tenant);

  if (error) {
    throw new Error(
      `Could not delete Wi-Fi network: ${error.message}`,
    );
  }

  return true;
}

/* =========================================================
   QR PAYLOAD
========================================================= */

function escapeWifiQrValue(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll(':', '\\:')
    .replaceAll('"', '\\"');
}

export function buildWifiQrPayload(network) {
  if (!network?.ssid) {
    return '';
  }

  const ssid =
    escapeWifiQrValue(network.ssid);

  const hidden =
    network.is_hidden ? 'true' : 'false';

  const security =
    String(network.security_type || 'nopass');

  if (security === 'nopass') {
    return (
      `WIFI:T:nopass;` +
      `S:${ssid};` +
      `H:${hidden};;`
    );
  }

  const password =
    escapeWifiQrValue(
      network.wifi_password || '',
    );

  return (
    `WIFI:T:${security};` +
    `S:${ssid};` +
    `P:${password};` +
    `H:${hidden};;`
  );
}
