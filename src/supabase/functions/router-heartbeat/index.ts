import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json();
    const tenantId = String(body.tenant_id || '');
    const routerId = String(body.router_id || '');
    const suppliedSecret = req.headers.get('x-router-secret') || '';
    if (!tenantId || !routerId || !suppliedSecret) return json({ error: 'Missing router credentials' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: router, error: routerError } = await admin.from('network_devices').select('id,router_secret').eq('id', routerId).eq('tenant_id', tenantId).eq('device_type', 'router').maybeSingle();
    if (routerError || !router || router.router_secret !== suppliedSecret) return json({ error: 'Unauthorized router' }, 401);

    const update = {
      status: 'online',
      last_seen_at: new Date().toISOString(),
      router_identity: body.router_identity || null,
      cpu_usage_percent: Number.isFinite(Number(body.cpu_usage_percent)) ? Number(body.cpu_usage_percent) : null,
      memory_usage_percent: Number.isFinite(Number(body.memory_usage_percent)) ? Number(body.memory_usage_percent) : null,
      uptime_seconds: Number.isFinite(Number(body.uptime_seconds)) ? Number(body.uptime_seconds) : null,
      uptime_text: body.uptime_text || null,
      active_hotspot_users: Number.isFinite(Number(body.active_hotspot_users)) ? Number(body.active_hotspot_users) : 0,
      wan_status: body.wan_status || 'unknown',
      last_error: body.last_error || null,
    };
    const { error } = await admin.from('network_devices').update(update).eq('id', routerId).eq('tenant_id', tenantId);
    if (error) return json({ error: error.message }, 400);
    return json({ success: true, server_time: new Date().toISOString() });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Heartbeat failed' }, 500); }
});
