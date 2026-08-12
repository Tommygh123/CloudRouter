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
    resolvedUserId,
  } = useTenant();

  const workspaceResolvedForCurrentUser =
    Boolean(
      user?.id &&
      resolvedUserId === user.id,
    );

  if (
    authLoading ||
    tenantLoading ||
    (user && !workspaceResolvedForCurrentUser)
  ) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return (
    <Navigate
      to={
        hasWorkspace
          ? '/dashboard'
          : '/onboarding/business'
      }
      replace
    />
  );
}

export default HomeRedirect;
