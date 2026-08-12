export const ROLE_PERMISSIONS = {
  owner: [
    'dashboard', 'get_started', 'plans', 'vouchers', 'customers', 'orders',
    'sites', 'devices', 'sessions', 'monitoring', 'analytics', 'reports',
    'users', 'settings',
  ],
  admin: [
    'dashboard', 'get_started', 'plans', 'vouchers', 'customers', 'orders',
    'sites', 'devices', 'sessions', 'monitoring', 'analytics', 'reports',
    'users', 'settings',
  ],
  cashier: [
    'dashboard', 'vouchers', 'customers', 'orders', 'sessions', 'reports',
  ],
  field_technician: [
    'dashboard', 'sites', 'devices', 'sessions', 'monitoring', 'reports',
  ],
  viewer: [
    'dashboard', 'sessions', 'monitoring', 'analytics', 'reports',
  ],
};

export function normalizeRoleCode(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (['fieldtech', 'field_tech', 'technician', 'fieldtechnician'].includes(raw)) {
    return 'field_technician';
  }

  if (['read_only', 'readonly', 'read_only_viewer'].includes(raw)) {
    return 'viewer';
  }

  return raw || 'viewer';
}

export function permissionsForRole(roleCode) {
  const normalized = normalizeRoleCode(roleCode);
  return ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS.viewer;
}

export function hasRolePermission(roleCode, permission) {
  return permissionsForRole(roleCode).includes(permission);
}

export function roleLabel(roleCode) {
  const normalized = normalizeRoleCode(roleCode);

  const labels = {
    owner: 'Owner',
    admin: 'Administrator',
    cashier: 'Cashier',
    field_technician: 'Field Technician',
    viewer: 'Viewer',
  };

  return labels[normalized] || 'Viewer';
}
