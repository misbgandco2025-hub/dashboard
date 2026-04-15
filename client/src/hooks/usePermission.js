import useAuthStore from '../store/authStore';
import { hasPermission } from '../utils/permissions';

const usePermission = () => {
  const role = useAuthStore((s) => s.user?.role);
  const can = (permission) => (role ? hasPermission(role, permission) : false);
  return { can, role };
};

export default usePermission;
