import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { canAccess } from '../../utils/permissions';

const ProtectedRoute = ({ children, requiredPage }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPage && user?.role && !canAccess(user.role, requiredPage)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold text-gray-800">Access Denied</h1>
        <p className="text-gray-500">You don't have permission to view this page.</p>
        <a href="/dashboard" className="text-primary-600 hover:underline text-sm">Go to Dashboard</a>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
