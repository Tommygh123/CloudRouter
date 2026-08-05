import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); }
function text(value: unknown){ return String(value ?? '').trim(); }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json();
    const tenantId = text(body.tenant_id), routerId = text(body.router_id), suppliedSecret = req.headers.get('x-router-secret') || '';
    if (!tenantId || !routerId || !suppliedSecret) return json({ error: 'Missing router credentials' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: router, error: routerError } = await admin.from('network_devices').select('id,name,site_id,router_secret').eq('id', routerId).eq('tenant_id', tenantId).eq('device_type', 'router').maybeSingle();
    if (routerError || !router || router.router_secret !== suppliedSecret) return json({ error: 'Unauthorized router' }, 401);

    const now = new Date().toISOString();
    const incomingSessions = Array.isArray(body.sessions) ? body.sessions : [];
    const update = {
      status: 'online', last_seen_at: now, router_identity: body.router_identity || null,
      cpu_usage_percent: Number.isFinite(Number(body.cpu_usage_percent)) ? Number(body.cpu_usage_percent) : null,
      memory_usage_percent: Number.isFinite(Number(body.memory_usage_percent)) ? Number(body.memory_usage_percent) : null,
      uptime_seconds: Number.isFinite(Number(body.uptime_seconds)) ? Number(body.uptime_seconds) : null,
      uptime_text: body.uptime_text || null,
      active_hotspot_users: Number.isFinite(Number(body.active_hotspot_users)) ? Number(body.active_hotspot_users) : incomingSessions.length,
      wan_status: body.wan_status || 'unknown', last_error: body.last_error || null,
    };
    const { error } = await admin.from('network_devices').update(update).eq('id', routerId).eq('tenant_id', tenantId);
    if (error) return json({ error: error.message }, 400);

    // Synchronize detailed active hotspot sessions when the updated RouterOS script sends them.
    if (Array.isArray(body.sessions)) {
      const { data: existing } = await admin.from('hotspot_sessions').select('id,username,mac_address,status').eq('tenant_id', tenantId).eq('router_id', routerId).in('status', ['active','online','authorized']);
      const existingMap = new Map((existing || []).map((row:any)=>[`${text(row.username).toLowerCase()}|${text(row.mac_address).toLowerCase()}`, row]));
      const seenIds = new Set<string>();
      for (const session of incomingSessions) {
        const username=text(session?.username); if(!username) continue;
        const mac=text(session?.mac_address); const key=`${username.toLowerCase()}|${mac.toLowerCase()}`; const found:any=existingMap.get(key);
        const payload:any={tenant_id:tenantId,site_id:router.site_id||null,router_id:routerId,router_name:router.name||body.router_identity||null,username,ip_address:text(session?.ip_address)||null,mac_address:mac||null,status:'active',uptime_text:text(session?.uptime_text)||null,bytes_in:Number(session?.bytes_in||0)||0,bytes_out:Number(session?.bytes_out||0)||0,last_seen_at:now,ended_at:null};
        if(found){seenIds.add(found.id);await admin.from('hotspot_sessions').update(payload).eq('id',found.id);}else{payload.started_at=now;const {data:created}=await admin.from('hotspot_sessions').insert(payload).select('id').maybeSingle();if(created?.id)seenIds.add(created.id);}
      }
      for (const row of existing || []) if(!seenIds.has(row.id)) await admin.from('hotspot_sessions').update({status:'ended',ended_at:now,last_seen_at:now}).eq('id',row.id);
    }
    return json({ success: true, server_time: now, sessions_received: incomingSessions.length });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Heartbeat failed' }, 500); }
});
