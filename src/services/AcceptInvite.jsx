import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AcceptInvite() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const invitationId = useMemo(() => {
    const params =
      new URLSearchParams(window.location.search);

    return (
      params.get('invitation') ||
      params.get('invitation_id') ||
      ''
    ).trim();
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        setChecking(true);
        setError('');

        /*
         * Supabase invitation links normally return
         * an authenticated recovery/invite session.
         */
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (!session) {
          setError(
            'The invitation session is not available. Please open the invitation link from your email again.',
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              'Could not verify the invitation.',
          );
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleAccept(event) {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!invitationId) {
      setError(
        'This invitation link does not contain an invitation ID.',
      );
      return;
    }

    if (password.length < 8) {
      setError(
        'Password must contain at least 8 characters.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        'The passwords do not match.',
      );
      return;
    }

    try {
      setLoading(true);

      /*
       * 1. Confirm invited Auth session exists.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          'Your invitation session has expired or is invalid. Please reopen the invitation email.',
        );
      }

      /*
       * 2. Let invited user choose their password.
       */
      const {
        error: passwordError,
      } = await supabase.auth.updateUser({
        password,
      });

      if (passwordError) {
        throw passwordError;
      }

      /*
       * 3. Accept CloudRouter tenant invitation.
       *
       * This RPC should create:
       *
       * profiles
       * tenant_users
       *
       * and mark invitation accepted.
       */
      const {
        data: membership,
        error: acceptError,
      } = await supabase.rpc(
        'accept_tenant_invitation',
        {
          requested_invitation_id:
            invitationId,
        },
      );

      if (acceptError) {
        throw acceptError;
      }

      setMessage(
        'Your CloudRouter account has been activated successfully.',
      );

      /*
       * 4. Send user into the application.
       */
      setTimeout(() => {
        navigate(
          '/dashboard',
          {
            replace: true,
          },
        );
      }, 800);

      return membership;
    } catch (err) {
      console.error(
        'Invitation acceptance failed:',
        err,
      );

      setError(
        err?.message ||
          'The invitation could not be accepted.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-8">
          <p className="text-center text-slate-600">
            Validating your invitation…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-8">
        <div className="mb-7">
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
            CloudRouter
          </div>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Accept invitation
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create your password to activate your
            CloudRouter workspace account.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        <form
          onSubmit={handleAccept}
          className="space-y-5"
        >
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              New password
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Minimum 8 characters"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Confirm password
            </span>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading
              ? 'Activating account…'
              : 'Activate account'}
          </button>
        </form>
      </div>
    </div>
  );
}