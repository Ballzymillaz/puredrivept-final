import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wallet, TrendingUp, TrendingDown, Zap, Car, Wrench,
  Trophy, AlertTriangle, FileText, CreditCard, Shield
} from 'lucide-react';
import { differenceInDays, format, addYears, startOfMonth, endOfMonth } from 'date-fns';
import StatusBadge from '../components/shared/StatusBadge';

const fmt = (v) => `€${(v || 0).toFixed(2)}`;

const DOC_TYPE_LABELS = {
  driving_license: 'Carta de condução', tvde_certificate: 'Certificado TVDE',
  id_card: 'Cartão de cidadão', iban_proof: 'Comprovativo IBAN',
  insurance: 'Seguro', periodic_inspection: 'Inspeção periódica', vehicle_booklet: 'Livro do veículo',
};

export default function DriverDashboard({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';
  const [simulatedDriverId, setSimulatedDriverId] = useState('');

  // All drivers (admin simulation or find own record)
  const { data: allDrivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.list() });

  const driver = useMemo(() => {
    if (isAdmin && simulatedDriverId) return allDrivers.find(d => d.id === simulatedDriverId) || null;
    if (!isAdmin) return allDrivers.find(d => d.email === currentUser?.email) || null;
    return null;
  }, [allDrivers, isAdmin, simulatedDriverId, currentUser]);

  const { data: payments = [] } = useQuery({
    queryKey: ['my-payments', driver?.id],
    queryFn: () => base44.entities.WeeklyPayment.filter({ driver_id: driver.id }, '-week_start', 50),
    enabled: !!driver?.id,
  });
  const { data: documents = [] } = useQuery({
    queryKey: ['my-docs', driver?.id],
    queryFn: () => base44.entities.Document.filter({ owner_id: driver.id }, '-created_date'),
    enabled: !!driver?.id,
  });
  const { data: maintenances = [] } = useQuery({
    queryKey: ['maint', driver?.assigned_vehicle_id],
    queryFn: () => base44.entities.MaintenanceRecord.filter({ vehicle_id: driver.assigned_vehicle_id }, '-service_date', 5),
    enabled: !!driver?.assigned_vehicle_id,
  });
  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', driver?.assigned_vehicle_id],
    queryFn: () => base44.entities.Vehicle.filter({ id: driver.assigned_vehicle_id }).then(r => r[0]),
    enabled: !!driver?.assigned_vehicle_id,
  });
  const { data: rankings = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list(),
    enabled: !!driver?.id,
  });
  const { data: upiTx = [] } = useQuery({
    queryKey: ['upi-tx', driver?.id],
    queryFn: () => base44.entities.UPITransaction.filter({ driver_id: driver.id }, '-created_date'),
    enabled: !!driver?.id,
  });

  // Stats
  const paidPayments = useMemo(() => payments.filter(p => p.status === 'paid'), [payments]);
  const pendingPayments = useMemo(() => payments.filter(p => ['draft', 'approved', 'processing'].includes(p.status)), [payments]);

  // Current week (most recent draft/processing payment or latest paid)
  const currentWeekPayment = useMemo(() => pendingPayments[0] || paidPayments[0], [pendingPayments, paidPayments]);

  // UPI vesting
  const totalUPI = driver?.upi_balance || 0;
  const startDate = driver?.start_date ? new Date(driver.start_date) : null;
  const today = new Date();
  const yearsActive = startDate ? Math.floor(differenceInDays(today, startDate) / 365) : 0;
  const vestedPct = Math.min(yearsActive * 25, 100);
  const vestedUPI = totalUPI * vestedPct / 100;
  const unvestedUPI = totalUPI - vestedUPI;
  const nextVestDate = startDate ? addYears(startDate, yearsActive + 1) : null;

  // Documents alerts
  const expiringDocs = useMemo(() => documents.filter(d => {
    if (!d.expiry_date) return false;
    const days = differenceInDays(new Date(d.expiry_date), today);
    return days <= 30;
  }), [documents, today]);

  const nextMaintenance = useMemo(() => {
    return maintenances.find(m => m.next_service_date && new Date(m.next_service_date) >= today);
  }, [maintenances, today]);

  // Ranking (active goals with bonus)
  const driverGoals = useMemo(() => rankings.filter(g =>
    g.status === 'active' && (g.is_global || g.driver_id === driver?.id)
  ), [rankings, driver]);

  if (!driver && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <Shield className="w-10 h-10 text-orange-400 mx-auto" />
          <p className="text-gray-600 font-medium">Perfil não encontrado</p>
          <p className="text-gray-400 text-sm">O seu email não está associado a nenhum motorista.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Admin simulation selector */}
      {isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">Modo Admin — simular dashboard motorista:</p>
          <Select value={simulatedDriverId || 'none'} onValueChange={v => setSimulatedDriverId(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-64 h-7 text-xs bg-white"><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Selecionar motorista —</SelectItem>
              {allDrivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {!driver ? (
        <div className="text-center py-16 text-gray-400">Selecione um motorista para visualizar o dashboard.</div>
      ) : (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl p-5 text-white">
            <h1 className="text-xl font-bold">{driver.full_name}</h1>
            <p className="text-indigo-200 text-sm mt-0.5">{driver.email} · {driver.assigned_vehicle_plate || 'Sem veículo'}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className="bg-white/20 text-white border-0 text-xs">{driver.status}</Badge>
              {driver.contract_type && <Badge className="bg-white/20 text-white border-0 text-xs">{driver.contract_type.replace(/_/g, ' ')}</Badge>}
            </div>
          </div>

          {/* ===== ALERTS ===== */}
          {(expiringDocs.length > 0 || nextMaintenance || pendingPayments.length > 0) && (
            <div className="space-y-2">
              {expiringDocs.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Documentos a expirar</p>
                    <p className="text-xs text-amber-600 mt-0.5">{expiringDocs.map(d => DOC_TYPE_LABELS[d.document_type] || d.document_type).join(', ')}</p>
                  </div>
                </div>
              )}
              {nextMaintenance && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-3">
                  <Wrench className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">Manutenção prevista</p>
                    <p className="text-xs text-orange-600 mt-0.5">{format(new Date(nextMaintenance.next_service_date), 'dd/MM/yyyy')} — {nextMaintenance.description || nextMaintenance.type}</p>
                  </div>
                </div>
              )}
              {pendingPayments.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
                  <CreditCard className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">{pendingPayments.length} pagamento(s) em processamento</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== SECÇÃO 1: Resumo semana ===== */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-indigo-500" />Resumo da semana</CardTitle></CardHeader>
            <CardContent>
              {currentWeekPayment ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Receita bruta</p>
                    <p className="text-xl font-bold text-green-600">{fmt(currentWeekPayment.total_gross)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Deduções</p>
                    <p className="text-xl font-bold text-red-500">{fmt(currentWeekPayment.total_deductions)}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Pagamento estimado</p>
                    <p className="text-xl font-bold text-indigo-700">{fmt(currentWeekPayment.net_amount)}</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">UPI gerados</p>
                    <p className="text-xl font-bold text-violet-600">{(currentWeekPayment.upi_earned || 0).toFixed(2)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum dado disponível para esta semana</p>
              )}
              {currentWeekPayment && (
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  <span>{currentWeekPayment.period_label}</span>
                  <StatusBadge status={currentWeekPayment.status} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== SECÇÃO 2: Veículo ===== */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Car className="w-4 h-4 text-indigo-500" />Veículo atribuído</CardTitle></CardHeader>
            <CardContent>
              {vehicle ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Veículo</p>
                    <p className="font-semibold">{vehicle.brand} {vehicle.model}</p>
                    <p className="text-xs text-gray-400">{vehicle.license_plate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Pagamento semanal</p>
                    <p className="font-semibold text-indigo-700">{fmt(vehicle.weekly_rental_price || driver.slot_fee)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Próxima manutenção</p>
                    {nextMaintenance ? (
                      <p className="font-semibold text-orange-600">{format(new Date(nextMaintenance.next_service_date), 'dd/MM/yyyy')}</p>
                    ) : (
                      <p className="font-semibold text-gray-400">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Km atual</p>
                    <p className="font-semibold">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Seguro até</p>
                    <p className="font-semibold">{vehicle.insurance_expiry ? format(new Date(vehicle.insurance_expiry), 'dd/MM/yyyy') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <StatusBadge status={vehicle.status} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum veículo atribuído</p>
              )}
            </CardContent>
          </Card>

          {/* ===== SECÇÃO 3: UPI ===== */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-violet-500" />UPI — Saldo e Vesting</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-violet-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total UPI</p>
                  <p className="text-xl font-bold text-violet-700">{totalUPI.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">UPI Vestidos</p>
                  <p className="text-xl font-bold text-green-600">{vestedUPI.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">{vestedPct}%</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">UPI Não vestidos</p>
                  <p className="text-xl font-bold text-amber-600">{unvestedUPI.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Próxima libr. (25%)</p>
                  {nextVestDate ? (
                    <>
                      <p className="text-sm font-bold text-blue-700">{format(nextVestDate, 'dd/MM/yyyy')}</p>
                      <p className="text-[10px] text-gray-400">+{(totalUPI * 0.25).toFixed(2)} UPI</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>
              </div>
              {!startDate && (
                <p className="text-xs text-gray-400 mt-2 text-center">Data de início não definida — vesting não calculável</p>
              )}
            </CardContent>
          </Card>

          {/* ===== SECÇÃO 4: Ranking / Goals ===== */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" />Ranking & Objetivos</CardTitle></CardHeader>
            <CardContent>
              {driverGoals.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum objetivo ativo no momento</p>
              ) : (
                <div className="space-y-3">
                  {driverGoals.map(g => {
                    const progress = g.target_value > 0 ? Math.min((g.current_value || 0) / g.target_value * 100, 100) : 0;
                    return (
                      <div key={g.id} className="p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">{g.title}</p>
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Bónus {fmt(g.bonus_amount)}</Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-indigo-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-gray-400">{g.current_value || 0} / {g.target_value}</span>
                          <span className="text-xs text-indigo-600 font-medium">{progress.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== Historico recente ===== */}
          {paidPayments.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Histórico recente</CardTitle></CardHeader>
              <CardContent className="p-0">
                {paidPayments.slice(0, 8).map(p => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{p.period_label}</p>
                      <p className="text-xs text-gray-400">Bruto: {fmt(p.total_gross)} · Deduções: {fmt(p.total_deductions)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{fmt(p.net_amount)}</p>
                      {p.upi_earned > 0 && <p className="text-xs text-violet-500">{p.upi_earned.toFixed(2)} UPI</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}