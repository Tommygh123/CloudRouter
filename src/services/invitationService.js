import { supabase } from '../lib/supabase';

export async function acceptTenantInvitation(
  invitationId,
  password,
) {
  if (!invitationId) {
    throw new Error(
      'Invitation ID is required.',
    );
  }

  if (!password || password.length < 8) {
    throw new Error(
      'Password must contain at least 8 characters.',
    );
  }

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    throw new Error(
      'Your invitation session is invalid or has expired.',
    );
  }

  const {
    error: passwordError,
  } = await supabase.auth.updateUser({
    password,
  });

  if (passwordError) {
    throw passwordError;
  }

  const {
    data,
    error,
  } = await supabase.rpc(
    'accept_tenant_invitation',
    {
      requested_invitation_id:
        invitationId,
    },
  );

  if (error) {
    throw error;
  }

  return data;
}