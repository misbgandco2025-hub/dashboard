import { BADGE_COLORS, STATUS_COLORS } from '../../utils/constants';

const Badge = ({
  children,
  color = 'gray',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const colorClass = BADGE_COLORS[color] || BADGE_COLORS.gray;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : size === 'lg' ? 'text-sm px-3 py-1' : 'text-xs px-2.5 py-0.5';

  return (
    <span className={`badge ${colorClass} ${sizeClass} ${className}`}>
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${colorClass.replace('text-', 'bg-').replace('-800', '-500').replace('-700', '-400')}`} />
      )}
      {children}
    </span>
  );
};

export const StatusBadge = ({ status, size }) => {
  const color = STATUS_COLORS[status] || 'gray';
  return <Badge color={color} size={size} dot>{status || '—'}</Badge>;
};

export default Badge;
