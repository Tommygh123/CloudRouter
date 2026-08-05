-- CloudRouter live MIS upgrade: safe additions for detailed RouterOS sessions.
alter table if exists public.hotspot_sessions add column if not exists router_name text;
alter table if exists public.hotspot_sessions add column if not exists uptime_text text;
alter table if exists public.hotspot_sessions add column if not exists last_seen_at timestamptz;
alter table if exists public.hotspot_sessions add column if not exists bytes_in bigint default 0;
alter table if exists public.hotspot_sessions add column if not exists bytes_out bigint default 0;
alter table if exists public.hotspot_sessions add column if not exists ended_at timestamptz;
create index if not exists hotspot_sessions_router_status_idx on public.hotspot_sessions(tenant_id, router_id, status);
create index if not exists hotspot_sessions_site_status_idx on public.hotspot_sessions(tenant_id, site_id, status);
