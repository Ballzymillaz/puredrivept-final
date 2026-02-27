import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, FileText, Truck, TrendingDown, DollarSign, X } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const EXPIRY_WARNING_DAYS = 30;
const PERFORMANCE_THRESHOLD = 4.0; // Stars

export default function FleetManagerNotifications({ currentUser }) {
  const isFleetManager = currentUser?.role?.includes('fleet_manager');
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set());

  // Fetch fleet manager data
  const { data: fleetManager } = useQuery({
    queryKey: ['fleet-manager', currentUser?.email],
    queryFn: async () => {
      const managers = await base44.entities.FleetManager.list();
      return managers.find(m => m.email === currentUser?.email);
    },
    enabled: isFleetManager && !!currentUser?.email,
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['fleet-drivers', fleetManager?.id],
    queryFn: async () => {
      if (!fleetManager?.id) return [];
      const allDrivers = await base44.entities.Driver.list();
      return allDrivers.filter(d => d.fleet_manager_id === fleetManager.id);
    },
    enabled: !!fleetManager?.id,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['fleet-documents', drivers.length],
    queryFn: async () => {
      if (drivers.length === 0) return [];
      const allDocs = await base44.entities.Document.list();
      return allDocs.filter(d => drivers.some(dr => dr.email === d.driver_email));
    },
    enabled: drivers.length > 0,
  });

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles', fleetManager?.id],
    queryFn: async () => {
      if (!fleetManager?.id) return [];
      const allVehicles = await base44.entities.Vehicle.list();
      return allVehicles.filter(v => v.fleet_manager_id === fleetManager.id);
    },
    enabled: !!fleetManager?.id,
  });

  // Fetch loans
  const { data: loans = [] } = useQuery({
    queryKey: ['fleet-loans', drivers.length],
    queryFn: async () => {
      if (drivers.length === 0) return [];
      const allLoans = await base44.entities.Loan.list();
      return allLoans.filter(l => 
        drivers.some(d => d.id === l.driver_id) && 
        (l.status === 'requested' || l.status === 'approved')
      );
    },
    enabled: drivers.length > 0,
  });

  // Build notifications
  const notifications = {
    documents: [],
    vehicles: [],
    performance: [],
    advances: [],
  };

  // Document expiry notifications
  documents.forEach(doc => {
    if (doc.expiry_date) {
      const daysUntilExpiry = differenceInDays(new Date(doc.expiry_date), new Date());
      if (daysUntilExpiry <= EXPIRY_WARNING_DAYS && daysUntilExpiry >= 0) {
        const driver = drivers.find(d => d.email === doc.driver_email);
        notifications.documents.push({
          id: `doc-${doc.id}`,
          type: 'document',
          title: `Documento próximo da expiração`,
          message: `${driver?.full_name}: ${doc.doc_type} expira em ${daysUntilExpiry} dias`,
          severity: daysUntilExpiry <= 7 ? 'critical' : 'warning',
          daysLeft: daysUntilExpiry,
        });
      }
    }
  });

  // Vehicle expiry notifications
  vehicles.forEach(vehicle => {
    ['insurance_expiry', 'inspection_expiry'].forEach(field => {
      if (vehicle[field]) {
        const daysUntilExpiry = differenceInDays(new Date(vehicle[field]), new Date());
        if (daysUntilExpiry <= EXPIRY_WARNING_DAYS && daysUntilExpiry >= 0) {
          const fieldLabel = field === 'insurance_expiry' ? 'Seguro' : 'Inspeção';
          notifications.vehicles.push({
            id: `vehicle-${vehicle.id}-${field}`,
            type: 'vehicle',
            title: `${fieldLabel} do veículo próximo da expiração`,
            message: `${vehicle.brand} ${vehicle.model} (${vehicle.license_plate}) ${fieldLabel.toLowerCase()} expira em ${daysUntilExpiry} dias`,
            severity: daysUntilExpiry <= 7 ? 'critical' : 'warning',
            daysLeft: daysUntilExpiry,
          });
        }
      }
    });
  });

  // Loan/Advance notifications
  loans.forEach(loan => {
    const driver = drivers.find(d => d.id === loan.driver_id);
    notifications.advances.push({
      id: `loan-${loan.id}`,
      type: 'advance',
      title: `Novo empréstimo pendente`,
      message: `${driver?.full_name} solicitou um empréstimo de €${(loan.amount || 0).toFixed(2)}`,
      severity: 'info',
    });
  });

  // Filter out dismissed notifications
  Object.keys(notifications).forEach(key => {
    notifications[key] = notifications[key].filter(n => !dismissedNotifications.has(n.id));
  });

  const allNotifications = [
    ...notifications.documents,
    ...notifications.vehicles,
    ...notifications.advances,
  ];

  const dismissNotification = (id) => {
    setDismissedNotifications(prev => new Set([...prev, id]));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getSeverityBadgeColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isFleetManager) {
    return null;
  }

  if (allNotifications.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-indigo-600">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Notificações Importantes ({allNotifications.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              Todos ({allNotifications.length})
            </TabsTrigger>
            <TabsTrigger value="documents">
              Docs ({notifications.documents.length})
            </TabsTrigger>
            <TabsTrigger value="vehicles">
              Veículos ({notifications.vehicles.length})
            </TabsTrigger>
            <TabsTrigger value="advances">
              Adiant. ({notifications.advances.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-2 mt-4">
            {allNotifications.map(notification => (
              <div key={notification.id} className={`border rounded-lg p-3 flex items-start justify-between ${getSeverityColor(notification.severity)}`}>
                <div className="flex gap-3 flex-1">
                  <div className="pt-0.5">
                    {notification.type === 'document' && <FileText className="w-4 h-4 text-gray-600" />}
                    {notification.type === 'vehicle' && <Truck className="w-4 h-4 text-gray-600" />}
                    {notification.type === 'advance' && <DollarSign className="w-4 h-4 text-gray-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`text-xs ${getSeverityBadgeColor(notification.severity)}`}>
                        {notification.severity === 'critical' ? '🔴 Crítico' :
                         notification.severity === 'warning' ? '🟡 Aviso' :
                         '🔵 Info'}
                      </Badge>
                      {notification.daysLeft !== undefined && (
                        <span className="text-xs text-gray-600">
                          {notification.daysLeft === 0 ? 'Expira hoje' : `${notification.daysLeft} dias restantes`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="documents" className="space-y-2 mt-4">
            {notifications.documents.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">Nenhuma notificação de documentos</p>
            ) : (
              notifications.documents.map(notification => (
                <div key={notification.id} className={`border rounded-lg p-3 flex items-start justify-between ${getSeverityColor(notification.severity)}`}>
                  <div className="flex gap-3 flex-1">
                    <FileText className="w-4 h-4 text-gray-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissNotification(notification.id)}
                    className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-2 mt-4">
            {notifications.vehicles.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">Nenhuma notificação de veículos</p>
            ) : (
              notifications.vehicles.map(notification => (
                <div key={notification.id} className={`border rounded-lg p-3 flex items-start justify-between ${getSeverityColor(notification.severity)}`}>
                  <div className="flex gap-3 flex-1">
                    <Truck className="w-4 h-4 text-gray-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissNotification(notification.id)}
                    className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="advances" className="space-y-2 mt-4">
            {notifications.advances.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">Nenhuma solicitação pendente</p>
            ) : (
              notifications.advances.map(notification => (
                <div key={notification.id} className={`border rounded-lg p-3 flex items-start justify-between ${getSeverityColor(notification.severity)}`}>
                  <div className="flex gap-3 flex-1">
                    <DollarSign className="w-4 h-4 text-gray-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissNotification(notification.id)}
                    className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}