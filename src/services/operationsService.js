import { supabase } from '../lib/supabase';

function requireTenantId(tenantId) {
  if (!tenantId) throw new Error('No active tenant workspace was found.');
  return tenantId;
}

export function createSecret(length = 48) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_@#';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export function createVoucherCode(prefix = 'CR') {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, (value) => (value % 36).toString(36).toUpperCase()).join('')}`;
}

export function createVoucherPassword(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => String((value % 8) + 2)).join('');
}

export async function getSites(tenantId) {
  const { data, error } = await supabase
    .from('network_sites')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getPlans(tenantId) {
  const { data, error } = await supabase
    .from('hotspot_plans')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getDevices(tenantId) {
  const { data, error } = await supabase
    .from('network_devices')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createDevice(tenantId, values) {
  const payload = {
    tenant_id: requireTenantId(tenantId),
    site_id: values.site_id || null,
    name: values.name.trim(),
    device_type: values.device_type,
    model: values.model?.trim() || null,
    serial_number: values.serial_number?.trim() || null,
    mac_address: values.mac_address?.trim() || null,
    ip_address: values.ip_address?.trim() || null,
    router_identity: values.router_identity?.trim() || values.name.trim(),
    router_secret: values.router_secret || null,
    status: values.device_type === 'router' ? 'pending_installation' : 'active',
    is_active: true,
  };
  const { data, error } = await supabase.from('network_devices').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateDevice(deviceId, tenantId, values) {
  const { data, error } = await supabase
    .from('network_devices')
    .update(values)
    .eq('id', deviceId)
    .eq('tenant_id', requireTenantId(tenantId))
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getVouchers(tenantId) {
  const { data, error } = await supabase
    .from('hotspot_vouchers')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function generateVouchers({ tenantId, siteId, routerId, plan, quantity, mode, vendorName }) {
  const rows = Array.from({ length: quantity }, () => ({
    tenant_id: requireTenantId(tenantId),
    site_id: siteId || null,
    router_id: routerId || null,
    plan_id: plan.id,
    plan_name: plan.name,
    username: createVoucherCode(plan.code || 'CR'),
    password: createVoucherPassword(),
    status: 'available',
    generation_mode: mode,
    vendor_name: vendorName?.trim() || null,
    price: Number(plan.price || 0),
    currency_code: plan.currency_code || 'GHS',
    data_limit_bytes: plan.data_limit_bytes || null,
    validity_minutes: plan.validity_minutes || null,
    mikrotik_profile_name: plan.mikrotik_profile_name || null,
  }));
  const { data, error } = await supabase.from('hotspot_vouchers').insert(rows).select('*');
  if (error) throw error;
  return data || [];
}

export async function markVoucherSold(voucherId, tenantId, customer = {}) {
  const { data, error } = await supabase
    .from('hotspot_vouchers')
    .update({
      status: 'sold',
      sold_at: new Date().toISOString(),
      customer_name: customer.name || null,
      customer_phone: customer.phone || null,
    })
    .eq('id', voucherId)
    .eq('tenant_id', requireTenantId(tenantId))
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getTableRows(table, tenantId, orderBy = 'created_at') {
  let query = supabase.from(table).select('*').eq('tenant_id', requireTenantId(tenantId)).limit(1000);
  if (orderBy) query = query.order(orderBy, { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function buildRouterScript({ projectRef, tenantId, routerId, routerSecret, scriptName = 'cloudrouter-provision' }) {
  const safeSecret = String(routerSecret).replaceAll('\\', '\\\\').replaceAll('$', '\\$').replaceAll('"', '\\"');
  return `# CloudRouter router agent: heartbeat + provisioning
:local projectRef "${projectRef}"
:local tenantId "${tenantId}"
:local routerId "${routerId}"
:local routerSecret "${safeSecret}"
:local routerIdentity [/system identity get name]
:local heartbeatUrl ("https://" . $projectRef . ".supabase.co/functions/v1/router-heartbeat")
:local pollUrl ("https://" . $projectRef . ".supabase.co/functions/v1/router-poll")
:local acknowledgeUrl ("https://" . $projectRef . ".supabase.co/functions/v1/router-acknowledge")
:local requestHeaders ("Content-Type:application/json,x-router-secret:" . $routerSecret)

# Send health information. Failure here must not stop provisioning.
:do {
  :local cpu [/system resource get cpu-load]
  :local freeMemory [/system resource get free-memory]
  :local totalMemory [/system resource get total-memory]
  :local memoryPercent 0
  :if ($totalMemory > 0) do={ :set memoryPercent ((($totalMemory - $freeMemory) * 100) / $totalMemory) }
  :local uptimeText [/system resource get uptime]
  :local activeUsers [/ip hotspot active print count-only]
  :local wanStatus "offline"
  :if ([:len [/ip route find where dst-address="0.0.0.0/0" active=yes]] > 0) do={ :set wanStatus "online" }
  :local healthPayload {"tenant_id"=$tenantId;"router_id"=$routerId;"router_identity"=$routerIdentity;"cpu_usage_percent"=$cpu;"memory_usage_percent"=$memoryPercent;"uptime_text"=$uptimeText;"active_hotspot_users"=$activeUsers;"wan_status"=$wanStatus}
  :local healthJson [:serialize value=$healthPayload to=json options=json.no-string-conversion]
  /tool fetch url=$heartbeatUrl http-method=post http-header-field=$requestHeaders http-data=$healthJson output=none
} on-error={ :log warning ("CloudRouter heartbeat error: " . $message) }

# Poll for one provisioning job.
:do {
  :local pollPayload {"tenant_id"=$tenantId;"router_id"=$routerId;"router_identity"=$routerIdentity}
  :local pollJson [:serialize value=$pollPayload to=json options=json.no-string-conversion]
  :local response [/tool fetch url=$pollUrl http-method=post http-header-field=$requestHeaders http-data=$pollJson output=user as-value]
  :local body ($response->"data")
  :if ([:len $body] = 0) do={ :return }
  :local job [:deserialize from=json value=$body]
  :if (($job->"success") != true || [:len ($job->"job_id")] = 0) do={ :return }
  :local jobId ($job->"job_id")
  :local username ($job->"username")
  :local password ($job->"password")
  :local profile ($job->"mikrotik_profile_name")
  :local orderId ($job->"order_id")
  :local status "completed"
  :local failureReason ""
  :if ([:len [/ip hotspot user profile find where name=$profile]] = 0) do={
    :set status "failed"
    :set failureReason ("Hotspot profile not found: " . $profile)
  } else={
    :if ([:len [/ip hotspot user find where name=$username]] = 0) do={
      /ip hotspot user add name=$username password=$password profile=$profile comment=("CloudRouter job=" . $jobId . " order=" . $orderId)
    }
  }
  :local ackPayload {"tenant_id"=$tenantId;"router_id"=$routerId;"job_id"=$jobId;"status"=$status;"failure_reason"=$failureReason;"router_identity"=$routerIdentity}
  :local ackJson [:serialize value=$ackPayload to=json options=json.no-string-conversion]
  /tool fetch url=$acknowledgeUrl http-method=post http-header-field=$requestHeaders http-data=$ackJson output=none
} on-error={ :log error ("CloudRouter provisioning error: " . $message) }

# Scheduler recommendation (30-second health/provisioning cycle):
# /system scheduler add name="${scriptName}-scheduler" interval=30s start-time=startup on-event="/system script run ${scriptName}"`;
}
