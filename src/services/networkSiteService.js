import { supabase } from "../lib/supabase";
import { getCurrentTenantId } from "./hotspotPlanService";

function cleanOptionalText(value) {
  const cleaned = value?.trim();
  return cleaned || null;
}

function cleanCoordinate(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function buildSitePayload(site, tenantId = null) {
  const payload = {
    name: site.name.trim(),
    code: cleanOptionalText(site.code)?.toUpperCase() || null,
    description: cleanOptionalText(site.description),
    address: cleanOptionalText(site.address),
    city: cleanOptionalText(site.city),
    region: cleanOptionalText(site.region),
    country: site.country?.trim() || "Ghana",
    latitude: cleanCoordinate(site.latitude),
    longitude: cleanCoordinate(site.longitude),
    is_primary: Boolean(site.is_primary),
    is_active: Boolean(site.is_active),
  };

  if (tenantId) {
    payload.tenant_id = tenantId;
  }

  return payload;
}

export async function getNetworkSites() {
  const tenantId = await getCurrentTenantId();

  const { data, error } = await supabase
    .from("network_sites")
    .select(`
      id,
      tenant_id,
      name,
      code,
      description,
      address,
      city,
      region,
      country,
      latitude,
      longitude,
      is_primary,
      is_active,
      created_at,
      updated_at
    `)
    .eq("tenant_id", tenantId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createNetworkSite(site) {
  const tenantId = await getCurrentTenantId();
  const payload = buildSitePayload(site, tenantId);

  if (payload.is_primary) {
    const { error: resetError } = await supabase
      .from("network_sites")
      .update({ is_primary: false })
      .eq("tenant_id", tenantId)
      .eq("is_primary", true);

    if (resetError) {
      throw new Error(resetError.message);
    }
  }

  const { data, error } = await supabase
    .from("network_sites")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateNetworkSite(siteId, site) {
  const tenantId = await getCurrentTenantId();
  const payload = buildSitePayload(site);

  if (payload.is_primary) {
    const { error: resetError } = await supabase
      .from("network_sites")
      .update({ is_primary: false })
      .eq("tenant_id", tenantId)
      .eq("is_primary", true)
      .neq("id", siteId);

    if (resetError) {
      throw new Error(resetError.message);
    }
  }

  const { data, error } = await supabase
    .from("network_sites")
    .update(payload)
    .eq("id", siteId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function setNetworkSiteStatus(siteId, isActive) {
  const tenantId = await getCurrentTenantId();

  const { data, error } = await supabase
    .from("network_sites")
    .update({ is_active: isActive })
    .eq("id", siteId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteNetworkSite(siteId) {
  const tenantId = await getCurrentTenantId();

  const { error } = await supabase
    .from("network_sites")
    .delete()
    .eq("id", siteId)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(error.message);
  }
}
