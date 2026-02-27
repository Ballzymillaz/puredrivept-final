import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, X, Check, FileText, Wallet, Users, AlertCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ICON_MAP = {
  document_expiring: FileText,
  document_approved: Check,
  document_rejected: X,
  payment_pending: AlertCircle,
  payment_confirmed: Wallet,
  application_new: Users,
  vehicle_status: AlertCircle,
  driver_status: Users,
  info: Info,
};

const COLOR_MAP = {
  document_expiring: 'bg-amber-50 border-amber-200 text-amber-900',
  document_approved: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  document_rejected: 'bg-red-50 border-red-200 text-red-900',
  payment_pending: 'bg-orange-50 border-orange-200 text-orange-900',
  payment_confirmed: 'bg-blue-50 border-blue-200 text-blue-900',
  application_new: 'bg-indigo-50 border-indigo-200 text-indigo-900',
  vehicle_status: 'bg-purple-50 border-purple-200 text-purple-900',
  driver_status: 'bg-pink-50 border-pink-200 text-pink-900',
  info: 'bg-gray-50 border-gray-200 text-gray-900',
};

export default function NotificationCenter() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => base44.entities.Notification.filter({ user_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30s
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notifId) => {
      return base44.entities.Notification.update(notifId, { read: true, read_at: new Date().toISOString() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (notifId) => {
    markAsReadMutation.mutate(notifId);
  };

  const handleMarkAllAsRead = () => {
    notifications.filter(n => !n.read).forEach(n => {
      markAsReadMutation.mutate(n.id);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="border-b p-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notificações</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} className="text-xs text-indigo-600 hover:text-indigo-700">
                Marcar como lidas
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sem notificações</p>
              </div>
            ) : (
              notifications.map(notif => {
                const Icon = ICON_MAP[notif.type] || Info;
                const colors = COLOR_MAP[notif.type];
                return (
                  <div
                    key={notif.id}
                    className={`border-b p-3 cursor-pointer hover:bg-gray-50 transition ${!notif.read ? 'bg-blue-50' : ''}`}
                    onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                  >
                    <div className="flex gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${colors}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm text-gray-900 leading-tight">{notif.title}</p>
                          {!notif.read && <div className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 leading-tight">{notif.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(notif.created_date), { locale: ptBR, addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t p-3 bg-gray-50 text-center">
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}