import { ROLES } from './constants';

// Permission matrix
const PERMISSIONS = {
  // Clients
  'clients.create': [ROLES.ADMIN, ROLES.DATA_ENTRY],
  'clients.read': [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER],
  'clients.update': [ROLES.ADMIN, ROLES.DATA_ENTRY],
  'clients.delete': [ROLES.ADMIN],

  // Vendors
  'vendors.create': [ROLES.ADMIN, ROLES.DATA_ENTRY],
  'vendors.read': [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER],
  'vendors.update': [ROLES.ADMIN, ROLES.DATA_ENTRY],
  'vendors.delete': [ROLES.ADMIN],

  // Bank Loans
  'bankLoans.create': [ROLES.ADMIN, ROLES.DATA_ENTRY],
  'bankLoans.read': [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER],
  'bankLoans.update': [ROLES.ADMIN, ROLES.DATA_ENTRY],
  'bankLoans.delete': [ROLES.ADMIN],
  'bankLoans.assign': [ROLES.ADMIN],

  // Subsidies
  'subsidies.create': [ROLES.ADMIN, ROLES.DATA_ENTRY],
  'subsidies.read': [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER],
  'subsidies.update': [ROLES.ADMIN, ROLES.DATA_ENTRY],
  'subsidies.delete': [ROLES.ADMIN],
  'subsidies.assign': [ROLES.ADMIN],

  // Config
  'config.manage': [ROLES.ADMIN],

  // Users
  'users.manage': [ROLES.ADMIN],

  // Fees (admin only)
  'fees.create': [ROLES.ADMIN],
  'fees.read':   [ROLES.ADMIN],
  'fees.update': [ROLES.ADMIN],
  'fees.delete': [ROLES.ADMIN],

  // Reports
  'reports.view': [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER],
  'reports.performance': [ROLES.ADMIN, ROLES.VIEWER],
  'reports.audit': [ROLES.ADMIN],

  // Dashboard
  'dashboard.myTasks': [ROLES.DATA_ENTRY],
  'dashboard.performance': [ROLES.ADMIN, ROLES.VIEWER],
};

export const hasPermission = (role, permission) => {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
};

export const canAccess = (role, page) => {
  const pagePerms = {
    configuration: [ROLES.ADMIN],
    users: [ROLES.ADMIN],
    fees: [ROLES.ADMIN],
    reports: [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER],
  };
  const allowed = pagePerms[page];
  if (!allowed) return true;
  return allowed.includes(role);
};

export const getNavItems = (role) => {
  const all = [
    { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER] },
    { path: '/clients', label: 'Clients', icon: 'Users', roles: [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER] },
    { path: '/vendors', label: 'Vendors', icon: 'Building2', roles: [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER] },
    { path: '/bank-loans', label: 'Bank Loans', icon: 'Landmark', roles: [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER] },
    { path: '/subsidies', label: 'Subsidies', icon: 'HandCoins', roles: [ROLES.ADMIN, ROLES.DATA_ENTRY, ROLES.VIEWER] },
    { path: '/reports', label: 'Reports', icon: 'BarChart3', roles: [ROLES.ADMIN, ROLES.VIEWER] },
    { path: '/fees', label: 'Fees', icon: 'Receipt', roles: [ROLES.ADMIN] },
    { path: '/configuration', label: 'Configuration', icon: 'Settings2', roles: [ROLES.ADMIN] },
    { path: '/users', label: 'Users', icon: 'UserCog', roles: [ROLES.ADMIN] },
  ];
  return all.filter((item) => item.roles.includes(role));
};
