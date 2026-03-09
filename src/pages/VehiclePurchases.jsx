import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingDown, ShieldCheck, Info, AlertTriangle } from 'lucide-react';
import { addMonths, isAfter, parseISO } from 'date-fns';

// ── ALLOWED DURATIONS ──────────────────────────────────────────────────────
const ALLOWED_DURATIONS = [6, 9, 12, 18, 20, 24, 30, 36, 40, 44, 48];

const DURATION_LABELS = {
  6: '6 meses', 9: '9 meses', 12: '12 meses (1 ano)',
  18: '18 meses', 20: '20 meses', 24: '24 meses (2 anos)',
  30: '30 meses', 36: '36 meses (3 anos)', 40: '40 meses',
  44: '44 meses', 48: '48 meses (4 anos)',
};

// ── TVDE EXPIRY from first registration (max 7 years) ─────────────────────
function getTvdeExpiry(firstRegDate) {
  if (!firstRegDate) return null;
  const d = new Date(firstRegDate);
  d.setFullYear(d.getFullYear() + 7);
  return d;
}

// ── DEGRESSIVE QUARTERLY SCHEDULE ─────────────────────────────────────────
// T1 always €300/week, decreases linearly each quarter
// Returns null if math would produce negative payments
function computeQuarterlySchedule(totalPrice, durationMonths) {
  const totalWeeks = Math.round(durationMonths * 4.33);
  const numQuarters = Math.ceil(totalWeeks / 13);
  if (totalWeeks === 0) return null;

  if (numQuarters < 2) {
    const weekly = Math.round((totalPrice / totalWeeks) * 100) / 100;
    if (weekly < 0) return null;
    return [{ quarter: 1, weeks: totalWeeks, weeklyAmount: weekly, total: totalPrice }];
  }

  const M1 = 300;
  const fullQ = 13;
  const lastQWeeks = totalWeeks - (numQuarters - 1) * fullQ;

  // step = (M1*totalWeeks - totalPrice) / denominator
  let denominator = 0;
  for (let q = 1; q <= numQuarters; q++) {
    const qw = q < numQuarters ? fullQ : lastQWeeks;
    denominator += (q - 1) * qw;
  }
  const step = denominator > 0 ? (M1 * totalWeeks - totalPrice) / denominator : 0;

  // step < 0 means T1=300 is not enough to cover totalPrice
  if (step < 0) return null;

  const quarters = [];
  let cumulativeTotal = 0;

  for (let q = 1; q <= numQuarters; q++) {
    const qWeeks = q < numQuarters ? fullQ : lastQWeeks;
    const rawWeekly = M1 - (q - 1) * step;

    // STRICT: no negative payments allowed
    if (rawWeekly < 0) return null;

    const weeklyAmount = q < numQuarters
      ? Math.round(rawWeekly * 100) / 100
      : Math.round((totalPrice - cumulativeTotal) / Math.max(1, qWeeks) * 100) / 100;

    // Last quarter: ensure non-negative
    if (weeklyAmount < 0) return null;

    const qTotal = q < numQuarters
      ? Math.round(rawWeekly * qWeeks * 100) / 100
      : Math.round((totalPrice - cumulativeTotal) * 100) / 100;

    if (qTotal < 0) return null;

    quarters.push({ quarter: q, weeks: qWeeks, weeklyAmount, total: qTotal });
    if (q < numQuarters) cumulativeTotal += qTotal;
  }

  return quarters;
}

// ── VALIDATE DURATION against TVDE & schedule ─────────────────────────────
function validateDuration(months, vehicle, totalPrice) {
  const tvdeExpiry = getTvdeExpiry(vehicle?.first_registration_date);
  const today = new Date();
  const contractEnd = addMonths(today, months);

  if (tvdeExpiry && isAfter(contractEnd, tvdeExpiry)) {
    return { valid: false, reason: 'tvde', message: 'Esta duração ultrapassa o limite de atividade TVDE do veículo.' };
  }
  if (totalPrice > 0) {
    const sched = computeQuarterlySchedule(totalPrice, months);
    if (!sched) {
      return { valid: false, reason: 'negative', message: 'Duração inválida — estrutura de pagamento resultaria em valor negativo.' };
    }
  }
  return { valid: true };
}

export default function VehiclePurchases({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const qc = useQueryClient();

  const isDriver = currentUser?.role === 'driver';
  const isAdmin = currentUser?.role === 'admin' || currentUser?._realRole === 'admin';
  const isFleetManager = currentUser?.role === 'fleet_manager' && !isAdmin;
  const isSimulation = !!currentUser?._isSimulation;

  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const myDriverRecord = isDriver ? allDrivers.find(d => d.email === currentUser?.email) : null;

  const { data: allFleetManagers = [] } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list(),
    enabled: isFleetManager,
  });

  const { data: allFleets = [] } = useQuery({
    queryKey: ['fleets-raw'],
    queryFn: () => base44.entities.Fleet.list(),
    enabled: isFleetManager,
  });

  const myFleetDriverIds = useMemo(() => {
    if (!isFleetManager) return null;
    const myFM = allFleetManagers.find(fm => fm.email === currentUser?.email || fm.user_id === currentUser?.id);
    const myFMId = myFM?.id;
    const myFleets = allFleets.filter(f =>
      f.fleet_manager_id === myFMId ||
      f.fleet_manager_id === currentUser?.id ||
      f.fleet_manager_id === currentUser?.email
    );
    const ids = new Set(myFleets.flatMap(f => f.driver_ids || []));
    allDrivers.forEach(d => {
      if ((myFMId && d.fleet_manager_id === myFMId) || d.fleet_manager_id === currentUser?.id || d.fleet_manager_id === currentUser?.email) {
        ids.add(d.id);
      }
    });
    return ids;
  }, [isFleetManager, allFleetManagers, allFleets, allDrivers, currentUser]);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['vehicle-purchases', isDriver ? myDriverRecord?.id : isFleetManager ? currentUser?.id : 'all'],
    queryFn: async () => {
      const all = await base44.entities.VehiclePurchase.list('-created_date');
      if (isDriver && myDriverRecord) return all.filter(p => p.driver_id === myDriverRecord.id);
      if (isFleetManager) return all.filter(p => myFleetDriverIds?.has(p.driver_id));
      return all;
    },
    enabled: !isDriver || !!myDriverRecord,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (d) => {
      // Backend-side validation via function
      const res = await base44.functions.invoke('validateVehiclePurchase', d);
      if (res.data?.error) throw new Error(res.data.error);
      return base44.entities.VehiclePurchase.create(d);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-purchases'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldPurchase }) => {
      if (data.prepayment_amount && data.prepayment_amount !== oldPurchase.prepayment_amount) {
        const prepaymentDiff = data.prepayment_amount - (oldPurchase.prepayment_amount || 0);
        if (prepaymentDiff > 0) {
          await base44.entities.Expense.create({
            category: 'vehicle_costs',
            description: `Pago - Pagamento antecipado: ${oldPurchase.driver_name} - ${oldPurchase.vehicle_info}`,
            amount: -prepaymentDiff,
            date: new Date().toISOString().split('T')[0],
            driver_id: oldPurchase.driver_id,
            notes: `VehiclePurchase ID: ${id}`,
          });
          const newRemaining = oldPurchase.total_price - data.prepayment_amount - (oldPurchase.paid_amount || 0);
          data.remaining_balance = Math.max(0, newRemaining);
        }
      }
      return base44.entities.VehiclePurchase.update(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle-purchases'] });
      qc.invalidateQueries({ queryKey: ['expenses-all'] });
      setSelected(null); setEditForm(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VehiclePurchase.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-purchases'] }); setSelected(null); setEditForm(null); },
  });

  const [form, setForm] = useState({ driver_id: '', vehicle_id: '', duration_months: '' });
  const selectedVehicle = vehicles.find(v => v.id === form.vehicle_id);
  const totalPrice = selectedVehicle?.market_price ? Math.round(selectedVehicle.market_price * 1.25 * 100) / 100 : 0;
  const months = parseInt(form.duration_months) || 0;

  const schedule = useMemo(() => {
    if (!totalPrice || !months) return null;
    return computeQuarterlySchedule(totalPrice, months);
  }, [totalPrice, months]);

  const tvdeExpiry = getTvdeExpiry(selectedVehicle?.first_registration_date);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!schedule) return;
    const validation = validateDuration(months, selectedVehicle, totalPrice);
    if (!validation.valid) { alert(validation.message); return; }

    const driver = allDrivers.find(d => d.id === form.driver_id);
    createMutation.mutate({
      driver_name: driver?.full_name || '',
      driver_id: form.driver_id,
      vehicle_id: form.vehicle_id,
      vehicle_info: selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model} - ${selectedVehicle.license_plate}` : '',
      base_price: selectedVehicle?.market_price || 0,
      total_price: totalPrice,
      duration_months: months,
      weekly_installment: schedule[0]?.weeklyAmount || 0,
      remaining_balance: totalPrice,
      status: 'requested',
      // Pass for backend validation
      _vehicle_first_reg_date: selectedVehicle?.first_registration_date || null,
    });
  };

  const columns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Veículo', render: (r) => <span className="text-sm">{r.vehicle_info}</span> },
    ...(!isDriver ? [{ header: 'Preço total', render: (r) => fmt(r.total_price) }] : []),
    { header: 'Pagamento inicial', render: (r) => <span className="font-medium text-blue-600">{fmt(r.weekly_installment)}/sem</span> },
    { header: 'Restante', render: (r) => <span className="text-red-600 font-medium">{fmt(r.remaining_balance)}</span> },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  const selectedSchedule = useMemo(() => {
    if (!selected) return null;
    return computeQuarterlySchedule(selected.total_price, selected.duration_months);
  }, [selected]);

  return (
    <div className="space-y-4">
      <PageHeader title="Compra de veículos" subtitle="Opção de compra — Financiamento interno" actionLabel={!isSimulation && !isFleetManager ? (isDriver ? "Fazer pedido" : "Novo pedido") : undefined} onAction={!isSimulation && !isFleetManager ? () => setShowForm(true) : undefined} />

      {isDriver && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Financiamento interno — sem aprovação bancária</p>
            <p className="text-xs text-blue-700 mt-1">O pagamento é deduzido do seu salário semanal com uma tabela degressiva por trimestre. O valor diminui progressivamente ao longo do contrato.</p>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={purchases} isLoading={isLoading} onRowClick={(r) => { setSelected(r); setEditForm(null); }} />

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditForm(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Compra — {selected?.driver_name}</DialogTitle></DialogHeader>
          {selected && !editForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Veículo</span><p className="font-medium">{selected.vehicle_info}</p></div>
                {!isDriver && <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Preço total</span><p className="font-medium">{fmt(selected.total_price)}</p></div>}
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Duração</span><p className="font-medium">{selected.duration_months} meses</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Restante</span><p className="font-medium text-red-600">{fmt(selected.remaining_balance)}</p></div>
              </div>

              {selectedSchedule && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-blue-500" /> Tabela degressiva por trimestre
                  </p>
                  <div className="space-y-1.5">
                    {selectedSchedule.map((q, i) => (
                      <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg ${i === 0 ? 'bg-blue-50 border border-blue-100' : i === selectedSchedule.length - 1 ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50'}`}>
                        <div>
                          <p className="text-xs font-medium text-gray-700">T{q.quarter} <span className="text-gray-400">({q.weeks} semanas)</span></p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${i === 0 ? 'text-blue-700' : i === selectedSchedule.length - 1 ? 'text-emerald-700' : 'text-gray-700'}`}>
                            {fmt(q.weeklyAmount)}<span className="font-normal text-xs text-gray-500">/sem</span>
                          </p>
                          <p className="text-[10px] text-gray-400">Total trimestre: {fmt(q.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">Total contrato: {fmt(selected.total_price)}</p>
                </div>
              )}

              {isAdmin && !isSimulation && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditForm({ ...selected })}>Editar</Button>
                  <Button variant="outline" className="flex-1 text-red-600" onClick={() => { if (confirm('Eliminar?')) deleteMutation.mutate(selected.id); }}>Eliminar</Button>
                  {selected.status === 'requested' && (
                    <>
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'active', start_date: new Date().toISOString().split('T')[0] }, oldPurchase: selected })}>Aprovar</Button>
                      <Button variant="outline" className="flex-1 text-red-600" onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'rejected' }, oldPurchase: selected })}>Rejeitar</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {selected && editForm && (
            <PurchaseEditForm purchase={editForm} onSave={(data) => { updateMutation.mutate({ id: selected.id, data, oldPurchase: selected }); setEditForm(null); }} onCancel={() => setEditForm(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo pedido de compra</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isDriver && (
              <div className="space-y-1.5">
                <Label className="text-xs">Motorista</Label>
                <Select value={form.driver_id} onValueChange={(v) => setForm(f => ({ ...f, driver_id: v }))} required>
                  <SelectTrigger><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
                  <SelectContent>{allDrivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Veículo</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm(f => ({ ...f, vehicle_id: v, duration_months: '' }))}>
                <SelectTrigger><SelectValue placeholder="Escolher veículo..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => {
                    const tvde = getTvdeExpiry(v.first_registration_date);
                    const expired = tvde && isAfter(new Date(), tvde);
                    return (
                      <SelectItem key={v.id} value={v.id} disabled={expired}>
                        {v.brand} {v.model} - {v.license_plate}{expired ? ' ⛔ TVDE expirado' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {tvdeExpiry && (
                <p className="text-[11px] text-gray-500">Limite TVDE: <span className="font-medium">{tvdeExpiry.toLocaleDateString('pt-PT')}</span></p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Duração do contrato</Label>
              <Select value={form.duration_months?.toString()} onValueChange={(v) => setForm(f => ({ ...f, duration_months: v }))} disabled={!form.vehicle_id}>
                <SelectTrigger><SelectValue placeholder="Escolher duração..." /></SelectTrigger>
                <SelectContent>
                  {ALLOWED_DURATIONS.map(m => {
                    const v = validateDuration(m, selectedVehicle, totalPrice);
                    return (
                      <SelectItem key={m} value={m.toString()} disabled={!v.valid}>
                        {DURATION_LABELS[m]}{!v.valid ? (v.reason === 'tvde' ? ' — excede TVDE' : ' — pagamento inválido') : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Validation errors */}
            {form.duration_months && selectedVehicle && (() => {
              const v = validateDuration(months, selectedVehicle, totalPrice);
              if (!v.valid) return (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{v.message}</p>
                </div>
              );
              return null;
            })()}

            {schedule && (
              <div className="space-y-2">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg space-y-1 text-sm">
                  <p className="font-semibold text-blue-900">Financiamento interno — sem aprovação bancária</p>
                  <p className="text-xs text-blue-700">Preço total: <strong>{fmt(totalPrice)}</strong></p>
                </div>
                <p className="text-xs font-semibold text-gray-700 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-blue-500" /> Tabela degressiva por trimestre</p>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {schedule.map((q, i) => (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-xs ${i === 0 ? 'bg-blue-50' : i === schedule.length - 1 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      <span className="text-gray-600">T{q.quarter} ({q.weeks} sem)</span>
                      <span className={`font-bold ${i === 0 ? 'text-blue-700' : i === schedule.length - 1 ? 'text-emerald-700' : 'text-gray-700'}`}>{fmt(q.weeklyAmount)}/sem</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 text-center">T1 sempre €300/sem · Total exato: {fmt(totalPrice)}</p>
              </div>
            )}

            {createMutation.isError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{createMutation.error?.message}</p>
              </div>
            )}

            <Button type="submit" disabled={createMutation.isPending || !schedule || !form.driver_id || !form.vehicle_id} className="w-full bg-blue-600 hover:bg-blue-700">
              {createMutation.isPending ? 'A criar...' : 'Criar pedido'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseEditForm({ purchase, onSave, onCancel }) {
  const [form, setForm] = useState({ ...purchase, prepayment_amount: purchase.prepayment_amount || 0 });
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ remaining_balance: parseFloat(form.remaining_balance) || 0, paid_amount: parseFloat(form.paid_amount) || 0, prepayment_amount: parseFloat(form.prepayment_amount) || 0, status: form.status });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs">Restante</Label><Input type="number" step="0.01" value={form.remaining_balance} onChange={(e) => setForm(f => ({ ...f, remaining_balance: e.target.value }))} /></div>
      <div className="space-y-1.5"><Label className="text-xs">Pago</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm(f => ({ ...f, paid_amount: e.target.value }))} /></div>
      <div className="space-y-1.5"><Label className="text-xs">Pagamento antecipado</Label><Input type="number" step="0.01" value={form.prepayment_amount} onChange={(e) => setForm(f => ({ ...f, prepayment_amount: e.target.value }))} /></div>
      <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
        <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="requested">Solicitado</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">Guardar</Button>
      </div>
    </form>
  );
}