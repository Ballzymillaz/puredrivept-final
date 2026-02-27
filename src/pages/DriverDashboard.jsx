import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, Clock, FileText, Car, DollarSign, TrendingUp } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function DriverDashboard({ currentUser }) {
  const isDriver = currentUser?.role?.includes('driver');

  // Fetch driver record
  const { data: driver } = useQuery({
    queryKey: ['driver-profile'],
    queryFn: async () => {
      const drivers = await base44.entities.Driver.list();
      return drivers.find(d => d.email === currentUser?.email);
    },
    enabled: !!currentUser?.email,
  });

  // Fetch assigned vehicle
  const { data: vehicle } = useQuery({
    queryKey: ['assigned-vehicle', driver?.assigned_vehicle_id],
    queryFn: async () => {
      if (!driver?.assigned_vehicle_id) return null;
      const vehicles = await base44.entities.Vehicle.list();
      return vehicles.find(v => v.id === driver.assigned_vehicle_id);
    },
    enabled: !!driver?.assigned_vehicle_id,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['my-documents'],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return await base44.entities.Document.filter({ driver_email: currentUser.email }) || [];
    },
    enabled: !!currentUser?.email,
  });

  // Fetch onboarding status
  const { data: onboarding } = useQuery({
    queryKey: ['my-onboarding'],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const obs = await base44.entities.DriverOnboarding.filter({ driver_email: currentUser.email });
      return obs?.[0] || null;
    },
    enabled: !!currentUser?.email,
  });

  // Fetch weekly payments
  const { data: latestPayment } = useQuery({
    queryKey: ['latest-payment'],
    queryFn: async () => {
      if (!driver?.id) return null;
      const payments = await base44.entities.WeeklyPayment.filter({ driver_id: driver.id }) || [];
      return payments.sort((a, b) => new Date(b.week_end) - new Date(a.week_end))[0];
    },
    enabled: !!driver?.id,
  });

  if (!isDriver) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso apenas para motoristas</p>
      </div>
    );
  }

  // Count expiring documents (30 days or less)
  const expiringDocs = documents.filter(doc => {
    if (!doc.expiry_date) return false;
    const daysUntilExpiry = differenceInDays(new Date(doc.expiry_date), new Date());
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });

  // Count expired documents
  const expiredDocs = documents.filter(doc => {
    if (!doc.expiry_date) return false;
    return differenceInDays(new Date(doc.expiry_date), new Date()) <= 0;
  });

  const approvedDocs = documents.filter(d => d.status === 'approved').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bem-vindo, ${currentUser?.full_name?.split(' ')[0]}`}
        subtitle="Acompanhe seu progresso e documentos"
      />

      {/* Alerts Section */}
      <div className="space-y-3">
        {onboarding && onboarding.status === 'blocked' && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Seu onboarding está bloqueado. Por favor, contacte o suporte.
            </AlertDescription>
          </Alert>
        )}
        
        {expiredDocs.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Você tem {expiredDocs.length} documento(s) expirado(s). Atualize-os urgentemente.
            </AlertDescription>
          </Alert>
        )}

        {expiringDocs.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Você tem {expiringDocs.length} documento(s) vencendo em breve (próximos 30 dias).
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{approvedDocs}/{documents.length}</div>
            <p className="text-xs text-gray-500 mt-1">Aprovados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {onboarding?.current_step ? onboarding.current_step.replace('_', ' ') : '—'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Etapa atual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <Car className="w-4 h-4" />
              Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {vehicle?.license_plate || '—'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Matrícula</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              €{latestPayment?.net_amount?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Última semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Status */}
      {onboarding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status do Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {['documents', 'background_check', 'vehicle_assignment', 'completed'].map((step, idx) => {
                const steps = ['documents', 'background_check', 'vehicle_assignment', 'completed'];
                const currentIdx = steps.indexOf(onboarding.current_step);
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;

                const stepLabels = {
                  documents: 'Documentos',
                  background_check: 'Antecedentes',
                  vehicle_assignment: 'Veículo',
                  completed: 'Concluído',
                };

                return (
                  <div key={step} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                      isCompleted ? 'bg-emerald-600 text-white' :
                      isCurrent ? 'bg-indigo-600 text-white' :
                      'bg-gray-300 text-gray-600'
                    }`}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <div>
                      <p className={`font-medium text-sm ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                        {stepLabels[step]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seus Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">Nenhum documento enviado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => {
                const daysUntilExpiry = doc.expiry_date 
                  ? differenceInDays(new Date(doc.expiry_date), new Date())
                  : null;

                const docTypeLabels = {
                  driving_license: 'Carta de Condução',
                  id_card: 'CC/Passaporte',
                  tvde_certificate: 'Certificado TVDE',
                  iban_proof: 'Comprovativo IBAN',
                  insurance: 'Seguro',
                  inspection: 'Inspeção',
                };

                return (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-gray-900">{docTypeLabels[doc.doc_type]}</p>
                        {doc.expiry_date && (
                          <p className={`text-xs ${
                            daysUntilExpiry !== null && daysUntilExpiry <= 0 ? 'text-red-600' :
                            daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'text-yellow-600' :
                            'text-gray-500'
                          }`}>
                            {daysUntilExpiry !== null && daysUntilExpiry <= 0 
                              ? 'Expirado'
                              : daysUntilExpiry !== null && daysUntilExpiry <= 30
                              ? `Expira em ${daysUntilExpiry} dias`
                              : `Válido até ${format(new Date(doc.expiry_date), 'dd/MM/yyyy')}`
                            }
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${
                        doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {doc.status === 'approved' ? '✓ Aprovado' :
                         doc.status === 'rejected' ? '✗ Rejeitado' :
                         '⏳ Pendente'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}