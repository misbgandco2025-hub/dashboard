import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';

import { getNotifications, markAsRead, markAllAsRead } from '../services/notificationService';
import useNotificationStore from '../store/notificationStore';
import usePageTitle from '../hooks/usePageTitle';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { formatTimeAgo } from '../utils/dateFormat';
import { NOTIFICATION_COLORS } from '../utils/constants';

const Notifications = () => {
  usePageTitle('Notifications');
  const qc = useQueryClient();
  const store = useNotificationStore();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications({ limit: 50 }),
    select: (res) => res.data,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (data?.data) {
      store.setNotifications(data.data);
      store.setUnreadCount(data.data.filter((n) => !n.isRead).length);
    }
  }, [data]);

  const readMutation = useMutation({
    mutationFn: (id) => markAsRead(id),
    onSuccess: (_, id) => {
      store.markAsRead(id);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: () => {
      store.markAllAsRead();
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.data ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Notifications</h1>
          {unread > 0 && <Badge color="red">{unread} unread</Badge>}
        </div>
        {unread > 0 && (
          <Button variant="secondary" size="sm" icon={CheckCheck} onClick={() => readAllMutation.mutate()} loading={readAllMutation.isPending}>
            Mark all as read
          </Button>
        )}
      </div>

      {isLoading && <div className="py-12 text-center text-gray-400 text-sm">Loading notifications...</div>}

      {!isLoading && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <Bell className="h-10 w-10 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">No notifications yet</p>
          <p className="text-sm text-gray-400 mt-1">You'll be notified about status changes, queries, and assignments.</p>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n._id}
            className={`card p-4 flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow ${!n.isRead ? 'border-l-4 border-l-primary-500 bg-primary-50/30' : ''}`}
            onClick={() => !n.isRead && readMutation.mutate(n._id)}
          >
            <div className={`p-2 rounded-full shrink-0 ${
              n.category === 'query' ? 'bg-red-100 text-red-500' :
              n.category === 'assignment' ? 'bg-purple-100 text-purple-500' :
              n.category === 'document' ? 'bg-orange-100 text-orange-500' :
              'bg-blue-100 text-blue-500'
            }`}>
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.message}</p>
              <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
            </div>
            {!n.isRead && (
              <div className="h-2 w-2 rounded-full bg-primary-500 shrink-0 mt-1.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
