import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import toast from 'react-hot-toast';

import { supabase } from '../../lib/supabase';

function AcceptInvitation() {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const invitationId =
    searchParams.get('invitation');

  const [session, setSession] =
    useState(null);

  const [invitation, setInvitation] =
    useState(null);

  const [password, setPassword] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [
    loadingInvitation,
    setLoadingInvitation,
  ] = useState(false);

  const [
    accepting,
    setAccepting,
  ] = useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    let active = true;

    async function initialiseAuth() {
      try {
        /*
         * Give Supabase a moment to process
         * the tokens returned in the invitation URL.
         */
        await new Promise((resolve) => {
          window.setTimeout(resolve, 500);
        });

        const {
          data,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (sessionError) {
          console.error(
            'Invitation session error:',
            sessionError,
          );
        }

        if (data?.session) {
          setSession(data.session);
        }
      } catch (initialiseError) {
        console.error(
          'Could not initialise invitation session:',
          initialiseError,
        );
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (event, nextSession) => {
          console.log(
            'Invitation auth event:',
            event,
          );

          if (!active) {
            return;
          }

          if (nextSession) {
            setSession(nextSession);
            setCheckingSession(false);
          }

          if (event === 'SIGNED_OUT') {
            setSession(null);
          }
        },
      );

    initialiseAuth();

    return () => {
      active = false;

      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (checkingSession) {
      return;
    }

    if (!invitationId) {
      setError(
        'The invitation link is incomplete. Open the latest invitation email and click its link again.',
      );

      return;
    }

    if (!session?.user) {
      setError(
        'No invitation session was found. Open the latest invitation email and click its link again.',
      );

      return;
    }

    loadInvitation();
  }, [
    checkingSession,
    invitationId,
    session?.user?.id,
  ]);

  async function loadInvitation() {
    try {
      setLoadingInvitation(true);
      setError('');

      const {
        data,
        error: invitationError,
      } =
        await supabase.rpc(
          'get_invitation_for_acceptance',
          {
            requested_invitation_id:
              invitationId,
          },
        );

      if (invitationError) {
        throw invitationError;
      }

      const record =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!record) {
        throw new Error(
          'This invitation does not exist or is no longer available.',
        );
      }

      const invitedEmail =
        record.email
          ?.trim()
          .toLowerCase();

      const signedInEmail =
        session.user.email
          ?.trim()
          .toLowerCase();

      if (
        !invitedEmail ||
        invitedEmail !== signedInEmail
      ) {
        throw new Error(
          `This invitation was sent to ${record.email}, but the current account is ${session.user.email}.`,
        );
      }

      if (
        record.status !== 'pending'
      ) {
        throw new Error(
          `This invitation is ${record.status} and cannot be accepted.`,
        );
      }

      if (
        record.expires_at &&
        new Date(record.expires_at) <
          new Date()
      ) {
        throw new Error(
          'This invitation has expired. Ask the administrator to send a new invitation.',
        );
      }

      setInvitation(record);
    } catch (loadError) {
      console.error(
        'Loading invitation failed:',
        loadError,
      );

      setError(
        loadError.message ||
          'The invitation could not be loaded.',
      );
    } finally {
      setLoadingInvitation(false);
    }
  }

  async function handleAccept(
    event,
  ) {
    event.preventDefault();

    try {
      setAccepting(true);
      setError('');

      if (!session?.user) {
        throw new Error(
          'Your invitation session has expired. Open the latest invitation email again.',
        );
      }

      if (!invitation) {
        throw new Error(
          'The invitation has not loaded.',
        );
      }

      if (password.length < 8) {
        throw new Error(
          'Password must contain at least 8 characters.',
        );
      }

      if (
        password !== confirmPassword
      ) {
        throw new Error(
          'The passwords do not match.',
        );
      }

      const {
        error: updateUserError,
      } =
        await supabase.auth.updateUser({
          password,
          data: {
            full_name:
              invitation.full_name,
          },
        });

      if (updateUserError) {
        throw updateUserError;
      }

      const {
        error: acceptanceError,
      } =
        await supabase.rpc(
          'accept_tenant_invitation',
          {
            requested_invitation_id:
              invitationId,
          },
        );

      if (acceptanceError) {
        throw acceptanceError;
      }

      toast.success(
        'Invitation accepted successfully.',
      );

      navigate('/dashboard', {
        replace: true,
      });
    } catch (acceptError) {
      console.error(
        'Accepting invitation failed:',
        acceptError,
      );

      const message =
        acceptError.message ||
        'The invitation could not be accepted.';

      setError(message);
      toast.error(message);
    } finally {
      setAccepting(false);
    }
  }

  if (
    checkingSession ||
    loadingInvitation
  ) {
    return (
      <main className="min-h-screen bg-slate-100 px-4">
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
          <section className="w-full rounded-2xl bg-white p-8 text-center shadow-lg">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

            <h1 className="mt-5 text-xl font-semibold text-slate-900">
              Opening invitation
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Please wait while we verify
              your invitation.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <section className="w-full rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-slate-900">
            Accept invitation
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Complete your account setup
            to join the workspace.
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {invitation && (
            <>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  Invited user
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {invitation.full_name}
                </p>

                <p className="text-sm text-slate-600">
                  {invitation.email}
                </p>

                {invitation.role_name && (
                  <p className="mt-2 text-sm text-slate-600">
                    Role:{' '}
                    <span className="font-medium">
                      {
                        invitation.role_name
                      }
                    </span>
                  </p>
                )}
              </div>

              <form
                className="mt-6 space-y-4"
                onSubmit={handleAccept}
              >
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Create password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    minLength={8}
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value,
                      )
                    }
                    minLength={8}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={accepting}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {accepting
                    ? 'Accepting invitation...'
                    : 'Accept invitation'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default AcceptInvitation;