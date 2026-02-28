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
import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, ShieldCheck, Info } from 'lucide-react';

// Degressive quarterly schedule — T1 always starts at €300/week, then decreases linearly
// Returns null if T1 > 300 would be needed (i.e. 300 is not enough to cover totalPrice)
function computeQuarterlySchedule(totalPrice, durationMonths) {
  const totalWeeks = Math.round(durationMonths * 4.33);
  const numQuarters = Math.ceil(totalWeeks / 13);
  if (totalWeeks === 0) return null;
  if (numQuarters < 2) {
    const weekly = Math.round((totalPrice / totalWeeks) * 100) / 100;
    return [{ quarter: 1, weeks: totalWeeks, weeklyAmount: weekly, total: totalPrice }];
  }

  // T1 is fixed at €300/week
  const M1 = 300;

  // Compute step from T1 down: sum = sum_q=1..T of (M1 - (q-1)*step) * weeksQ = totalPrice
  // Assuming all quarters = 13 weeks except last
  const fullQuarterWeeks = 13;
  const lastQuarterWeeks = totalWeeks - (numQuarters - 1) * fullQuarterWeeks;

  // sum = M1 * totalWeeks - step * (sum_q=1..T of (q-1)*weeksQ)
  // denominator = sum of (q-1)*weeksQ
  let denominator = 0;
  for (let q = 1; q <= numQuarters; q++) {
    const qw = q < numQuarters ? fullQuarterWeeks : lastQuarterWeeks;
    denominator += (q - 1) * qw;
  }
  // M1*totalWeeks - step*denominator = totalPrice
  // step = (M1*totalWeeks - totalPrice) / denominator
  const step = denominator > 0 ? (M1 * totalWeeks - totalPrice) / denominator : 0;

  // If step < 0, T1=300 is not enough → return null so we can filter this duration
  if (step < 0) return null;

  const quarters = [];
  let weeksAssigned = 0;
  let cumulativeTotal = 0;

  for (let q = 1; q <= numQuarters; q++) {
    const qWeeks = q < numQuarters ? fullQuarterWeeks : lastQuarterWeeks;
    const rawWeekly = M1 - (q - 1) * step;
    const weeklyAmount = q < numQuarters
      ? Math.round(rawWeekly * 100) / 100
      : Math.round((totalPrice - cumulativeTotal) / Math.max(1, qWeeks) * 100) / 100;
    const qTotal = q < numQuarters
      ? Math.round(rawWeekly * qWeeks * 100) / 100
      : Math.round((totalPrice - cumulativeTotal) * 100) / 100;

    quarters.push({ quarter: q, weeks: qWeeks, weeklyAmount, total: qTotal });
    weeksAssigned += qWeeks;
    if (q < numQuarters) cumulativeTotal += qTotal;
  }

  return quarters;
}

export default function VehiclePurchases({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [schedulePreview, setSchedulePreview] = useState(null);
  const qc = useQueryClient();

  const isDriver = currentUser?.role === 'driver' || currentUser?.hasRole?.('driver');
  const isAdmin = currentUser?.role === 'admin' || currentUser?.hasRole?.('admin');

  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const myDriverRecord = isDriver ? allDrivers.find(d => d.email === currentUser?.email) : null;

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['vehicle-purchases', isDriver ? myDriverRecord?.id : 'all'],
    queryFn: async () => {
      if (isDriver && myDriverRecord) return base44.entities.VehiclePurchase.filter({ driver_id: myDriverRecord.id });
      return base44.entities.VehiclePurchase.list('-created_date');
    },
    enabled: !isDriver || !!myDriverRecord,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.VehiclePurchase.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-purchases'] }); setShowForm(false); setSchedulePreview(null); },
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldPurchase }) => {
      if (data.prepayment_amount && data.prepayment_amount !== oldPurchase.prepayment_amount) {
        const prepaymentDiff = data.prepayment_amount - (oldPurchase.prepayment_amount || 0);
        if (prepaymentDiff > 0) {
          await base44.entities.Expense.create({
            category: 'vehicle_costs',
            description: `Pago - Paiement anticipé: ${oldPurchase.driver_name} - ${oldPurchase.vehicle_info}`,
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

  const [form, setForm] = useState({ driver_id: '', driver_name: '', vehicle_id: '', duration_months: '' });
  const selectedVehicle = vehicles.find(v => v.id === form.vehicle_id);
  const totalPrice = selectedVehicle?.market_price ? Math.round(selectedVehicle.market_price * 1.25 * 100) / 100 : 0;
  const months = parseInt(form.duration_months) || 0;

  const schedule = useMemo(() => {
    if (!totalPrice || !months) return null;
    return computeQuarterlySchedule(totalPrice, months);
  }, [totalPrice, months]);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    const driver = allDrivers.find(d => d.id === form.driver_id);
    const firstQuarterWeekly = schedule?.[0]?.weeklyAmount || 0;
    createMutation.mutate({
      driver_name: driver?.full_name || form.driver_name,
      driver_id: form.driver_id,
      vehicle_id: form.vehicle_id,
      vehicle_info: selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model} - ${selectedVehicle.license_plate}` : '',
      base_price: selectedVehicle?.market_price || 0,
      total_price: totalPrice,
      duration_months: months,
      weekly_installment: firstQuarterWeekly,
      remaining_balance: totalPrice,
      status: 'requested',
    });
  };

  // Columns — hide base_price for drivers
  const columns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Veículo', render: (r) => <span className="text-sm">{r.vehicle_info}</span> },
    ...(!isDriver ? [{ header: 'Preço total', render: (r) => fmt(r.total_price) }] : []),
    { header: 'Pagamento inicial', render: (r) => <span className="font-medium text-indigo-600">{fmt(r.weekly_installment)}/sem</span> },
    { header: 'Restante', render: (r) => <span className="text-red-600 font-medium">{fmt(r.remaining_balance)}</span> },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Compute schedule for selected purchase
  const selectedSchedule = useMemo(() => {
    if (!selected) return null;
    return computeQuarterlySchedule(selected.total_price, selected.duration_months);
  }, [selected]);

  return (
    <div className="space-y-4">
      <PageHeader title="Compra de veículos" subtitle="Opção de compra — Financement interne" actionLabel={isDriver ? "Fazer pedido" : "Novo pedido"} onAction={() => setShowForm(true)} />

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
              {isDriver && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800">Financiamento interno — sem aprovação bancária necessária</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Veículo</span><p className="font-medium">{selected.vehicle_info}</p></div>
                {!isDriver && <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Preço total</span><p className="font-medium">{fmt(selected.total_price)}</p></div>}
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Duração</span><p className="font-medium">{selected.duration_months} meses</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Restante</span><p className="font-medium text-red-600">{fmt(selected.remaining_balance)}</p></div>
              </div>

              {/* Quarterly schedule */}
              {selectedSchedule && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-indigo-500" /> Tabela degressiva por trimestre
                  </p>
                  <div className="space-y-1.5">
                    {selectedSchedule.map((q, i) => (
                      <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg ${i === 0 ? 'bg-indigo-50' : i === selectedSchedule.length - 1 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                        <div>
                          <p className="text-xs font-medium text-gray-700">Trimestre {q.quarter} <span className="text-gray-400">({q.weeks} semanas)</span></p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${i === 0 ? 'text-indigo-700' : i === selectedSchedule.length - 1 ? 'text-emerald-700' : 'text-gray-700'}`}>
                            {fmt(q.weeklyAmount)}<span className="font-normal text-xs text-gray-500">/sem</span>
                          </p>
                          <p className="text-[10px] text-gray-400">Total: {fmt(q.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">Regra TVDE: máximo 7 anos. Total: {fmt(selected.total_price)}</p>
                </div>
              )}

              {isAdmin && (
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
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setSchedulePreview(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo pedido de compra</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isDriver && (
              <div className="space-y-1.5"><Label className="text-xs">Motorista</Label>
                <Select value={form.driver_id} onValueChange={(v) => { const d = allDrivers.find(dr => dr.id === v); setForm(f => ({...f, driver_id: v, driver_name: d?.full_name || ''})); }} required>
                  <SelectTrigger><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
                  <SelectContent>{allDrivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label className="text-xs">Veículo</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm(f => ({...f, vehicle_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Escolher veículo..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.license_plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Duração</Label>
              <Select value={form.duration_months?.toString()} onValueChange={(v) => setForm(f => ({...f, duration_months: v}))}>
                <SelectTrigger><SelectValue placeholder="Escolher duração..." /></SelectTrigger>
                <SelectContent>
                  {['6','12','18','24','30','36'].map(v => {
                    const months = parseInt(v);
                    const tp = selectedVehicle?.market_price ? Math.round(selectedVehicle.market_price * 1.25 * 100) / 100 : 0;
                    const sched = tp > 0 ? computeQuarterlySchedule(tp, months) : null;
                    if (tp > 0 && sched === null) return null; // T1=300 not enough, skip
                    const label = v === '12' ? '1 ano (12 meses)' : v === '24' ? '2 anos (24 meses)' : v === '36' ? '3 anos (36 meses)' : `${v} meses`;
                    return <SelectItem key={v} value={v}>{label}</SelectItem>;
                  }).filter(Boolean)}
                </SelectContent>
              </Select>
            </div>

            {schedule && (
              <div className="space-y-2">
                <div className="bg-indigo-50 p-3 rounded-lg space-y-1 text-sm">
                  <p className="font-semibold text-indigo-900">Financiamento interno — sem aprovação bancária necessária</p>
                  <p>Preço total (com financiamento): <strong className="text-indigo-700">{fmt(totalPrice)}</strong></p>
                </div>
                <p className="text-xs font-semibold text-gray-700 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-indigo-500" /> Tabela degressiva por trimestre</p>
                <div className="space-y-1">
                  {schedule.map((q, i) => (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-xs ${i === 0 ? 'bg-indigo-50' : i === schedule.length - 1 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      <span className="text-gray-600">T{q.quarter} ({q.weeks} sem)</span>
                      <span className={`font-bold ${i === 0 ? 'text-indigo-700' : i === schedule.length - 1 ? 'text-emerald-700' : 'text-gray-700'}`}>{fmt(q.weeklyAmount)}/sem</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 text-center">Regra TVDE: máximo 7 anos · Total exato: {fmt(totalPrice)}</p>
              </div>
            )}
            <Button type="submit" disabled={createMutation.isPending || !schedule} className="w-full bg-indigo-600 hover:bg-indigo-700">Criar pedido</Button>
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
        <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
      </div>
    </form>
  );
}