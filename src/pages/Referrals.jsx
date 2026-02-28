import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import StatCard from '../components/dashboard/StatCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { HandCoins, Users, Gift, Clock, TrendingUp, Calendar } from 'lucide-react';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';

const REFERRAL_RATES = {
  slot_standard: 5,
  slot_premium: 5,
  slot_black: 10,
  location: 15,
};

const CONTRACT_LABELS = {
  slot_standard: 'Slot Standard',
  slot_premium: 'Slot Premium',
  slot_black: 'Slot Black',
  location: 'Location',
};

export default function Referrals({ currentUser }) {
  const [editing, setEditing] = useState(null);
  const [detailsDialog, setDetailsDialog] = useState(null);
  const qc = useQueryClient();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.hasRole?.('admin');
  const isFleetManager = currentUser?.role === 'fleet_manager' || currentUser?.hasRole?.('fleet_manager');

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['referral-payments'],
    queryFn: () => base44.entities.ReferralPayment.list('-created_date', 200),
  });
  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });
  const { data: vehiclePurchases = [] } = useQuery({
    queryKey: ['vehicle-purchases'],
    queryFn: () => base44.entities.VehiclePurchase.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ReferralPayment.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['referral-payments'] }); setEditing(null); },
  });

  // Determine which fleet manager the current user is
  const myFleetManager = useMemo(() => {
    if (!isFleetManager || isAdmin) return null;
    return fleetManagers.find(fm => fm.email === currentUser?.email || fm.user_id === currentUser?.id);
  }, [fleetManagers, currentUser, isFleetManager, isAdmin]);

  // Filter drivers based on role
  const visibleDrivers = useMemo(() => {
    if (isAdmin) return allDrivers.filter(d => d.status === 'active' && d.fleet_manager_id);
    if (isFleetManager && myFleetManager) return allDrivers.filter(d => d.fleet_manager_id === myFleetManager.id && d.status === 'active');
    return [];
  }, [allDrivers, isAdmin, isFleetManager, myFleetManager]);

  // Filter payments by role
  const visiblePayments = useMemo(() => {
    if (isAdmin) return payments;
    if (isFleetManager && myFleetManager) return payments.filter(p => p.referrer_id === myFleetManager.id);
    return [];
  }, [payments, isAdmin, isFleetManager, myFleetManager]);

  // Compute active referrals with weekly commission
  const activeReferrals = useMemo(() => visibleDrivers.map(d => ({
    driver_name: d.full_name,
    driver_id: d.id,
    referrer_id: d.fleet_manager_id,
    referrer_name: d.fleet_manager_name,
    contract_type: d.contract_type,
    weekly_commission: REFERRAL_RATES[d.contract_type] || 0,
    start_date: d.start_date,
  })), [visibleDrivers]);

  // Bonus tracking per driver
  const bonusTrackers = useMemo(() => {
    return visibleDrivers.map(d => {
      const startDate = d.start_date ? parseISO(d.start_date) : null;
      const today = new Date();
      const daysSinceStart = startDate ? differenceInDays(today, startDate) : 0;

      const locationBonusTriggered = d.contract_type === 'location' && daysSinceStart >= 30;
      const locationDaysRemaining = Math.max(0, 30 - daysSinceStart);
      const locationEstDate = startDate ? addDays(startDate, 30) : null;

      const purchase = vehiclePurchases.find(vp => vp.driver_id === d.id && vp.status === 'active');
      const purchaseDaysSince = purchase?.start_date ? differenceInDays(today, parseISO(purchase.start_date)) : 0;
      const purchaseBonusTriggered = !!purchase && purchaseDaysSince >= 60;
      const purchaseDaysRemaining = Math.max(0, 60 - purchaseDaysSince);
      const purchaseEstDate = purchase?.start_date ? addDays(parseISO(purchase.start_date), 60) : null;

      return {
        driver_id: d.id,
        driver_name: d.full_name,
        contract_type: d.contract_type,
        daysSinceStart,
        locationBonusTriggered,
        locationDaysRemaining,
        locationEstDate,
        hasPurchase: !!purchase,
        purchaseBonusTriggered,
        purchaseDaysRemaining,
        purchaseEstDate,
      };
    });
  }, [visibleDrivers, vehiclePurchases]);

  const totalPaid = visiblePayments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.weekly_amount || 0) + (p.bonus_amount || 0), 0);
  const totalPending = visiblePayments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.weekly_amount || 0), 0);
  const weeklyProjection = activeReferrals.reduce((s, r) => s + r.weekly_commission, 0);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const columns = [
    { header: 'Motorista', render: (r) => <div><p className="font-medium text-sm">{r.driver_name}</p><p className="text-xs text-gray-500">{CONTRACT_LABELS[r.contract_type] || '—'}</p></div> },
    { header: 'Gestor', render: (r) => isAdmin ? <span className="text-sm">{r.referrer_name}</span> : null },
    { header: 'Comissão semanal', render: (r) => <span className="font-medium text-indigo-600">{fmt(r.weekly_commission)}</span> },
    { header: 'Bónus próximo', render: (r) => {
      const tracker = bonusTrackers.find(t => t.driver_id === r.driver_id);
      if (!tracker) return '—';
      if (tracker.contract_type === 'location') {
        if (tracker.locationBonusTriggered) return <span className="text-emerald-600 text-xs font-medium">✓ 60€ desbloqueado</span>;
        return <span className="text-amber-600 text-xs">{tracker.locationDaysRemaining}d para 60€</span>;
      }
      if (tracker.hasPurchase) {
        if (tracker.purchaseBonusTriggered) return <span className="text-purple-600 text-xs font-medium">✓ 250€ desbloqueado</span>;
        return <span className="text-purple-600 text-xs">{tracker.purchaseDaysRemaining}d para 250€</span>;
      }
      return '—';
    }},
  ].filter(c => c.render !== null || c.header !== 'Gestor');

  const filteredColumns = isAdmin ? columns : columns.filter(c => c.header !== 'Gestor');

  return (
    <div className="space-y-4">
      <PageHeader title="Indicações & Comissões" subtitle={isAdmin ? "Comissões de todos os gestores de frota" : "As suas comissões e motoristas"} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setDetailsDialog('paid')}>
          <StatCard title="Total pago" value={fmt(totalPaid)} icon={HandCoins} color="green" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('pending')}>
          <StatCard title="Pendente" value={fmt(totalPending)} icon={HandCoins} color="amber" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('active')}>
          <StatCard title="Indicações ativas" value={activeReferrals.length} icon={Users} color="indigo" />
        </div>
      </div>

      {/* Commission rates table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Tabela de comissões</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(REFERRAL_RATES).map(([type, rate]) => (
              <div key={type} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{CONTRACT_LABELS[type]}</p>
                <p className="text-xl font-bold text-indigo-600">€{rate}</p>
                <p className="text-[10px] text-gray-400">por semana</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex-1 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800"><strong>Bónus aluguer:</strong> 60€ após 30 dias contínuos</p>
            </div>
            <div className="flex-1 p-3 bg-purple-50 rounded-lg flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-600 shrink-0" />
              <p className="text-sm text-purple-800"><strong>Bónus opção compra:</strong> 250€ após 60 dias contínuos</p>
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span className="text-sm text-indigo-800 font-medium">Projeção semanal</span>
            </div>
            <span className="text-lg font-bold text-indigo-700">{fmt(weeklyProjection)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Next bonus tracker */}
      {bonusTrackers.filter(t => !t.locationBonusTriggered || !t.purchaseBonusTriggered).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Clock className="w-4 h-4" /> Próximos bónus</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {bonusTrackers.map(t => {
                const items = [];
                if (t.contract_type === 'location' && !t.locationBonusTriggered) {
                  const pct = Math.min(100, (t.daysSinceStart / 30) * 100);
                  items.push(
                    <div key={`loc-${t.driver_id}`} className="bg-emerald-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="text-sm font-medium text-emerald-900">{t.driver_name} — Bónus Location 60€</p>
                          <p className="text-xs text-emerald-700">{t.daysSinceStart} dias / 30 dias — {t.locationDaysRemaining}d restantes</p>
                        </div>
                        {t.locationEstDate && <span className="text-xs text-emerald-600 flex items-center gap-1"><Calendar className="w-3 h-3" />{format(t.locationEstDate, 'dd/MM')}</span>}
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                }
                if (t.hasPurchase && !t.purchaseBonusTriggered) {
                  const pct = Math.min(100, ((60 - t.purchaseDaysRemaining) / 60) * 100);
                  items.push(
                    <div key={`pur-${t.driver_id}`} className="bg-purple-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="text-sm font-medium text-purple-900">{t.driver_name} — Bónus Opção Compra 250€</p>
                          <p className="text-xs text-purple-700">{60 - t.purchaseDaysRemaining} dias / 60 dias — {t.purchaseDaysRemaining}d restantes</p>
                        </div>
                        {t.purchaseEstDate && <span className="text-xs text-purple-600 flex items-center gap-1"><Calendar className="w-3 h-3" />{format(t.purchaseEstDate, 'dd/MM')}</span>}
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                }
                return items;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active referrals table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Motoristas ativos</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <DataTable columns={filteredColumns} data={activeReferrals} isLoading={loadingPayments} emptyMessage="Nenhum motorista afiliado" />
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Histórico de pagamentos</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <DataTable
            columns={[
              { header: 'Semana', render: (r) => <span className="text-sm">{r.week_label || '—'}</span> },
              { header: 'Motorista', render: (r) => <span className="text-sm">{r.driver_name}</span> },
              ...(isAdmin ? [{ header: 'Gestor', render: (r) => <span className="text-sm">{r.referrer_name}</span> }] : []),
              { header: 'Semanal', render: (r) => <span className="font-medium text-indigo-600">{fmt(r.weekly_amount)}</span> },
              { header: 'Bónus', render: (r) => r.bonus_amount > 0 ? <span className="font-medium text-emerald-600">{fmt(r.bonus_amount)}</span> : '—' },
              { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
            ]}
            data={visiblePayments}
            isLoading={loadingPayments}
            onRowClick={isAdmin ? setEditing : undefined}
            emptyMessage="Nenhum pagamento registado"
          />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar pagamento</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: editing.id, data: { weekly_amount: parseFloat(editing.weekly_amount), bonus_amount: parseFloat(editing.bonus_amount), status: editing.status } }); }} className="space-y-4">
              <div className="space-y-1.5"><Label className="text-xs">Valor semanal</Label><Input type="number" step="0.01" value={editing.weekly_amount} onChange={(e) => setEditing(p => ({ ...p, weekly_amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Bónus</Label><Input type="number" step="0.01" value={editing.bonus_amount || 0} onChange={(e) => setEditing(p => ({ ...p, bonus_amount: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === 'paid' && 'Detalhes: Total Pago'}
              {detailsDialog === 'pending' && 'Detalhes: Pendente'}
              {detailsDialog === 'active' && 'Detalhes: Indicações Ativas'}
            </DialogTitle>
          </DialogHeader>
          {detailsDialog === 'paid' && (
            <div className="space-y-2">
              <div className="p-3 bg-green-50 rounded-lg"><p className="text-sm font-semibold">Total: {fmt(totalPaid)}</p></div>
              {visiblePayments.filter(p => p.status === 'paid').map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 border-b">
                  <div><p className="font-medium">{p.referrer_name}</p><p className="text-sm text-gray-500">{p.driver_name} — {p.week_label}</p></div>
                  <p className="font-medium">{fmt((p.weekly_amount || 0) + (p.bonus_amount || 0))}</p>
                </div>
              ))}
            </div>
          )}
          {detailsDialog === 'pending' && (
            <div className="space-y-2">
              <div className="p-3 bg-amber-50 rounded-lg"><p className="text-sm font-semibold">Total: {fmt(totalPending)}</p></div>
              {visiblePayments.filter(p => p.status === 'pending').map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 border-b">
                  <div><p className="font-medium">{p.referrer_name}</p><p className="text-sm text-gray-500">{p.driver_name} — {p.week_label}</p></div>
                  <p className="font-medium text-amber-600">{fmt(p.weekly_amount)}</p>
                </div>
              ))}
            </div>
          )}
          {detailsDialog === 'active' && (
            <div className="space-y-2">
              {activeReferrals.map((r, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
                  <div><p className="font-medium">{r.driver_name}</p><p className="text-sm text-gray-500">{CONTRACT_LABELS[r.contract_type] || '—'}</p></div>
                  <div className="text-right"><p className="font-medium">{r.referrer_name}</p><p className="text-indigo-600 font-medium">{fmt(r.weekly_commission)}/sem</p></div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}