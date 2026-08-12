import { Navigate } from 'react-router-dom';
import { useTenant } from '../hooks/useTenant';
import { hasRolePermission } from '../config/rolePermissions';

export default function RoleRoute({ permission, children }) {
  const { roleCode, loading } = useTenant();

  if (loading) return null;

  if (!hasRolePermission(roleCode, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
