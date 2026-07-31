
import { Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { useTenant } from '../hooks/useTenant';

export function HomeRedirect() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    hasWorkspace,
    loading: tenantLoading,
  } = useTenant();

  if (authLoading || tenantLoading) {
    return (
      <div>
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (!hasWorkspace) {
    return (
      <Navigate
        to="/business-setup"
        replace
      />
    );
  }

  return (
    <Navigate
      to="/dashboard"
      replace
    />
  );
}

export default HomeRedirect;

