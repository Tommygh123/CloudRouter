import {
  Navigate,
  Outlet,
} from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useTenant } from '../hooks/useTenant';

function LoadingWorkspace() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />

        <p className="mt-4 text-sm font-medium text-slate-600">
          Preparing your CloudRouter workspace...
        </p>
      </div>
    </main>
  );
}

function OnboardingGate() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    hasWorkspace,
    loading: tenantLoading,
    error,
    refreshMemberships,
    resolvedUserId,
  } = useTenant();

  // =========================================================
  // WAIT FOR AUTHENTICATION
  // =========================================================

  if (authLoading) {
    return <LoadingWorkspace />;
  }

  // =========================================================
  // NOT SIGNED IN
  // =========================================================

  if (!user?.id) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // =========================================================
  // WAIT FOR TENANTCONTEXT
  //
  // IMPORTANT:
  // TenantContext itself loads memberships.
  // OnboardingGate must NOT call refreshMemberships()
  // automatically.
  // =========================================================

  const resolvedForCurrentUser =
    resolvedUserId === user.id;

  if (
    tenantLoading ||
    !resolvedForCurrentUser
  ) {
    return <LoadingWorkspace />;
  }

  // =========================================================
  // WORKSPACE LOOKUP ERROR
  // =========================================================

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">

          <h1 className="text-lg font-bold text-slate-900">
            Workspace check failed
          </h1>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {error?.message ||
              'CloudRouter could not load your workspace.'}
          </p>

          <button
            type="button"
            onClick={() =>
              refreshMemberships()
            }
            className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Try again
          </button>

        </div>
      </main>
    );
  }

  // =========================================================
  // EXISTING OWNER / ADMIN / CASHIER / TECHNICIAN / VIEWER
  // =========================================================

  if (hasWorkspace) {
    return <Outlet />;
  }

  // =========================================================
  // MEMBERSHIP CHECK FINISHED AND NO WORKSPACE EXISTS
  //
  // Only a genuine new trial/business owner should reach here.
  // =========================================================

  return (
    <Navigate
      to="/onboarding/business"
      replace
    />
  );
}

export default OnboardingGate;