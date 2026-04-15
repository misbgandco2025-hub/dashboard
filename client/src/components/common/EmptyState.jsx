import { Inbox } from 'lucide-react';
import Button from './Button';

const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No data found',
  description = '',
  action,
  actionLabel,
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
    <div className="p-4 bg-gray-100 rounded-full mb-4">
      <Icon className="h-10 w-10 text-gray-400" />
    </div>
    <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
    {description && <p className="text-sm text-gray-400 max-w-xs mb-5">{description}</p>}
    {action && actionLabel && (
      <Button onClick={action} size="sm">{actionLabel}</Button>
    )}
  </div>
);

export default EmptyState;
