import { supabase } from '../lib/supabase';

/**
 * Standard service result wrapper.
 */
function result(data = null, error = null) {
  return { data, error };
}

/**
 * Validate that a tenant/workspace is active.
 */
function validateTenantId(tenantId) {
  if (!tenantId) {
    return new Error(
      'No active workspace was selected.',
    );
  }

  return null;
}

/**
 * Try to extract a useful error message
 * from a Supabase Edge Function response.
 */
async function parseFunctionError(error) {
  let message =
    error?.message ||
    'The request failed.';

  try {
    const response =
      error?.context;

    if (
      response &&
      typeof response.clone === 'function'
    ) {
      const clonedResponse =
        response.clone();

      const responseText =
        await clonedResponse.text();

      if (responseText) {
        try {
          const responseBody =
            JSON.parse(responseText);

          if (
            responseBody?.error
          ) {
            message =
              responseBody.error;
          } else if (
            responseBody?.message
          ) {
            message =
              responseBody.message;
          }
        } catch {
          message =
            responseText;
        }
      }
    }
  } catch {
    // Keep original Supabase error message.
  }

  return new Error(message);
}

/**
 * CloudRouter / Kanwave
 * User Management Service
 *
 * Professional SaaS invitation flow:
 *
 * Admin
 *   ↓
 * User Management
 *   ↓
 * Invite User
 *   ↓
 * invite-tenant-user Edge Function
 *   ↓
 * Invitation email
 *   ↓
 * User accepts invitation
 *   ↓
 * User sets password
 *   ↓
 * Tenant membership becomes active
 */
export const userManagementService = {
  /**
   * ==========================================================
   * GET TENANT MEMBERS
   * ==========================================================
   */
  async getMembers(tenantId) {
    try {
      const tenantError =
        validateTenantId(
          tenantId,
        );

      if (tenantError) {
        return result(
          [],
          tenantError,
        );
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        'list_tenant_members',
        {
          requested_tenant_id:
            tenantId,
        },
      );

      if (error) {
        console.error(
          'Loading tenant members failed:',
          error,
        );

        return result(
          [],
          error,
        );
      }

      return result(
        data ?? [],
        null,
      );
    } catch (error) {
      console.error(
        'Loading tenant members failed:',
        error,
      );

      return result(
        [],
        error,
      );
    }
  },

  /**
   * ==========================================================
   * GET AVAILABLE ROLES
   * ==========================================================
   *
   * Owner is deliberately excluded.
   *
   * The existing owner should normally be the only
   * person able to transfer/create another owner.
   */
  async getRoles(tenantId) {
    try {
      const tenantError =
        validateTenantId(
          tenantId,
        );

      if (tenantError) {
        return result(
          [],
          tenantError,
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from('roles')
        .select(
          `
            id,
            name,
            code,
            description,
            tenant_id,
            is_system_role,
            is_active
          `,
        )
        .eq(
          'is_active',
          true,
        )
        .neq(
          'code',
          'owner',
        )
        .or(
          `tenant_id.is.null,tenant_id.eq.${tenantId}`,
        )
        .order(
          'name',
          {
            ascending:
              true,
          },
        );

      if (error) {
        console.error(
          'Loading tenant roles failed:',
          error,
        );

        return result(
          [],
          error,
        );
      }

      return result(
        data ?? [],
        null,
      );
    } catch (error) {
      console.error(
        'Loading tenant roles failed:',
        error,
      );

      return result(
        [],
        error,
      );
    }
  },

  /**
   * ==========================================================
   * INVITE USER
   * ==========================================================
   *
   * NOTE:
   * We intentionally keep the method name "createUser"
   * so your existing UserManagement.jsx does not necessarily
   * need to change its service call immediately.
   *
   * However, this now performs an INVITATION instead of
   * creating a password directly.
   */
  async createUser({
    tenantId,
    fullName,
    email,
    roleId,
  }) {
    try {
      const tenantError =
        validateTenantId(
          tenantId,
        );

      if (tenantError) {
        return result(
          null,
          tenantError,
        );
      }

      const cleanFullName =
        String(
          fullName || '',
        ).trim();

      const cleanEmail =
        String(
          email || '',
        )
          .trim()
          .toLowerCase();

      const cleanRoleId =
        String(
          roleId || '',
        ).trim();

      /**
       * Validation
       */
      if (!cleanFullName) {
        return result(
          null,
          new Error(
            'Full name is required.',
          ),
        );
      }

      if (!cleanEmail) {
        return result(
          null,
          new Error(
            'Email address is required.',
          ),
        );
      }

      /**
       * Basic email format check.
       */
      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailPattern.test(
          cleanEmail,
        )
      ) {
        return result(
          null,
          new Error(
            'Enter a valid email address.',
          ),
        );
      }

      if (!cleanRoleId) {
        return result(
          null,
          new Error(
            'Select a role for the user.',
          ),
        );
      }

      /**
       * ------------------------------------------------------
       * Call deployed Supabase Edge Function
       * ------------------------------------------------------
       *
       * IMPORTANT:
       *
       * Your deployed function name is:
       *
       * invite-tenant-user
       *
       * NOT:
       *
       * create-tenant-user
       */
      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          'invite-tenant-user',
          {
            body: {
              tenantId,
              tenant_id:
                tenantId,

              fullName:
                cleanFullName,

              full_name:
                cleanFullName,

              email:
                cleanEmail,

              roleId:
                cleanRoleId,

              role_id:
                cleanRoleId,
            },
          },
        );

      /**
       * Edge Function transport error.
       */
      if (error) {
        const parsedError =
          await parseFunctionError(
            error,
          );

        console.error(
          'Inviting tenant user failed:',
          parsedError,
        );

        return result(
          null,
          parsedError,
        );
      }

      /**
       * Edge Function returned an application error.
       */
      if (
        data?.success === false
      ) {
        return result(
          null,
          new Error(
            data?.error ||
              data?.message ||
              'The invitation could not be sent.',
          ),
        );
      }

      if (data?.error) {
        return result(
          null,
          new Error(
            data.error,
          ),
        );
      }

      /**
       * Successful invitation.
       */
      return result(
        data,
        null,
      );
    } catch (error) {
      console.error(
        'Inviting tenant user failed:',
        error,
      );

      return result(
        null,
        error,
      );
    }
  },

  /**
   * ==========================================================
   * SET MEMBER STATUS
   * ==========================================================
   */
  async setMemberStatus({
    tenantId,
    membershipId,
    status,
  }) {
    try {
      const tenantError =
        validateTenantId(
          tenantId,
        );

      if (tenantError) {
        return result(
          null,
          tenantError,
        );
      }

      if (!membershipId) {
        return result(
          null,
          new Error(
            'Membership ID is required.',
          ),
        );
      }

      if (
        ![
          'active',
          'inactive',
        ].includes(status)
      ) {
        return result(
          null,
          new Error(
            'Member status must be active or inactive.',
          ),
        );
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        'set_tenant_member_status',
        {
          requested_tenant_id:
            tenantId,

          requested_membership_id:
            membershipId,

          requested_status:
            status,
        },
      );

      if (error) {
        console.error(
          'Changing member status failed:',
          error,
        );

        return result(
          null,
          error,
        );
      }

      return result(
        data,
        null,
      );
    } catch (error) {
      console.error(
        'Changing member status failed:',
        error,
      );

      return result(
        null,
        error,
      );
    }
  },
};

export default userManagementService;