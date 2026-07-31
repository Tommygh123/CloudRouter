/**
 * Polls the backend until the MikroTik router has finished
 * provisioning the hotspot account.
 */
export async function getProvisioningStatus({
  reference,
  tenantId,
}) {
  const cleanReference = String(reference || "").trim();
  const cleanTenantId = String(tenantId || "").trim();

  if (!cleanReference) {
    throw new Error("Payment reference is required.");
  }

  if (!cleanTenantId) {
    throw new Error("Tenant ID is required.");
  }

  const { data, error } = await supabase.functions.invoke(
    "provisioning-status",
    {
      body: {
        reference: cleanReference,
        tenantId: cleanTenantId,
        tenant_id: cleanTenantId,
      },
    }
  );

  if (error) {
    const message = await extractFunctionError(
      error,
      "Failed to check provisioning status."
    );

    throw new Error(message);
  }

  if (!data) {
    throw new Error(
      "Provisioning status server returned no data."
    );
  }

  const status = String(
    data.status ||
      data.provisioningStatus ||
      data.provisioning_status ||
      ""
  )
    .trim()
    .toLowerCase();

  return {
    success: data.success !== false,
    status,

    username:
      data.username ||
      data.credentials?.username ||
      null,

    password:
      data.password ||
      data.credentials?.password ||
      null,

    credentials:
      data.credentials ||
      (data.username && data.password
        ? {
            username: data.username,
            password: data.password,
          }
        : null),

    message:
      data.message ||
      null,

    raw: data,
  };
}