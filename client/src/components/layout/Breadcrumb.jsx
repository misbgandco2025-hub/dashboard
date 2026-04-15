import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  vendors: 'Vendors',
  'bank-loans': 'Bank Loans',
  subsidies: 'Subsidies',
  reports: 'Reports',
  configuration: 'Configuration',
  users: 'Users',
  profile: 'Profile',
  notifications: 'Notifications',
  new: 'New',
  edit: 'Edit',
};

const Breadcrumb = () => {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 0) return null;

  const crumbs = parts.map((part, i) => ({
    label: routeLabels[part] || (part.length === 24 ? 'Details' : part),
    path: '/' + parts.slice(0, i + 1).join('/'),
    isLast: i === parts.length - 1,
  }));

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      <Link to="/dashboard" className="hover:text-primary-600 flex items-center gap-1">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
          {crumb.isLast ? (
            <span className="text-gray-800 font-medium">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-primary-600">{crumb.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
};

export default Breadcrumb;
