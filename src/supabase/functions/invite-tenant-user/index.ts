import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = Deno.env.get('APP_URL');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
    return jsonResponse({ error: 'The invitation function is not configured.' }, 500);
  }

  if (!authorization) {
    return jsonResponse({ error: 'Authentication is required.' }, 401);
  }

  let payload: {
    tenantId?: string;
    fullName?: string;
    email?: string;
    roleId?: string;
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const tenantId = payload.tenantId?.trim();
  const fullName = payload.fullName?.trim();
  const email = payload.email?.trim().toLowerCase();
  const roleId = payload.roleId?.trim();

  if (!tenantId || !fullName || !email || !roleId) {
    return jsonResponse({ error: 'Tenant, name, email, and role are required.' }, 400);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: callerData, error: callerError } = await callerClient.auth.getUser();

  if (callerError || !callerData.user) {
    return jsonResponse({ error: 'Your session is invalid or has expired.' }, 401);
  }

  const { data: invitationId, error: invitationError } = await callerClient.rpc(
    'invite_tenant_user',
    {
      requested_tenant_id: tenantId,
      requested_full_name: fullName,
      requested_email: email,
      requested_role_id: roleId,
    },
  );

  if (invitationError || !invitationId) {
    return jsonResponse(
      { error: invitationError?.message || 'The invitation record could not be created.' },
      invitationError?.code === '42501' ? 403 : 400,
    );
  }

  const redirectUrl = `${appUrl.replace(/\/$/, '')}/accept-invite?invitation=${encodeURIComponent(invitationId)}`;

  const { error: authInviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: redirectUrl,
      data: {
        full_name: fullName,
        invitation_id: invitationId,
        tenant_id: tenantId,
        role_id: roleId,
      },
    },
  );

  if (authInviteError) {
    await adminClient
      .from('tenant_user_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId)
      .eq('status', 'pending');

    return jsonResponse(
      {
        error: authInviteError.message.includes('already')
          ? 'This email already has an account. Existing-user invitations will be added in the next enhancement.'
          : authInviteError.message,
      },
      400,
    );
  }

  return jsonResponse({
    invitationId,
    message: 'Invitation email sent successfully.',
  });
});
