import { supabase } from '../lib/supabase';

/* =========================================================
   COMMON HELPERS
========================================================= */

function requireTenantId(tenantId) {
  if (!tenantId) {
    throw new Error(
      'No active tenant workspace was found.',
    );
  }

  return tenantId;
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


/* =========================================================
   RANDOM VALUES
========================================================= */

export function createSecret(length = 48) {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_@#';

  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return Array.from(
    bytes,
    (value) =>
      alphabet[value % alphabet.length],
  ).join('');
}


export function createVoucherCode(
  prefix = 'CR',
) {
  const safePrefix =
    String(prefix || 'CR')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10) || 'CR';

  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const bytes = new Uint8Array(8);

  crypto.getRandomValues(bytes);

  const randomPart = Array.from(
    bytes,
    (value) =>
      alphabet[value % alphabet.length],
  ).join('');

  return `${safePrefix}-${randomPart}`;
}


export function createVoucherPassword(
  length = 6,
) {
  const safeLength = Math.max(
    4,
    Math.min(
      12,
      Number(length) || 6,
    ),
  );

  const alphabet = '23456789';

  const bytes =
    new Uint8Array(safeLength);

  crypto.getRandomValues(bytes);

  return Array.from(
    bytes,
    (value) =>
      alphabet[value % alphabet.length],
  ).join('');
}


/* =========================================================
   NETWORK SITES
========================================================= */

export async function getSites(
  tenantId,
) {
  const { data, error } =
    await supabase
      .from('network_sites')
      .select('*')
      .eq(
        'tenant_id',
        requireTenantId(tenantId),
      )
      .order('name', {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return data || [];
}


/* =========================================================
   INTERNET PLANS
========================================================= */

export async function getPlans(
  tenantId,
) {
  const tenant =
    requireTenantId(tenantId);

  /*
   * Try display_order first.
   * Older schemas may not contain it,
   * so fall back to created_at.
   */
  let { data, error } =
    await supabase
      .from('hotspot_plans')
      .select('*')
      .eq('tenant_id', tenant)
      .order('display_order', {
        ascending: true,
      });

  if (
    error &&
    String(error.message || '')
      .toLowerCase()
      .includes('display_order')
  ) {
    const fallback =
      await supabase
        .from('hotspot_plans')
        .select('*')
        .eq(
          'tenant_id',
          tenant,
        )
        .order('created_at', {
          ascending: true,
        });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return data || [];
}


/* =========================================================
   NETWORK DEVICES
========================================================= */

export async function getDevices(
  tenantId,
) {
  const { data, error } =
    await supabase
      .from('network_devices')
      .select('*')
      .eq(
        'tenant_id',
        requireTenantId(tenantId),
      )
      .order('created_at', {
        ascending: false,
      });

  if (error) {
    throw error;
  }

  return data || [];
}


export async function createDevice(
  tenantId,
  values,
) {
  const tenant =
    requireTenantId(tenantId);

  if (!values?.name?.trim()) {
    throw new Error(
      'Device name is required.',
    );
  }

  const payload = {
    tenant_id: tenant,

    site_id:
      values.site_id || null,

    name:
      values.name.trim(),

    device_type:
      values.device_type ||
      'router',

    model:
      cleanText(values.model),

    serial_number:
      cleanText(
        values.serial_number,
      ),

    mac_address:
      cleanText(
        values.mac_address,
      ),

    management_ip:
      cleanText(
        values.management_ip ?? values.ip_address,
      ),

    router_identity:
      cleanText(
        values.router_identity,
      ) ||
      values.name.trim(),

    router_secret:
      values.router_secret ||
      null,

    status:
      values.device_type === 'router'
        ? 'offline'
        : 'unknown',

    is_active: true,
  };

  const { data, error } =
    await supabase
      .from('network_devices')
      .insert(payload)
      .select('*')
      .single();

  if (error) {
    throw new Error(
      `Could not register device: ${error.message}`,
    );
  }

  return data;
}


export async function updateDevice(
  deviceId,
  tenantId,
  values,
) {
  if (!deviceId) {
    throw new Error(
      'Device ID is required.',
    );
  }

  const { data, error } =
    await supabase
      .from('network_devices')
      .update(values)
      .eq('id', deviceId)
      .eq(
        'tenant_id',
        requireTenantId(tenantId),
      )
      .select('*')
      .single();

  if (error) {
    throw error;
  }

  return data;
}


function isRouterDevice(device) {
  const type = String(device?.device_type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['router', 'mikrotik_router', 'routeros', 'gateway'].includes(type) || Boolean(device?.router_identity || device?.identity_name);
}

/* =========================================================
   SITE NETWORK OVERVIEW
========================================================= */

export async function getSiteNetworkOverview(tenantId) {
  const tenant = requireTenantId(tenantId);

  const [sitesResult, devicesResult] = await Promise.all([
    supabase
      .from('network_sites')
      .select('*')
      .eq('tenant_id', tenant)
      .order('name', { ascending: true }),

    supabase
      .from('network_devices')
      .select('*')
      .eq('tenant_id', tenant)
      .order('created_at', { ascending: false }),
  ]);

  if (sitesResult.error) {
    throw new Error(
      `Could not load network sites: ${sitesResult.error.message}`,
    );
  }

  if (devicesResult.error) {
    throw new Error(
      `Could not load network devices: ${devicesResult.error.message}`,
    );
  }

  const sites = sitesResult.data || [];
  const devices = devicesResult.data || [];

  const ONLINE_THRESHOLD_MS = 90 * 1000;

  const now = Date.now();

  return sites.map((site) => {
    const siteDevices = devices.filter(
      (device) => device.site_id === site.id,
    );

    const routers = siteDevices.filter(isRouterDevice);

    const accessPoints = siteDevices.filter((device) =>
      ['access_point', 'ap'].includes(device.device_type),
    );

    /*
     * Only routers send the CloudRouter heartbeat.
     * Access points are inventory/network infrastructure
     * unless they later run their own monitoring agent.
     */
    const lastSeenValues = routers
      .map((router) => {
        if (!router.last_seen_at) return null;

        const time = new Date(router.last_seen_at).getTime();

        return Number.isFinite(time)
          ? time
          : null;
      })
      .filter(Boolean);

    const latestLastSeen =
      lastSeenValues.length > 0
        ? Math.max(...lastSeenValues)
        : null;

    const freshRouters = routers.filter((router) => {
      if (!router.last_seen_at) return false;

      const timestamp =
        new Date(router.last_seen_at).getTime();

      if (!Number.isFinite(timestamp)) {
        return false;
      }

      return (
        now - timestamp <=
        ONLINE_THRESHOLD_MS
      );
    });

    const onlineRouters =
      freshRouters.length;

    const offlineRouters =
      routers.length - onlineRouters;

    const activeUsers = routers.reduce(
      (total, router) =>
        total +
        Number(
          router.active_hotspot_users || 0,
        ),
      0,
    );

    const wanOffline =
      freshRouters.some(
        (router) =>
          String(
            router.wan_status || '',
          ).toLowerCase() === 'offline',
      );

    let operationalStatus = 'needs_setup';

    /*
     * Administrative disable always wins.
     */
    if (!site.is_active) {
      operationalStatus = 'disabled';
    }

    /*
     * A site without a MikroTik router is not yet
     * operational even if an AP has been recorded.
     */
    else if (routers.length === 0) {
      operationalStatus = 'needs_setup';
    }

    /*
     * Router registered but CloudRouter has never
     * received its heartbeat.
     */
    else if (!latestLastSeen) {
      operationalStatus =
        'not_connected';
    }

    /*
     * At least one router is currently reporting.
     */
    else if (onlineRouters > 0) {
      operationalStatus =
        wanOffline
          ? 'warning'
          : 'online';
    }

    /*
     * Router used to report but its heartbeat has
     * become stale.
     */
    else {
      operationalStatus = 'offline';
    }

    return {
      ...site,

      device_count:
        siteDevices.length,

      router_count:
        routers.length,

      access_point_count:
        accessPoints.length,

      online_router_count:
        onlineRouters,

      offline_router_count:
        offlineRouters,

      active_hotspot_users:
        activeUsers,

      last_seen_at:
        latestLastSeen
          ? new Date(
              latestLastSeen,
            ).toISOString()
          : null,

      operational_status:
        operationalStatus,

      wan_status:
        wanOffline
          ? 'offline'
          : onlineRouters > 0
            ? 'online'
            : 'unknown',
    };
  });
}


/* =========================================================
   VOUCHERS
========================================================= */

export async function getVouchers(
  tenantId,
) {
  const { data, error } =
    await supabase
      .from('hotspot_vouchers')
      .select('*')
      .eq(
        'tenant_id',
        requireTenantId(tenantId),
      )
      .order('created_at', {
        ascending: false,
      });

  if (error) {
    throw error;
  }

  return data || [];
}


/*
 * Voucher lifecycle supported by your database:
 *
 * generated
 * ready
 * active
 * used
 * expired
 * revoked
 * failed
 *
 * We use READY for vouchers that have been
 * generated and are available for sale.
 *
 * "sold" is NOT a lifecycle status.
 * A sale is recorded using sold_at.
 */

export async function generateVouchers({
  tenantId,
  siteId,
  routerId,
  plan,
  quantity,
  mode = 'manual',
  vendorName,
}) {
  const tenant = requireTenantId(tenantId);

  if (!plan?.id) {
    throw new Error(
      'A valid internet plan is required.',
    );
  }

  if (!routerId) {
    throw new Error(
      'Select the MikroTik router that should receive these vouchers.',
    );
  }

  const safeQuantity = Math.max(
    1,
    Math.min(
      500,
      Number(quantity) || 1,
    ),
  );

  /*
   * Generate username/password pairs in browser memory.
   * The full password is used to queue the MikroTik job
   * and is returned only for the immediate print/share window.
   */
  const generated = Array.from(
    { length: safeQuantity },
    () => ({
      username: createVoucherCode(
        plan.code ||
          plan.name ||
          'CR',
      ),
      password: createVoucherPassword(),
    }),
  );

  /*
   * Prevent duplicate usernames inside the current batch.
   */
  const usedNames = new Set();

  for (
    let index = 0;
    index < generated.length;
    index += 1
  ) {
    while (
      usedNames.has(
        generated[index].username,
      )
    ) {
      generated[index].username =
        createVoucherCode(
          plan.code ||
            plan.name ||
            'CR',
        );
    }

    usedNames.add(
      generated[index].username,
    );
  }

  const price =
    numberOrNull(
      plan.price ??
        plan.price_amount,
    ) ?? 0;

  const currency =
    cleanText(
      plan.currency_code ??
        plan.currency,
    ) || 'GHS';

  const dataLimit =
    numberOrNull(
      plan.data_limit_bytes,
    );

  const validityMinutes =
    numberOrNull(
      plan.validity_minutes ??
        plan.time_limit_minutes,
    );

  const timeLimitMinutes =
    numberOrNull(
      plan.time_limit_minutes ??
        plan.validity_minutes,
    );

  const sharedUsers =
    numberOrNull(
      plan.shared_users,
    ) ?? 1;

  const downloadSpeedKbps =
    numberOrNull(
      plan.download_speed_kbps,
    );

  const uploadSpeedKbps =
    numberOrNull(
      plan.upload_speed_kbps,
    );

  const profileName =
    cleanText(
      plan.mikrotik_profile_name ??
        plan.profile_name ??
        plan.code,
    );

  if (!profileName) {
    throw new Error(
      'The selected plan does not have a MikroTik profile name.',
    );
  }

  const now =
    new Date().toISOString();

  /*
   * STEP 1
   * Save vouchers first as GENERATED.
   * They become READY only after the secure Edge Function
   * successfully queues their router provisioning jobs.
   */
  const voucherRows =
    generated.map(
      ({
        username,
        password,
      }) => ({
        tenant_id:
          tenant,

        site_id:
          siteId || null,

        router_id:
          routerId,

        plan_id:
          plan.id,

        plan_name:
          plan.name ||
          plan.code ||
          'Internet Plan',

        username,

        /*
         * Full passwords are not stored as plaintext in
         * hotspot_vouchers.
         */
        password_encrypted:
          null,

        password_last_four:
          password.slice(-4),

        mikrotik_profile_name:
          profileName,

        data_limit_bytes:
          dataLimit,

        time_limit_minutes:
          timeLimitMinutes,

        validity_minutes:
          validityMinutes,

        shared_users:
          sharedUsers,

        status:
          'generated',

        generation_mode:
          mode || 'manual',

        vendor_name:
          cleanText(
            vendorName,
          ),

        price,

        currency_code:
          currency,

        generated_at:
          now,

        mikrotik_user_created:
          false,

        provisioning_error:
          null,
      }),
    );

  const {
    data: createdVouchers,
    error: voucherError,
  } = await supabase
    .from('hotspot_vouchers')
    .insert(voucherRows)
    .select('*');

  if (voucherError) {
    throw new Error(
      `Could not generate vouchers: ${voucherError.message}`,
    );
  }

  if (
    !createdVouchers ||
    createdVouchers.length !==
      generated.length
  ) {
    throw new Error(
      'Voucher generation returned an unexpected number of records.',
    );
  }

  /*
   * STEP 2
   * Queue provisioning through the Edge Function.
   *
   * Do NOT insert directly into router_provisioning_jobs from React.
   * RLS intentionally protects that table.
   */
  const completed = [];

  for (
    let index = 0;
    index < createdVouchers.length;
    index += 1
  ) {
    const voucher =
      createdVouchers[index];

    const credential =
      generated[index];

    const {
      data: functionData,
      error: functionError,
    } = await supabase.functions.invoke(
      'queue-voucher-provisioning',
      {
        body: {
          tenant_id:
            tenant,

          router_id:
            routerId,

          voucher_id:
            voucher.id,

          plan_id:
            plan.id,

          username:
            credential.username,

          password:
            credential.password,

          mikrotik_profile_name:
            profileName,

          data_limit_bytes:
            dataLimit,

          time_limit_minutes:
            timeLimitMinutes,

          validity_minutes:
            validityMinutes,

          download_speed_kbps:
            downloadSpeedKbps,

          upload_speed_kbps:
            uploadSpeedKbps,

          shared_users:
            sharedUsers,
        },
      },
    );

    if (
      functionError ||
      !functionData?.success
    ) {
      const message =
        functionError?.message ||
        functionData?.message ||
        'Unknown provisioning error';

      /*
       * Mark only the voucher that failed to queue.
       * Any earlier voucher in the same batch may already
       * have been queued successfully.
       */
      const {
        error: failedUpdateError,
      } = await supabase
        .from('hotspot_vouchers')
        .update({
          status:
            'failed',

          provisioning_error:
            message,
        })
        .eq(
          'id',
          voucher.id,
        )
        .eq(
          'tenant_id',
          tenant,
        );

      if (failedUpdateError) {
        console.warn(
          'Could not mark failed voucher:',
          failedUpdateError,
        );
      }

      throw new Error(
        `Voucher ${credential.username} could not be queued: ${message}`,
      );
    }

    /*
     * The Edge Function also marks the voucher READY.
     * Update locally as a defensive fallback so the UI
     * immediately reflects the successful queue operation.
     */
    const {
      data: readyVoucher,
      error: readyError,
    } = await supabase
      .from('hotspot_vouchers')
      .update({
        status:
          'ready',

        provisioning_error:
          null,
      })
      .eq(
        'id',
        voucher.id,
      )
      .eq(
        'tenant_id',
        tenant,
      )
      .select('*')
      .single();

    if (readyError) {
      console.warn(
        'Voucher was queued but its READY status could not be refreshed:',
        readyError,
      );
    }

    completed.push({
      ...(readyVoucher || voucher),

      status:
        readyVoucher?.status ||
        'ready',

      password:
        credential.password,

      provisioning_job_id:
        functionData.job_id ||
        null,

      provisioning_status:
        functionData.status ||
        'pending',
    });
  }

  return completed;
}


/* =========================================================
   RECORD VOUCHER SALE
========================================================= */

export async function markVoucherSold(
  voucherId,
  tenantId,
  customer = {},
) {
  if (!voucherId) {
    throw new Error(
      'Voucher ID is required.',
    );
  }

  /*
   * IMPORTANT:
   *
   * Do NOT set:
   *
   * status: 'sold'
   *
   * because SOLD is not permitted by
   * hotspot_vouchers_status_check.
   *
   * The voucher remains READY until
   * it is activated by the customer.
   */
  const payload = {
    sold_at:
      new Date().toISOString(),

    customer_name:
      cleanText(
        customer.name,
      ),

    customer_phone:
      cleanText(
        customer.phone,
      ),
  };


  const { data, error } =
    await supabase
      .from('hotspot_vouchers')
      .update(payload)
      .eq('id', voucherId)
      .eq(
        'tenant_id',
        requireTenantId(tenantId),
      )
      .select('*')
      .single();


  if (error) {
    throw new Error(
      `Could not record voucher sale: ${error.message}`,
    );
  }


  return data;
}


/* =========================================================
   LIVE / OPERATIONAL READERS
========================================================= */

export async function getActiveSessions(tenantId) {
  const { data, error } = await supabase
    .from('hotspot_active_sessions')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('last_seen_at', { ascending: false })
    .limit(2000);

  if (error) throw error;
  return data || [];
}

export async function getHistoricalSessions(tenantId) {
  const { data, error } = await supabase
    .from('hotspot_sessions')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('started_at', { ascending: false })
    .limit(5000);

  if (error) throw error;
  return data || [];
}

export async function getProvisioningJobs(tenantId) {
  const { data, error } = await supabase
    .from('router_provisioning_jobs')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return data || [];
}

/* =========================================================
   GENERIC TABLE LOADER
========================================================= */

export async function getTableRows(
  table,
  tenantId,
  orderBy = 'created_at',
) {
  if (!table) {
    throw new Error(
      'Table name is required.',
    );
  }

  let query =
    supabase
      .from(table)
      .select('*')
      .eq(
        'tenant_id',
        requireTenantId(tenantId),
      )
      .limit(1000);


  if (orderBy) {
    query =
      query.order(
        orderBy,
        {
          ascending: false,
        },
      );
  }


  const { data, error } =
    await query;


  if (error) {
    throw error;
  }


  return data || [];
}


/* =========================================================
   ROUTER SCRIPT GENERATOR
========================================================= */

export function buildRouterScript({
  projectRef,
  tenantId,
  routerId,
  routerSecret,
  scriptName =
    'cloudrouter-provision',
}) {
  if (!projectRef) {
    throw new Error(
      'Supabase project reference is required.',
    );
  }

  if (!tenantId) {
    throw new Error(
      'Tenant ID is required.',
    );
  }

  if (!routerId) {
    throw new Error(
      'Router ID is required.',
    );
  }

  if (!routerSecret) {
    throw new Error(
      'Router secret is required.',
    );
  }


  const safeSecret =
    String(routerSecret)
      .replaceAll(
        '\\',
        '\\\\',
      )
      .replaceAll(
        '$',
        '\\$',
      )
      .replaceAll(
        '"',
        '\\"',
      );


  return `# CloudRouter RouterOS agent
# Heartbeat + detailed session sync + provisioning

:local projectRef "${projectRef}"
:local tenantId "${tenantId}"
:local routerId "${routerId}"
:local routerSecret "${safeSecret}"

:local routerIdentity [/system identity get name]

:local heartbeatUrl ("https://" . $projectRef . ".supabase.co/functions/v1/router-heartbeat")
:local pollUrl ("https://" . $projectRef . ".supabase.co/functions/v1/router-poll")
:local acknowledgeUrl ("https://" . $projectRef . ".supabase.co/functions/v1/router-acknowledge")

:local requestHeaders ("Content-Type:application/json,x-router-secret:" . $routerSecret)


# ============================================================
# HEARTBEAT / MONITORING
# ============================================================

:do {

    :local cpu [/system resource get cpu-load]

    :local freeMemory [/system resource get free-memory]

    :local totalMemory [/system resource get total-memory]

    :local memoryPercent 0


    :if ($totalMemory > 0) do={

        :set memoryPercent ((($totalMemory - $freeMemory) * 100) / $totalMemory)

    }


    :local uptimeText [/system resource get uptime]

    :local activeUsers [/ip hotspot active print count-only]


    # --------------------------------------------------------
    # ACTIVE HOTSPOT SESSION DETAILS
    # --------------------------------------------------------

    :local sessionRows [:toarray ""]


    :foreach sid in=[/ip hotspot active find] do={

        :local sessionRow {

            "username"=[/ip hotspot active get $sid user];

            "ip_address"=[/ip hotspot active get $sid address];

            "mac_address"=[/ip hotspot active get $sid mac-address];

            "uptime_text"=[/ip hotspot active get $sid uptime];

            "bytes_in"=[/ip hotspot active get $sid bytes-in];

            "bytes_out"=[/ip hotspot active get $sid bytes-out]

        }


        :set sessionRows ($sessionRows,$sessionRow)

    }


    # --------------------------------------------------------
    # WAN STATUS
    # --------------------------------------------------------

    :local wanStatus "offline"


    :if (
        [:len [/ip route find where dst-address="0.0.0.0/0" active=yes]] > 0
    ) do={

        :set wanStatus "online"

    }


    # --------------------------------------------------------
    # HEARTBEAT PAYLOAD
    # --------------------------------------------------------

    :local healthPayload {

        "tenant_id"=$tenantId;

        "router_id"=$routerId;

        "router_identity"=$routerIdentity;

        "cpu_usage_percent"=$cpu;

        "memory_usage_percent"=$memoryPercent;

        "uptime_text"=$uptimeText;

        "active_hotspot_users"=$activeUsers;

        "wan_status"=$wanStatus;

        "sessions"=$sessionRows

    }


    :local healthJson [
        :serialize
        value=$healthPayload
        to=json
        options=json.no-string-conversion
    ]


    /tool fetch \\
        url=$heartbeatUrl \\
        http-method=post \\
        http-header-field=$requestHeaders \\
        http-data=$healthJson \\
        output=none


} on-error={

    :log warning (
        "CloudRouter heartbeat error: " .
        $message
    )

}


# ============================================================
# POLL FOR PROVISIONING JOB
# ============================================================

:do {

    :local pollPayload {

        "tenant_id"=$tenantId;

        "router_id"=$routerId;

        "router_identity"=$routerIdentity

    }


    :local pollJson [
        :serialize
        value=$pollPayload
        to=json
        options=json.no-string-conversion
    ]


    :local response [
        /tool fetch \\
            url=$pollUrl \\
            http-method=post \\
            http-header-field=$requestHeaders \\
            http-data=$pollJson \\
            output=user \\
            as-value
    ]


    :local body ($response->"data")


    :if ([:len $body] = 0) do={

        :return

    }


    :local job [
        :deserialize
        from=json
        value=$body
    ]


    :if (
        (($job->"success") != true) ||
        ([:len ($job->"job_id")] = 0)
    ) do={

        :return

    }


    :local jobId ($job->"job_id")

    :local username ($job->"username")

    :local password ($job->"password")

    :local profile ($job->"mikrotik_profile_name")

    :local orderId ($job->"order_id")

    :local dataLimitBytes ($job->"data_limit_bytes")

    :local uptimeLimitSeconds ($job->"uptime_limit_seconds")


    :local status "completed"

    :local failureReason ""


    # --------------------------------------------------------
    # CHECK PROFILE
    # --------------------------------------------------------

    :if (
        [:len [/ip hotspot user profile find where name=$profile]] = 0
    ) do={


        :set status "failed"


        :set failureReason (
            "Hotspot profile not found: " .
            $profile
        )


    } else={


        # ----------------------------------------------------
        # CREATE USER IF NECESSARY
        # ----------------------------------------------------

        :if (
            [:len [/ip hotspot user find where name=$username]] = 0
        ) do={


            :local commentText (
                "CloudRouter job=" .
                $jobId .
                " order=" .
                $orderId
            )


            # ------------------------------------------------
            # DATA LIMIT
            # ------------------------------------------------

            :local numericDataLimit 0


            :if (
                [:typeof $dataLimitBytes] = "num"
            ) do={

                :if (
                    $dataLimitBytes > 0
                ) do={

                    :set numericDataLimit $dataLimitBytes

                }

            }


            :if (
                [:typeof $dataLimitBytes] = "str"
            ) do={


                :if (
                    [:len $dataLimitBytes] > 0
                ) do={


                    :onerror conversionError in={


                        :set numericDataLimit [
                            :tonum $dataLimitBytes
                        ]


                    } do={


                        :set numericDataLimit 0


                        :log warning (
                            "CloudRouter: Invalid data limit received"
                        )

                    }

                }

            }


            # ------------------------------------------------
            # TIME LIMIT
            # ------------------------------------------------

            :local uptimeText ""


            :if (
                [:typeof $uptimeLimitSeconds] = "num"
            ) do={


                :if (
                    $uptimeLimitSeconds > 0
                ) do={


                    :set uptimeText (
                        [:tostr $uptimeLimitSeconds] .
                        "s"
                    )

                }

            }


            :if (
                [:typeof $uptimeLimitSeconds] = "str"
            ) do={


                :if (
                    [:len $uptimeLimitSeconds] > 0
                ) do={


                    :onerror uptimeConversionError in={


                        :local numericUptime [
                            :tonum $uptimeLimitSeconds
                        ]


                        :if (
                            $numericUptime > 0
                        ) do={


                            :set uptimeText (
                                [:tostr $numericUptime] .
                                "s"
                            )

                        }


                    } do={


                        :set uptimeText ""

                    }

                }

            }


            # ------------------------------------------------
            # CREATE HOTSPOT USER
            # ------------------------------------------------

            :if (
                ($numericDataLimit > 0) &&
                ([:len $uptimeText] > 0)
            ) do={


                /ip hotspot user add \\
                    name=$username \\
                    password=$password \\
                    profile=$profile \\
                    limit-bytes-total=$numericDataLimit \\
                    limit-uptime=$uptimeText \\
                    comment=$commentText


            } else={


                :if (
                    $numericDataLimit > 0
                ) do={


                    /ip hotspot user add \\
                        name=$username \\
                        password=$password \\
                        profile=$profile \\
                        limit-bytes-total=$numericDataLimit \\
                        comment=$commentText


                } else={


                    :if (
                        [:len $uptimeText] > 0
                    ) do={


                        /ip hotspot user add \\
                            name=$username \\
                            password=$password \\
                            profile=$profile \\
                            limit-uptime=$uptimeText \\
                            comment=$commentText


                    } else={


                        /ip hotspot user add \\
                            name=$username \\
                            password=$password \\
                            profile=$profile \\
                            comment=$commentText

                    }

                }

            }

        }

    }


    # --------------------------------------------------------
    # ACKNOWLEDGE JOB
    # --------------------------------------------------------

    :local ackPayload {

        "tenant_id"=$tenantId;

        "router_id"=$routerId;

        "job_id"=$jobId;

        "status"=$status;

        "failure_reason"=$failureReason;

        "router_identity"=$routerIdentity

    }


    :local ackJson [
        :serialize
        value=$ackPayload
        to=json
        options=json.no-string-conversion
    ]


    /tool fetch \\
        url=$acknowledgeUrl \\
        http-method=post \\
        http-header-field=$requestHeaders \\
        http-data=$ackJson \\
        output=none


} on-error={


    :log error (
        "CloudRouter provisioning error: " .
        $message
    )


}


# ============================================================
# RECOMMENDED SCHEDULER
# ============================================================

# /system scheduler add \\
#     name="${scriptName}-scheduler" \\
#     interval=30s \\
#     start-time=startup \\
#     on-event="/system script run ${scriptName}"
`;
}