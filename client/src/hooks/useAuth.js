import useAuthStore from '../store/authStore';
import { hasPermission } from '../utils/permissions';

const useAuth = () => {
  const { user, token, isAuthenticated, setAuth, logout, updateProfile, getRole } = useAuthStore();

  const can = (permission) => {
    const role = user?.role;
    if (!role) return false;
    return hasPermission(role, permission);
  };

  const isAdmin = user?.role === 'admin';
  const isDataEntry = user?.role === 'data-entry';
  const isViewer = user?.role === 'viewer';

  return { user, token, isAuthenticated, setAuth, logout, updateProfile, getRole, can, isAdmin, isDataEntry, isViewer };
};

export default useAuth;
