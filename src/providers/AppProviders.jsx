import {
  AuthProvider,
} from '../contexts/AuthContext';

import {
  TenantProvider,
} from '../contexts/TenantContext';

export function AppProviders({
  children,
}) {
  return (
    <AuthProvider>
      <TenantProvider>
        {children}
      </TenantProvider>
    </AuthProvider>
  );
}

export default AppProviders;