import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, TrendingDown, Zap, Shield, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
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
    queryKey: ['my-docs', driver?.id],
    queryFn: () => base44.entities.Document.filter({ owner_id: driver.id }, '-created_date'),
    enabled: !!driver?.id,
  });

  const paidPayments = payments.filter(p => p.status === 'paid');
  const pendingPayments = payments.filter(p => ['draft', 'approved', 'processing'].includes(p.status));
  const totalGross = paidPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
  const totalNet = paidPayments.reduce((s, p) => s + (p.net_amount || 0), 0);
  const totalUpi = paidPayments.reduce((s, p) => s + (p.upi_earned || 0), 0);

  const expiringDocs = documents.filter(d => {
    if (!d.expiry_date) return false;
    const days = Math.ceil((new Date(d.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
    return days <= 30;
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

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl p-5 text-white">
        <h1 className="text-xl font-bold">{driver.full_name}</h1>
        <p className="text-indigo-200 text-sm mt-0.5">{driver.email} · {driver.assigned_vehicle_plate || 'Sem veículo'}</p>
        <div className="flex gap-3 mt-3">
          <Badge className="bg-white/20 text-white border-0 text-xs">{driver.status}</Badge>
          <Badge className="bg-white/20 text-white border-0 text-xs">{driver.contract_type?.replace('_', ' ')}</Badge>
        </div>
      </div>

      {/* Alert expiring docs */}
      {expiringDocs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">{expiringDocs.length} documento(s) a expirar em breve</p>
            <p className="text-xs text-amber-600 mt-0.5">{expiringDocs.map(d => DOC_TYPE_LABELS[d.document_type] || d.document_type).join(', ')}</p>
          </div>
        </div>
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
            <p className="text-center py-6 text-sm text-gray-400">Sem documentos.</p>
          ) : (
            documents.map(d => {
              const days = d.expiry_date ? Math.ceil((new Date(d.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div key={d.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{DOC_TYPE_LABELS[d.document_type] || d.document_type}</p>
                    {d.expiry_date && (
                      <p className={`text-xs ${days < 0 ? 'text-red-600' : days <= 30 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {days < 0 ? 'Expirado!' : `Expira em ${days} dias (${d.expiry_date})`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    {d.file_url && (
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 underline">Ver</a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}