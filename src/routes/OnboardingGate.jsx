import {
  Navigate,
  Outlet,
} from 'react-router-dom';

import { useTenant } from '../hooks/useTenant';

function OnboardingGate() {
  const {
    hasWorkspace,
    loading,
    error,
    refreshMemberships,
  } = useTenant();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="mt-4 text-sm text-slate-600">
            Preparing your workspace...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            Workspace check failed
          </h1>
          <p className="mt-2 text-sm text-red-700">
            {error.message || 'Unable to load your workspace.'}
          </p>
          <button
            type="button"
            onClick={refreshMemberships}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!hasWorkspace) {
    return (
      <Navigate
        to="/onboarding/business"
        replace
      />
    );
  }

  return <Outlet />;
}

export default OnboardingGate;
