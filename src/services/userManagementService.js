import { supabase } from '../lib/supabase';

function result(data = null, error = null) {
  return { data, error };
}

function validateTenantId(tenantId) {
  if (!tenantId) {
    return new Error('No active workspace was selected.');
  }

  return null;
}

async function parseFunctionError(error) {
  let message = error?.message || 'The request failed.';

  try {
    const responseBody = await error?.context?.json();

    if (responseBody?.error) {
      message = responseBody.error;
    } else if (responseBody?.message) {
      message = responseBody.message;
    }
  } catch {
    // Keep the original error message.
  }

  return new Error(message);
}

export const userManagementService = {
  async getMembers(tenantId) {
    try {
      const tenantError = validateTenantId(tenantId);

      if (tenantError) {
        return result([], tenantError);
      }

      const { data, error } = await supabase.rpc(
        'list_tenant_members',
        {
          requested_tenant_id: tenantId,
        },
      );

      return result(data ?? [], error);
    } catch (error) {
      console.error('Loading tenant members failed:', error);

      return result([], error);
    }
  },

  async getRoles(tenantId) {
    try {
      const tenantError = validateTenantId(tenantId);

      if (tenantError) {
        return result([], tenantError);
      }

      const { data, error } = await supabase
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
        .eq('is_active', true)
        .neq('code', 'owner')
        .or(
          `tenant_id.is.null,tenant_id.eq.${tenantId}`,
        )
        .order('name', {
          ascending: true,
        });

      return result(data ?? [], error);
    } catch (error) {
      console.error('Loading tenant roles failed:', error);

      return result([], error);
    }
  },

  async createUser({ tenantId, fullName, email, password, roleId }) {
    try {
      const tenantError = validateTenantId(tenantId);
      if (tenantError) return result(null, tenantError);
      const cleanFullName = fullName?.trim();
      const cleanEmail = email?.trim().toLowerCase();
      const cleanPassword = password || '';
      const cleanRoleId = roleId?.trim();
      if (!cleanFullName) return result(null, new Error('Full name is required.'));
      if (!cleanEmail) return result(null, new Error('Email address is required.'));
      if (cleanPassword.length < 8) return result(null, new Error('Temporary password must be at least 8 characters.'));
      if (!cleanRoleId) return result(null, new Error('Select a role for the user.'));
      const { data, error } = await supabase.functions.invoke('create-tenant-user', {
        body: { tenantId, fullName: cleanFullName, email: cleanEmail, password: cleanPassword, roleId: cleanRoleId },
      });
      if (error) return result(null, await parseFunctionError(error));
      if (data?.error) return result(null, new Error(data.error));
      return result(data, null);
    } catch (error) {
      console.error('Creating tenant user failed:', error);
      return result(null, error);
    }
  },

  async setMemberStatus({
    tenantId,
    membershipId,
    status,
  }) {
    try {
      const tenantError = validateTenantId(tenantId);

      if (tenantError) {
        return result(null, tenantError);
      }

      if (!membershipId) {
        return result(
          null,
          new Error('Membership ID is required.'),
        );
      }

      if (!['active', 'inactive'].includes(status)) {
        return result(
          null,
          new Error(
            'Member status must be active or inactive.',
          ),
        );
      }

      const { data, error } = await supabase.rpc(
        'set_tenant_member_status',
        {
          requested_tenant_id: tenantId,
          requested_membership_id:
            membershipId,
          requested_status: status,
        },
      );

      return result(data, error);
    } catch (error) {
      console.error(
        'Changing member status failed:',
        error,
      );

      return result(null, error);
    }
  },
};

export default userManagementService;