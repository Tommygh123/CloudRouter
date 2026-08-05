-- CloudRouter tenant branding storage policies
-- Run once in the Supabase SQL editor after creating the public bucket:
--   tenant-branding
-- Expected tenants column:
--   logo_url text

create or replace function public.can_manage_tenant_branding(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_users tu
    join public.roles r on r.id = tu.role_id
    where tu.tenant_id = p_tenant_id
      and tu.user_id = auth.uid()
      and tu.status = 'active'
      and lower(coalesce(r.code, r.name, '')) in ('owner', 'admin', 'administrator')
  );
$$;

grant execute on function public.can_manage_tenant_branding(uuid) to authenticated;

-- Let tenant owners/admins update their own tenant business name/logo URL.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and policyname = 'Tenant managers can update branding'
  ) then
    create policy "Tenant managers can update branding"
      on public.tenants
      for update
      to authenticated
      using (public.can_manage_tenant_branding(id))
      with check (public.can_manage_tenant_branding(id));
  end if;
end $$;

-- Storage object policies. The first folder in every object path must be tenant_id.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Tenant managers can read branding objects'
  ) then
    create policy "Tenant managers can read branding objects"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'tenant-branding'
        and public.can_manage_tenant_branding(((storage.foldername(name))[1])::uuid)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Tenant managers can upload branding objects'
  ) then
    create policy "Tenant managers can upload branding objects"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'tenant-branding'
        and public.can_manage_tenant_branding(((storage.foldername(name))[1])::uuid)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Tenant managers can update branding objects'
  ) then
    create policy "Tenant managers can update branding objects"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'tenant-branding'
        and public.can_manage_tenant_branding(((storage.foldername(name))[1])::uuid)
      )
      with check (
        bucket_id = 'tenant-branding'
        and public.can_manage_tenant_branding(((storage.foldername(name))[1])::uuid)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Tenant managers can delete branding objects'
  ) then
    create policy "Tenant managers can delete branding objects"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'tenant-branding'
        and public.can_manage_tenant_branding(((storage.foldername(name))[1])::uuid)
      );
  end if;
end $$;
