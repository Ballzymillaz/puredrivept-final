import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, TrendingDown, Zap, Shield, FileText, AlertCircle, CheckCircle2, Clock, Car } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import StatusBadge from '../components/shared/StatusBadge';

const fmt = (v) => `€${(v || 0).toFixed(2)}`;

const DOC_TYPE_LABELS = {
  driving_license: 'Carta de condução',
  tvde_certificate: 'Certificado TVDE',
  id_card: 'Cartão de cidadão',
  iban_proof: 'Comprovativo IBAN',
  insurance: 'Seguro',
  periodic_inspection: 'Inspeção periódica',
  vehicle_booklet: 'Livro do veículo',
};

export default function DriverDashboard({ currentUser }) {
  const [driver, setDriver] = useState(null);
  const [loadingDriver, setLoadingDriver] = useState(true);

  // Find driver by email from currentUser prop (passed by Layout)
  useEffect(() => {
    if (!currentUser?.email) return;
    base44.entities.Driver.filter({ email: currentUser.email }, '-created_date', 1)
      .then(results => {
        setDriver(results?.[0] || null);
        setLoadingDriver(false);
      })
      .catch(() => setLoadingDriver(false));
  }, [currentUser?.email]);

  const { data: payments = [] } = useQuery({
    queryKey: ['my-payments', driver?.id],
    queryFn: () => base44.entities.WeeklyPayment.filter({ driver_id: driver.id }, '-week_start', 20),
    enabled: !!driver?.id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['my-docs', currentUser?.email],
    queryFn: () => base44.entities.Document.filter({ driver_email: currentUser?.email }, '-created_date'),
    enabled: !!currentUser?.email,
  });

  const { data: onboarding = null } = useQuery({
    queryKey: ['my-onboarding', driver?.id],
    queryFn: async () => {
      const results = await base44.entities.DriverOnboarding.filter({ driver_id: driver?.id });
      return results?.[0] || null;
    },
    enabled: !!driver?.id,
  });

  const { data: vehicle = null } = useQuery({
    queryKey: ['my-vehicle', driver?.assigned_vehicle_id],
    queryFn: async () => {
      if (!driver?.assigned_vehicle_id) return null;
      const results = await base44.entities.Vehicle.filter({ id: driver.assigned_vehicle_id });
      return results?.[0] || null;
    },
    enabled: !!driver?.assigned_vehicle_id,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['my-notifications', currentUser?.email],
    queryFn: () => base44.entities.Notification.filter({ 
      $or: [
        { recipient_email: currentUser?.email },
        { recipient_email: 'all' },
        { recipient_role: 'driver' }
      ]
    }, '-created_date', 10),
    enabled: !!currentUser?.email,
  });

  const paidPayments = payments.filter(p => p.status === 'paid');
  const pendingPayments = payments.filter(p => ['draft', 'approved', 'processing'].includes(p.status));
  const totalGross = paidPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
  const totalNet = paidPayments.reduce((s, p) => s + (p.net_amount || 0), 0);
  const totalUpi = paidPayments.reduce((s, p) => s + (p.upi_earned || 0), 0);

  const expiringDocs = documents.filter(d => {
    if (!d.expiry_date) return false;
    const days = differenceInDays(new Date(d.expiry_date), new Date());
    return days <= 30 && days > 0;
  });

  const expiredDocs = documents.filter(d => {
    if (!d.expiry_date) return false;
    return isPast(new Date(d.expiry_date));
  });

  if (loadingDriver) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 animate-pulse" />
          <p className="text-gray-400 text-sm">A carregar dados...</p>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-orange-400 mx-auto" />
          <p className="text-gray-600 font-medium">Perfil de motorista não encontrado</p>
          <p className="text-gray-400 text-sm">O seu email ({currentUser?.email}) não está associado a nenhum motorista.</p>
        </div>
      </div>
    );
  }

  const ONBOARDING_STEPS = {
    documents: { label: 'Documentos', icon: FileText },
    background_check: { label: 'Antecedentes', icon: Shield },
    vehicle_assignment: { label: 'Veículo', icon: Car },
    completed: { label: 'Concluído', icon: CheckCircle2 },
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{driver.full_name}</h1>
            <p className="text-indigo-200 text-sm mt-0.5">{driver.email}</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-xs">Tipo de contrato</p>
            <p className="text-white font-semibold">{driver.contract_type?.replace('_', ' ') || '—'}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Badge className="bg-white/20 text-white border-0 text-xs">{driver.status}</Badge>
          {vehicle && <Badge className="bg-white/20 text-white border-0 text-xs">{vehicle.brand} {vehicle.model}</Badge>}
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        {expiredDocs.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{expiredDocs.length} documento(s) expirado(s)</p>
              <p className="text-xs text-red-600">Ação necessária para manter a sua conta ativa</p>
            </div>
          </div>
        )}
        {expiringDocs.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">{expiringDocs.length} documento(s) a expirar em breve</p>
              <p className="text-xs text-amber-600">{expiringDocs.map(d => DOC_TYPE_LABELS[d.doc_type] || d.doc_type).join(', ')}</p>
            </div>
          </div>
        )}
        {vehicle && vehicle.inspection_expiry && differenceInDays(new Date(vehicle.inspection_expiry), new Date()) <= 30 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800">Inspeção do veículo a vencer</p>
              <p className="text-xs text-orange-600">{format(new Date(vehicle.inspection_expiry), 'dd/MM/yyyy')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Progress */}
      {onboarding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Estado do Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {Object.entries(ONBOARDING_STEPS).map(([key, step]) => {
                const isCompleted = 
                  (key === 'documents' && onboarding.documents_status === 'approved') ||
                  (key === 'background_check' && onboarding.background_check_status === 'approved') ||
                  (key === 'vehicle_assignment' && onboarding.vehicle_assignment_status === 'assigned') ||
                  (key === 'completed' && onboarding.current_step === 'completed');
                const isCurrent = onboarding.current_step === key;
                const StepIcon = step.icon;

                return (
                  <div key={key} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-green-100' : isCurrent ? 'bg-indigo-100' : 'bg-gray-100'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <StepIcon className={`w-4 h-4 ${isCurrent ? 'text-indigo-600' : 'text-gray-400'}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isCompleted ? 'text-green-700' : isCurrent ? 'text-indigo-700' : 'text-gray-500'}`}>
                        {step.label}
                      </p>
                      {isCurrent && <p className="text-xs text-indigo-600">Etapa atual</p>}
                      {isCompleted && <p className="text-xs text-green-600">Concluída</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Info */}
      {vehicle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Car className="w-4 h-4" />
              Veículo Atribuído
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Marca e Modelo</p>
                <p className="font-semibold">{vehicle.brand} {vehicle.model}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Matrícula</p>
                <p className="font-semibold">{vehicle.license_plate}</p>
              </div>
              {vehicle.color && (
                <div>
                  <p className="text-gray-500 text-xs">Cor</p>
                  <p className="font-semibold">{vehicle.color}</p>
                </div>
              )}
              {vehicle.fuel_type && (
                <div>
                  <p className="text-gray-500 text-xs">Combustível</p>
                  <p className="font-semibold capitalize">{vehicle.fuel_type}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-xs text-gray-500">Total Bruto</p>
            </div>
            <p className="text-xl font-bold">{fmt(totalGross)}</p>
            <p className="text-xs text-gray-400">{paidPayments.length} semanas pagas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-indigo-500" />
              <p className="text-xs text-gray-500">Total Líquido</p>
            </div>
            <p className="text-xl font-bold text-indigo-700">{fmt(totalNet)}</p>
            <p className="text-xs text-gray-400">Após deduções</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-yellow-500" />
              <p className="text-xs text-gray-500">UPI Ganhos</p>
            </div>
            <p className="text-xl font-bold text-yellow-600">{totalUpi.toFixed(2)}</p>
            <p className="text-xs text-gray-400">Saldo: {(driver.upi_balance || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-gray-500">Caução</p>
            </div>
            <p className="text-xl font-bold">€{driver.vehicle_deposit || 0}</p>
            <p className="text-xs text-gray-400">{driver.vehicle_deposit_paid ? '✓ Paga' : `${driver.vehicle_deposit || 0}/500`}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending payments */}
      {pendingPayments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Pagamentos pendentes ({pendingPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendingPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{p.period_label}</p>
                  <p className="text-xs text-gray-400">Bruto: {fmt(p.total_gross)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm text-indigo-700">{fmt(p.net_amount)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Histórico de pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paidPayments.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">Sem pagamentos pagos.</p>
          ) : (
            paidPayments.map(p => (
              <div key={p.id} className="px-4 py-3 border-b last:border-0">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">{p.period_label}</p>
                  <p className="font-bold text-green-600">{fmt(p.net_amount)}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  <span className="text-xs text-gray-500">Bruto: {fmt(p.total_gross)}</span>
                  <span className="text-xs text-red-400">Deduções: {fmt(p.total_deductions)}</span>
                  {p.upi_earned > 0 && <span className="text-xs text-yellow-600">UPI: {p.upi_earned}</span>}
                  {p.irs_retention > 0 && <span className="text-xs text-purple-500">Caução: {fmt(p.irs_retention)}</span>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" /> Documentos ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">Nenhum documento submetido ainda.</p>
          ) : (
            documents.map(d => {
              const days = d.expiry_date ? differenceInDays(new Date(d.expiry_date), new Date()) : null;
              const isExpired = d.expiry_date && isPast(new Date(d.expiry_date));
              return (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{DOC_TYPE_LABELS[d.doc_type] || d.doc_type}</p>
                    {d.expiry_date && (
                      <p className={`text-xs ${isExpired ? 'text-red-600 font-semibold' : days <= 30 ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>
                        {isExpired ? '❌ Expirado' : days <= 30 ? `⚠ Expira em ${days} dias (${format(new Date(d.expiry_date), 'dd/MM')})` : `Válido até ${format(new Date(d.expiry_date), 'dd/MM/yyyy')}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    {d.file_url && (
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline font-medium">Ver</a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Notificações Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.slice(0, 5).map(notif => (
              <div key={notif.id} className="px-4 py-3 border-b last:border-0 text-sm">
                <p className="font-medium text-gray-900">{notif.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{notif.message}</p>
                {notif.created_date && (
                  <p className="text-xs text-gray-400 mt-1">{format(new Date(notif.created_date), 'dd/MM/yyyy HH:mm')}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}