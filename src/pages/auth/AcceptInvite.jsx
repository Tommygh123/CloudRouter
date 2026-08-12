import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import toast from 'react-hot-toast';

import { supabase } from '../../lib/supabase';

export default function AcceptInvite() {
  // ==========================================================
  // INVITATION ID FROM QUERY STRING
  //
  // Example:
  // /accept-invite?invitation=xxxxxxxx
  // ==========================================================

  const invitationId = useMemo(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    return (
      params.get('invitation') ||
      params.get('invitation_id') ||
      ''
    ).trim();
  }, []);

  // ==========================================================
  // STATE
  // ==========================================================

  const [sessionUser, setSessionUser] =
    useState(null);

  const [password, setPassword] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [checking, setChecking] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState('');

  // ==========================================================
  // INITIALISE INVITATION AUTH SESSION
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    async function initialiseInvitation() {
      try {
        setChecking(true);
        setError('');

        // ----------------------------------------------------
        // 1. Read Supabase tokens from URL hash.
        //
        // Supabase invitation URL normally looks like:
        //
        // /accept-invite?invitation=xxx
        // #access_token=...
        // &refresh_token=...
        // &type=invite
        // ----------------------------------------------------

        const hashParams =
          new URLSearchParams(
            window.location.hash.replace(
              /^#/,
              '',
            ),
          );

        // ----------------------------------------------------
        // 2. Detect Supabase Auth errors.
        // ----------------------------------------------------

        const authError =
          hashParams.get(
            'error_description',
          ) ||
          hashParams.get('error');

        if (authError) {
          throw new Error(
            decodeURIComponent(
              authError,
            ),
          );
        }

        const accessToken =
          hashParams.get(
            'access_token',
          );

        const refreshToken =
          hashParams.get(
            'refresh_token',
          );

        // ----------------------------------------------------
        // 3. Explicitly establish Supabase session.
        // ----------------------------------------------------

        if (
          accessToken &&
          refreshToken
        ) {
          const {
            data,
            error: setSessionError,
          } =
            await supabase.auth.setSession({
              access_token:
                accessToken,

              refresh_token:
                refreshToken,
            });

          if (setSessionError) {
            throw setSessionError;
          }

          if (
            data?.session?.user
          ) {
            if (mounted) {
              setSessionUser(
                data.session.user,
              );
            }

            // ----------------------------------------------
            // Remove sensitive auth tokens from URL after
            // Supabase has persisted the session.
            // ----------------------------------------------

            const cleanUrl =
              `${window.location.pathname}${window.location.search}`;

            window.history.replaceState(
              {},
              document.title,
              cleanUrl,
            );

            return;
          }
        }

        // ----------------------------------------------------
        // 4. Fallback:
        // Maybe Supabase already stored the session.
        // ----------------------------------------------------

        const {
          data:
            existingSessionData,
          error:
            existingSessionError,
        } =
          await supabase.auth.getSession();

        if (
          existingSessionError
        ) {
          throw existingSessionError;
        }

        if (
          existingSessionData
            ?.session?.user
        ) {
          if (mounted) {
            setSessionUser(
              existingSessionData
                .session.user,
            );
          }

          return;
        }

        throw new Error(
          'The invitation session is unavailable. Please open the latest invitation link from your email again.',
        );
      } catch (err) {
        console.error(
          'Invitation validation failed:',
          err,
        );

        if (mounted) {
          setError(
            err?.message ||
              'The invitation could not be validated.',
          );
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    initialiseInvitation();

    // ========================================================
    // LISTEN FOR AUTH CHANGES
    // ========================================================

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (
          event,
          session,
        ) => {
          if (!mounted) {
            return;
          }

          if (session?.user) {
            setSessionUser(
              session.user,
            );
          }

          if (
            event ===
            'SIGNED_OUT'
          ) {
            setSessionUser(null);
          }
        },
      );

    return () => {
      mounted = false;

      authListener?.subscription
        ?.unsubscribe();
    };
  }, []);

  // ==========================================================
  // ACCEPT INVITATION
  // ==========================================================

  async function handleSubmit(
    event,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError('');

    // --------------------------------------------------------
    // Validate invitation
    // --------------------------------------------------------

    if (!invitationId) {
      setError(
        'This invitation link does not contain a valid invitation ID.',
      );

      return;
    }

    if (!sessionUser?.id) {
      setError(
        'Your invitation session is not active. Please reopen the latest invitation email.',
      );

      return;
    }

    // --------------------------------------------------------
    // Validate password
    // --------------------------------------------------------

    if (
      password.length < 8
    ) {
      setError(
        'Password must contain at least 8 characters.',
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        'The passwords do not match.',
      );

      return;
    }

    try {
      setSubmitting(true);

      // ======================================================
      // 1. SET PASSWORD
      // ======================================================

      const {
        error: passwordError,
      } =
        await supabase.auth.updateUser({
          password,
        });

      if (passwordError) {
        throw passwordError;
      }

      // ======================================================
      // 2. ACCEPT TENANT INVITATION
      //
      // Database function:
      //
      // accept_tenant_invitation(uuid)
      //
      // creates/activates tenant_users membership using
      // the role stored on the invitation.
      // ======================================================

      const {
        data: membershipId,
        error: membershipError,
      } =
        await supabase.rpc(
          'accept_tenant_invitation',
          {
            requested_invitation_id:
              invitationId,
          },
        );

      if (membershipError) {
        throw membershipError;
      }

      if (!membershipId) {
        throw new Error(
          'The workspace membership could not be created.',
        );
      }

      // ======================================================
      // 3. REFRESH AUTH SESSION
      // ======================================================

      const {
        error: refreshError,
      } =
        await supabase.auth.refreshSession();

      if (refreshError) {
        console.warn(
          'Session refresh warning:',
          refreshError,
        );
      }

      // ======================================================
      // 4. SUCCESS
      // ======================================================

      toast.success(
        'Invitation accepted. Opening your workspace...',
      );

      // ======================================================
      // 5. IMPORTANT:
      //
      // DO NOT use:
      //
      // navigate('/dashboard')
      //
      // here.
      //
      // The tenant_users row has JUST been created.
      // The current in-memory TenantContext may still contain
      // memberships = [].
      //
      // A full navigation reload makes CloudRouter start with:
      //
      // Auth user
      //    ↓
      // TenantContext
      //    ↓
      // cloudrouter_my_memberships()
      //    ↓
      // Kanwave membership
      //    ↓
      // correct role
      //    ↓
      // role dashboard
      //
      // This removes the need for the user to manually refresh.
      // ======================================================

      window.setTimeout(() => {
        window.location.replace(
          '/dashboard',
        );
      }, 500);
    } catch (err) {
      console.error(
        'Invitation acceptance failed:',
        err,
      );

      const message =
        err?.message ||
        'The invitation could not be accepted.';

      setError(message);

      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================================
  // RETURN TO LOGIN
  // ==========================================================

  async function handleReturnToLogin() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn(
        'Sign out warning:',
        err,
      );
    }

    window.location.replace(
      '/login',
    );
  }

  // ==========================================================
  // CHECKING VIEW
  // ==========================================================

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white">
            CR
          </div>

          <div className="mx-auto mt-7 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

          <h1 className="mt-6 text-2xl font-bold text-slate-950">
            Opening invitation
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Please wait while CloudRouter verifies your workspace invitation.
          </p>
        </section>
      </main>
    );
  }

  // ==========================================================
  // MAIN VIEW
  // ==========================================================

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">

        <div className="grid w-full overflow-hidden rounded-[32px] bg-white shadow-2xl lg:grid-cols-2">

          {/* =================================================
              BRANDING PANEL
          ================================================== */}

          <section className="hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">

            <div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold">
                CR
              </div>

              <h1 className="mt-8 text-4xl font-bold leading-tight">
                Welcome to CloudRouter
              </h1>

              <p className="mt-4 max-w-md text-base leading-7 text-blue-100">
                Your administrator has invited you to join their CloudRouter workspace.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
              <p className="font-semibold">
                Role-based workspace access
              </p>

              <p className="mt-2 text-sm leading-6 text-blue-100">
                Your assigned role controls the dashboard, menus, reports, and management tools available to you.
              </p>
            </div>

          </section>

          {/* =================================================
              ACTIVATION FORM
          ================================================== */}

          <section className="p-8 sm:p-10 lg:p-12">

            <div className="mx-auto max-w-md">

              <div className="lg:hidden">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 font-bold text-white">
                  CR
                </div>
              </div>

              <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
                Workspace invitation
              </p>

              <h2 className="mt-3 text-3xl font-bold text-slate-950">
                Activate your account
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Create your password to complete your CloudRouter account setup.
              </p>

              {/* =============================================
                  INVITED ACCOUNT
              ============================================== */}

              {sessionUser?.email && (
                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">

                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Invited account
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {sessionUser.email}
                  </p>

                </div>
              )}

              {/* =============================================
                  ERROR
              ============================================== */}

              {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                  {error}
                </div>
              )}

              {/* =============================================
                  FORM
              ============================================== */}

              <form
                onSubmit={handleSubmit}
                className="mt-7 space-y-5"
              >

                <label className="block">

                  <span className="text-sm font-semibold text-slate-700">
                    Create password
                  </span>

                  <input
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
                    placeholder="Minimum 8 characters"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />

                </label>

                <label className="block">

                  <span className="text-sm font-semibold text-slate-700">
                    Confirm password
                  </span>

                  <input
                    type="password"
                    value={
                      confirmPassword
                    }
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value,
                      )
                    }
                    minLength={8}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />

                </label>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !sessionUser
                  }
                  className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? 'Activating account...'
                    : 'Activate account'}
                </button>

              </form>

              <button
                type="button"
                onClick={
                  handleReturnToLogin
                }
                className="mt-5 w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Return to login
              </button>

              <p className="mt-7 text-center text-xs leading-5 text-slate-400">
                This invitation is intended only for the recipient of the invitation email.
              </p>

            </div>

          </section>

        </div>

      </div>
    </main>
  );
}