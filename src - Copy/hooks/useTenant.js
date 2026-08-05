import { useContext } from 'react';

import {
  TenantContext,
} from '../contexts/TenantContext';

export function useTenant() {
  const context =
    useContext(TenantContext);

  if (context === null) {
    throw new Error(
      'useTenant must be used inside TenantProvider.',
    );
  }

  return context;
}

export default useTenant;