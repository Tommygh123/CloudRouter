import {
  Navigate,
  Outlet,
} from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

function PublicRoute() {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-300/30 border-t-indigo-300" />
          <p className="mt-4 text-sm text-indigo-100">
            Checking your session...
          </p>
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return <Outlet />;
}

export default PublicRoute;
