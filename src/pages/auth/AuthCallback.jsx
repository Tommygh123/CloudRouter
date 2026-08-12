import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const [message, setMessage] = useState(
    'Completing authentication...',
  );

  useEffect(() => {
    let active = true;

    async function completeAuthentication() {
      try {
        const {
          data,
          error,
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (error || !data?.session?.user) {
          window.location.replace('/login');
          return;
        }

        setMessage(
          'Opening your CloudRouter workspace...',
        );

        /*
         * Do not duplicate workspace-routing logic here.
         * /dashboard + OnboardingGate is the one authoritative
         * place for deciding existing workspace vs new onboarding.
         */
        window.location.replace('/dashboard');
      } catch (error) {
        console.error(
          'Authentication callback failed:',
          error,
        );

        if (active) {
          window.location.replace('/login');
        }
      }
    }

    completeAuthentication();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <h1 className="mt-5 text-lg font-bold text-slate-900">
          CloudRouter
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {message}
        </p>
      </div>
    </main>
  );
}
