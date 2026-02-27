import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const ICON_MAP = {
  info: Info,
  warning: AlertTriangle,
  alert: AlertCircle,
  success: CheckCircle2,
};

const COLOR_MAP = {
  info: 'bg-blue-50 border-blue-200',
  warning: 'bg-yellow-50 border-yellow-200',
  alert: 'bg-red-50 border-red-200',
  success: 'bg-green-50 border-green-200',
};

const TEXT_COLOR_MAP = {
  info: 'text-blue-800',
  warning: 'text-yellow-800',
  alert: 'text-red-800',
  success: 'text-green-800',
};

export default function NotificationCenter({ currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications-real-time'],
    queryFn: async () => {
      const userEmail = currentUser?.email;
      const userRole = currentUser?.role;
      
      return await base44.entities.Notification.filter({
        $or: [
          { recipient_email: userEmail },
          { recipient_email: 'all' },
          { recipient_role: userRole },
        ]
      });
    },
    refetchInterval: 5000, // Poll every 5 seconds
    enabled: !!currentUser,
  });

  useEffect(() => {
    const activeNotifications = notifs
      .filter(n => !dismissed.has(n.id))
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 5);
    
    setNotifications(activeNotifications);
  }, [notifs, dismissed]);

  const handleDismiss = (id) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm space-y-2">
      <AnimatePresence>
        {notifications.map(notif => {
          const Icon = ICON_MAP[notif.type] || Info;
          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 400, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 400 }}
              className={`border rounded-lg p-4 ${COLOR_MAP[notif.type] || COLOR_MAP.info} shadow-lg`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${TEXT_COLOR_MAP[notif.type] || TEXT_COLOR_MAP.info}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${TEXT_COLOR_MAP[notif.type] || TEXT_COLOR_MAP.info}`}>
                    {notif.title}
                  </p>
                  <p className={`text-xs mt-1 ${TEXT_COLOR_MAP[notif.type] || TEXT_COLOR_MAP.info} opacity-75`}>
                    {notif.message}
                  </p>
                </div>
                <button
                  onClick={() => handleDismiss(notif.id)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}