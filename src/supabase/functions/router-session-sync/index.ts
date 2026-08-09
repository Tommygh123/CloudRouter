import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/*
 * ============================================================
 * CloudRouter - Router Active Session Synchronization
 * ============================================================
 *
 * Receives a complete snapshot of:
 *
 * /ip hotspot active
 *
 * from a MikroTik router.
 *
 * Responsibilities:
 *
 * 1. Authenticate router using:
 *      tenant_id
 *      router_id
 *      x-router-secret
 *
 * 2. Update router:
 *      last_seen_at
 *      status
 *      active_hotspot_users
 *
 * 3. Insert new active sessions.
 *
 * 4. Update existing active sessions.
 *
 * 5. Mark sessions no longer reported by router as offline.
 *
 * 6. Resolve site using:
 *
 *      provisioning job site
 *             ↓
 *      network device site fallback
 *
 * ============================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-router-secret",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function jsonResponse(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}


/*
 * Convert numeric input safely.
 */
function safeNumber(
  value: unknown,
  fallback = 0,
): number {
  const numericValue =
    Number(value);

  if (
    Number.isFinite(numericValue) &&
    numericValue >= 0
  ) {
    return numericValue;
  }

  return fallback;
}


/*
 * MikroTik may return uptime as:
 *
 * 02:29:08
 *
 * or
 *
 * 2h29m8s
 * 1d2h10m
 * 1w2d3h
 *
 * Convert everything into seconds.
 */
function parseRouterOsDuration(
  value: unknown,
): number {
  const text =
    String(value ?? "").trim();

  if (!text) {
    return 0;
  }


  /*
   * Format:
   *
   * HH:MM:SS
   */
  const clockMatch =
    text.match(
      /^(\d+):(\d{2}):(\d{2})$/,
    );

  if (clockMatch) {
    const hours =
      Number(clockMatch[1]);

    const minutes =
      Number(clockMatch[2]);

    const seconds =
      Number(clockMatch[3]);

    return (
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  }


  /*
   * RouterOS duration:
   *
   * 1w2d3h4m5s
   */
  let totalSeconds = 0;

  const regex =
    /(\d+)(w|d|h|m|s)/g;

  let match:
    RegExpExecArray | null;

  while (
    (match = regex.exec(text))
  ) {
    const amount =
      Number(match[1]);

    const unit =
      match[2];

    switch (unit) {
      case "w":
        totalSeconds +=
          amount * 604800;
        break;

      case "d":
        totalSeconds +=
          amount * 86400;
        break;

      case "h":
        totalSeconds +=
          amount * 3600;
        break;

      case "m":
        totalSeconds +=
          amount * 60;
        break;

      case "s":
        totalSeconds +=
          amount;
        break;
    }
  }

  return totalSeconds;
}


/*
 * ============================================================
 * Edge Function
 * ============================================================
 */

Deno.serve(
  async (request: Request) => {

    /*
     * --------------------------------------------------------
     * CORS
     * --------------------------------------------------------
     */

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }


    /*
     * --------------------------------------------------------
     * POST only
     * --------------------------------------------------------
     */

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "POST request required.",
        },
        405,
      );
    }


    try {

      /*
       * ------------------------------------------------------
       * Supabase environment
       * ------------------------------------------------------
       */

      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL",
        );

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        ) ??
        Deno.env.get(
          "SUPABASE_SECRET_KEY",
        );

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        throw new Error(
          "Supabase server environment is incomplete.",
        );
      }


      const supabase =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              persistSession:
                false,

              autoRefreshToken:
                false,
            },
          },
        );


      /*
       * ------------------------------------------------------
       * Router secret
       * ------------------------------------------------------
       */

      const routerSecret =
        request.headers.get(
          "x-router-secret",
        ) ?? "";


      /*
       * ------------------------------------------------------
       * Read request body
       * ------------------------------------------------------
       */

      const body =
        await request.json();


      const tenantId =
        String(
          body?.tenant_id ??
            "",
        ).trim();


      const routerId =
        String(
          body?.router_id ??
            "",
        ).trim();


      const routerIdentity =
        String(
          body?.router_identity ??
            "",
        ).trim();


      const sessions =
        Array.isArray(
          body?.sessions,
        )
          ? body.sessions
          : [];


      /*
       * ------------------------------------------------------
       * Validate request
       * ------------------------------------------------------
       */

      if (!tenantId) {
        return jsonResponse(
          {
            success: false,
            message:
              "tenant_id is required.",
          },
          400,
        );
      }


      if (!routerId) {
        return jsonResponse(
          {
            success: false,
            message:
              "router_id is required.",
          },
          400,
        );
      }


      if (!routerSecret) {
        return jsonResponse(
          {
            success: false,
            message:
              "Router secret is required.",
          },
          401,
        );
      }


      /*
       * ------------------------------------------------------
       * Load and authenticate router
       * ------------------------------------------------------
       */

      const {
        data: router,
        error: routerError,
      } =
        await supabase
          .from(
            "network_devices",
          )
          .select(`
            id,
            tenant_id,
            site_id,
            name,
            device_type,
            router_identity,
            router_secret,
            status,
            is_active,
            monitoring_enabled,
            provisioning_enabled
          `)
          .eq(
            "id",
            routerId,
          )
          .eq(
            "tenant_id",
            tenantId,
          )
          .maybeSingle();


      if (routerError) {
        throw new Error(
          `Could not load router: ${routerError.message}`,
        );
      }


      if (!router) {
        return jsonResponse(
          {
            success: false,
            message:
              "Router is not registered for this tenant.",
          },
          404,
        );
      }


      if (
        router.is_active ===
        false
      ) {
        return jsonResponse(
          {
            success: false,
            message:
              "Router is disabled.",
          },
          403,
        );
      }


      if (
  !router.router_secret ||
  router.router_secret !== routerSecret
) {
  console.error("ROUTER SECRET MISMATCH", {
    router_id: routerId,
    database_secret_length:
      String(router.router_secret ?? "").length,
    received_secret_length:
      String(routerSecret ?? "").length,
  });

  return jsonResponse(
    {
      success: false,
      message: "Router secret mismatch.",
      database_secret_length:
        String(router.router_secret ?? "").length,
      received_secret_length:
        String(routerSecret ?? "").length,
    },
    200,
  );
}


      const now =
        new Date()
          .toISOString();


      /*
       * ------------------------------------------------------
       * Router heartbeat
       * ------------------------------------------------------
       */

      const {
        error:
          heartbeatError,
      } =
        await supabase
          .from(
            "network_devices",
          )
          .update({
            status:
              "online",

            last_seen_at:
              now,

            router_identity:
              routerIdentity ||
              router.router_identity,

            active_hotspot_users:
              sessions.length,

            last_error:
              null,

            updated_at:
              now,
          })
          .eq(
            "id",
            routerId,
          )
          .eq(
            "tenant_id",
            tenantId,
          );


      if (heartbeatError) {
        console.error(
          "Router heartbeat update failed:",
          heartbeatError,
        );
      }


      /*
       * ------------------------------------------------------
       * List of session IDs currently reported
       * ------------------------------------------------------
       */

      const reportedSessionIds:
        string[] = [];


      /*
       * ------------------------------------------------------
       * Process each MikroTik active session
       * ------------------------------------------------------
       */

      for (
        const item
        of sessions
      ) {

        const username =
          String(
            item?.username ??
              "",
          ).trim();


        if (!username) {
          continue;
        }


        /*
         * MikroTik internal active-session ID.
         *
         * Example:
         *
         * *FD58A8C0
         */
        const routerSessionId =
          String(
            item?.router_session_id ??
              "",
          ).trim() ||
          `${username}:${item?.mac_address ?? item?.ip_address ?? "unknown"}`;


        reportedSessionIds.push(
          routerSessionId,
        );


        /*
         * ----------------------------------------------------
         * Site resolution
         * ----------------------------------------------------
         *
         * Default:
         *
         * Router's physical site.
         *
         * If this username came through a provisioning job
         * associated with another site, use that site.
         *
         * This supports:
         *
         * Site 1 RB4011
         *        |
         *        | 3 km backhaul
         *        |
         * Site 2 customer
         */

        let resolvedSiteId:
          string | null =
          router.site_id ??
          null;


        const {
          data:
            provisioningJob,

          error:
            provisioningLookupError,
        } =
          await supabase
            .from(
              "router_provisioning_jobs",
            )
            .select(`
              id,
              site_id,
              order_id,
              customer_id
            `)
            .eq(
              "tenant_id",
              tenantId,
            )
            .eq(
              "router_id",
              routerId,
            )
            .eq(
              "username",
              username,
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              },
            )
            .limit(1)
            .maybeSingle();


        if (
          provisioningLookupError
        ) {
          console.error(
            `Could not resolve site for ${username}:`,
            provisioningLookupError,
          );
        }


        if (
          provisioningJob
            ?.site_id
        ) {
          resolvedSiteId =
            provisioningJob.site_id;
        }


        /*
         * ----------------------------------------------------
         * Session statistics
         * ----------------------------------------------------
         */

        const parsedUptime =
          parseRouterOsDuration(
            item?.uptime,
          );


        const sessionSeconds =
          safeNumber(
            item?.session_seconds,
            parsedUptime,
          );


        /*
         * MikroTik:
         *
         * bytes-in
         *   traffic received from client
         *
         * bytes-out
         *   traffic sent to client
         *
         * For CloudRouter:
         *
         * bytes-in  -> upload
         * bytes-out -> download
         */

        const uploadBytes =
          safeNumber(
            item?.upload_bytes,
          );


        const downloadBytes =
          safeNumber(
            item?.download_bytes,
          );



        /*
         * Calculate approximate start time.
         */

        const calculatedStartedAt =
          sessionSeconds > 0
            ? new Date(
                Date.now() -
                  sessionSeconds *
                    1000,
              ).toISOString()
            : now;


        /*
         * ----------------------------------------------------
         * Find existing session
         * ----------------------------------------------------
         */

        const {
          data:
            existingSession,

          error:
            existingSessionError,
        } =
          await supabase
            .from(
              "hotspot_active_sessions",
            )
            .select(`
              id,
              started_at,
              hotspot_customer_id,
              hotspot_voucher_id
            `)
            .eq(
              "tenant_id",
              tenantId,
            )
            .eq(
              "network_device_id",
              routerId,
            )
            .eq(
              "router_session_id",
              routerSessionId,
            )
            .maybeSingle();


        if (
          existingSessionError
        ) {
          console.error(
            `Could not locate session ${routerSessionId}:`,
            existingSessionError,
          );

          continue;
        }


        /*
         * ----------------------------------------------------
         * Build active session payload
         * ----------------------------------------------------
         */

        const sessionPayload = {

          tenant_id:
            tenantId,

          site_id:
            resolvedSiteId,

          network_device_id:
            routerId,

          username,

          router_session_id:
            routerSessionId,

          mac_address:
            item?.mac_address
              ? String(
                  item.mac_address,
                )
              : null,

          ip_address:
            item?.ip_address
              ? String(
                  item.ip_address,
                )
              : null,

          nas_ip_address:
            item?.nas_ip_address
              ? String(
                  item.nas_ip_address,
                )
              : null,

          login_method:
            item?.login_method
              ? String(
                  item.login_method,
                )
              : null,

          started_at:
            existingSession
              ?.started_at ??
            calculatedStartedAt,

          last_seen_at:
            now,

          session_seconds:
            sessionSeconds,

          upload_bytes:
            uploadBytes,

          download_bytes:
            downloadBytes,

          status:
            "online",

          disconnect_reason:
            null,

          ended_at:
            null,

          raw_data:
            item ?? {},

          updated_at:
            now,
        };


        /*
         * ----------------------------------------------------
         * Update existing session
         * ----------------------------------------------------
         */

        if (
          existingSession
        ) {

          const {
            error:
              updateSessionError,
          } =
            await supabase
              .from(
                "hotspot_active_sessions",
              )
              .update(
                sessionPayload,
              )
              .eq(
                "id",
                existingSession.id,
              );


          if (
            updateSessionError
          ) {
            console.error(
              `Could not update ${username}:`,
              updateSessionError,
            );
          }


          continue;
        }


        /*
         * ----------------------------------------------------
         * Create new active session
         * ----------------------------------------------------
         */

        const {
          error:
            insertSessionError,
        } =
          await supabase
            .from(
              "hotspot_active_sessions",
            )
            .insert({
              id:
                crypto.randomUUID(),

              ...sessionPayload,

              created_at:
                now,
            });


        if (
          insertSessionError
        ) {
          console.error(
            `Could not create active session for ${username}:`,
            insertSessionError,
          );
        }
      }


      /*
       * ------------------------------------------------------
       * Find sessions CloudRouter currently considers online
       * ------------------------------------------------------
       */

      const {
        data:
          currentlyOnline,

        error:
          currentlyOnlineError,
      } =
        await supabase
          .from(
            "hotspot_active_sessions",
          )
          .select(`
            id,
            router_session_id,
            username,
            status
          `)
          .eq(
            "tenant_id",
            tenantId,
          )
          .eq(
            "network_device_id",
            routerId,
          )
          .eq(
            "status",
            "online",
          );


      if (
        currentlyOnlineError
      ) {
        console.error(
          "Could not load existing online sessions:",
          currentlyOnlineError,
        );
      }


      /*
       * ------------------------------------------------------
       * Mark missing MikroTik sessions offline
       * ------------------------------------------------------
       */

      if (
        !currentlyOnlineError
      ) {

        for (
          const activeSession
          of currentlyOnline ??
            []
        ) {

          if (
            reportedSessionIds
              .includes(
                activeSession
                  .router_session_id,
              )
          ) {
            continue;
          }


          const {
            error:
              closeSessionError,
          } =
            await supabase
              .from(
                "hotspot_active_sessions",
              )
              .update({
                status:
                  "offline",

                ended_at:
                  now,

                last_seen_at:
                  now,

                disconnect_reason:
                  "not_reported_by_router",

                updated_at:
                  now,
              })
              .eq(
                "id",
                activeSession.id,
              );


          if (
            closeSessionError
          ) {
            console.error(
              `Could not close session ${activeSession.username}:`,
              closeSessionError,
            );
          }
        }
      }


      /*
       * ------------------------------------------------------
       * Count actual online sessions after synchronization
       * ------------------------------------------------------
       */

      const {
        count:
          onlineCount,

        error:
          onlineCountError,
      } =
        await supabase
          .from(
            "hotspot_active_sessions",
          )
          .select(
            "id",
            {
              count:
                "exact",

              head:
                true,
            },
          )
          .eq(
            "tenant_id",
            tenantId,
          )
          .eq(
            "network_device_id",
            routerId,
          )
          .eq(
            "status",
            "online",
          );


      if (
        !onlineCountError
      ) {
        await supabase
          .from(
            "network_devices",
          )
          .update({
            active_hotspot_users:
              onlineCount ?? 0,

            updated_at:
              now,
          })
          .eq(
            "id",
            routerId,
          )
          .eq(
            "tenant_id",
            tenantId,
          );
      }


      /*
       * ------------------------------------------------------
       * Success response
       * ------------------------------------------------------
       */

      return jsonResponse({
        success:
          true,

        message:
          "Router active sessions synchronized.",

        tenant_id:
          tenantId,

        router_id:
          routerId,

        router_identity:
          routerIdentity ||
          router.router_identity,

        router_site_id:
          router.site_id,

        received_sessions:
          sessions.length,

        online_sessions:
          onlineCount ??
          reportedSessionIds.length,

        synced_at:
          now,
      });


    } catch (error) {

      console.error(
        "router-session-sync failed:",
        error,
      );


      return jsonResponse(
        {
          success:
            false,

          message:
            error instanceof
              Error
              ? error.message
              : "Router session synchronization failed.",
        },
        500,
      );
    }
  },
);