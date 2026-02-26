import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import StatCard from '../components/dashboard/StatCard';
import { CreditCard, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { startOfWeek, endOfWeek, format, addWeeks } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

export default function Payments() {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
  const [editMode, setEditMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState(null);
  const qc = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 100),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.WeeklyPayment.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldPayment }) => {
      const result = await base44.entities.WeeklyPayment.update(id, data);
      
      // If status changed to 'paid', sync to expenses and UPI
      if (data.status === 'paid' && oldPayment.status !== 'paid') {
        try {
          await base44.functions.invoke('syncPaymentToExpenses', { paymentId: id });
        } catch (error) {
          console.error('Error syncing payment:', error);
        }
      }
      
      return result;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['payments'] });
      await qc.invalidateQueries({ queryKey: ['expenses-all'] });
      await qc.invalidateQueries({ queryKey: ['upi-transactions'] });
      await qc.invalidateQueries({ queryKey: ['drivers'] });
      setEditMode(false);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (payment) => {
      // Si le paiement était payé, supprimer les dépenses/UPI associés
      if (payment.status === 'paid') {
        await base44.functions.invoke('deletePaymentExpenses', { paymentId: payment.id });
      }
      return await base44.entities.WeeklyPayment.delete(payment.id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['payments'] });
      await qc.invalidateQueries({ queryKey: ['expenses-all'] });
      await qc.invalidateQueries({ queryKey: ['upi-transactions'] });
      await qc.invalidateQueries({ queryKey: ['drivers'] });
      setSelected(null);
    },
  });

  const filtered = payments.filter(p => {
    const statusMatch = statusFilter === 'all' || p.status === statusFilter;
    const driverMatch = driverFilter === 'all' || p.driver_id === driverFilter;
    const weekMatch = weekFilter === 'all' || p.period_label === weekFilter;
    return statusMatch && driverMatch && weekMatch;
  });
  const totalGross = filtered.reduce((s, p) => s + (p.total_gross || 0), 0);
  const totalNet = filtered.reduce((s, p) => s + (p.net_amount || 0), 0);
  const totalDeductions = filtered.reduce((s, p) => s + (p.total_deductions || 0), 0);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const columns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Período', render: (r) => <span className="text-sm">{r.period_label || `${r.week_start}`}</span> },
    { header: 'Bruto', render: (r) => <span className="text-sm font-medium text-gray-900">{fmt(r.total_gross)}</span> },
    { header: 'Deduções', render: (r) => <span className="text-sm text-red-600">{fmt(r.total_deductions)}</span> },
    { header: 'Líquido', render: (r) => <span className="text-sm font-bold text-indigo-700">{fmt(r.net_amount)}</span> },
    { header: 'UPI', render: (r) => <span className="text-sm text-violet-600">{r.upi_earned || 0}</span> },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Pagamentos semanais" subtitle={`${payments.length} pagamentos`} actionLabel="Novo pagamento" onAction={() => { setShowForm(true); }} />
      
      <div className="flex flex-wrap gap-3">
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os motoristas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motoristas</SelectItem>
            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todas semanas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as semanas</SelectItem>
            {[...new Set(payments.map(p => p.period_label))].filter(Boolean).map(w => (
              <SelectItem key={w} value={w}>{w}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setDetailsDialog('gross')}>
          <StatCard title="Total bruto" value={fmt(totalGross)} icon={TrendingUp} color="green" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('deductions')}>
          <StatCard title="Deduções" value={fmt(totalDeductions)} icon={TrendingDown} color="rose" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('net')}>
          <StatCard title="Líquido a pagar" value={fmt(totalNet)} icon={Wallet} color="indigo" />
        </div>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelected} />

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditMode(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe pagamento — {selected?.driver_name}</DialogTitle>
          </DialogHeader>
          {selected && !editMode && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Uber', fmt(selected.uber_gross)],
                  ['Bolt', fmt(selected.bolt_gross)],
                  ['Outros', fmt(selected.other_platform_gross)],
                  ['Comissão', fmt(selected.commission_amount)],
                  ['Taxa slot', fmt(selected.slot_fee)],
                  ['Aluguer veículo', fmt(selected.vehicle_rental)],
                  ['Via Verde', fmt(selected.via_verde_amount)],
                  ['MyPRIO', fmt(selected.myprio_amount)],
                  ['Miio', fmt(selected.miio_amount)],
                  ['Empréstimo', fmt(selected.loan_installment)],
                  ['Compra veículo', fmt(selected.vehicle_purchase_installment)],
                  ['Reembolsos', fmt(selected.reimbursement_credit)],
                  ['Bónus objetivo', fmt(selected.goal_bonus)],
                  ['6% IVA (obrigatorio estado)', fmt(selected.iva_amount)],
                  ['Caução', fmt(selected.irs_retention)],
                  ['UPI ganhos', selected.upi_earned],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between p-3 bg-indigo-50 rounded-lg text-indigo-900 font-bold">
                <span>Líquido a pagar</span>
                <span>{fmt(selected.net_amount)}</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setEditMode(true)} variant="outline" className="flex-1">Editar</Button>
                <Button variant="outline" className="flex-1 text-red-600" onClick={() => { if (confirm('Eliminar pagamento?')) deleteMutation.mutate(selected); }}>Eliminar</Button>
                <Select value={selected.status} onValueChange={(v) => updateMutation.mutate({ id: selected.id, data: { status: v }, oldPayment: selected })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="disputed">Contestado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {selected && editMode && <PaymentEditForm payment={selected} onSave={(data) => updateMutation.mutate({ id: selected.id, data })} onCancel={() => setEditMode(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo pagamento semanal</DialogTitle></DialogHeader>
          <NewPaymentForm drivers={drivers} onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === 'gross' && 'Detalhes: Total Bruto'}
              {detailsDialog === 'deductions' && 'Detalhes: Deduções'}
              {detailsDialog === 'net' && 'Detalhes: Líquido a Pagar'}
            </DialogTitle>
          </DialogHeader>
          <PaymentDetailsContent type={detailsDialog} payments={filtered} fmt={fmt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentDetailsContent({ type, payments, fmt }) {
  if (type === 'gross') {
    const total = payments.reduce((s, p) => s + (p.total_gross || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="flex justify-between items-center p-2 border-b">
              <div>
                <p className="font-medium text-sm">{p.driver_name}</p>
                <p className="text-xs text-gray-500">{p.period_label}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{fmt(p.total_gross)}</p>
                <p className="text-xs text-gray-500">Uber: {fmt(p.uber_gross)} | Bolt: {fmt(p.bolt_gross)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'deductions') {
    const total = payments.reduce((s, p) => s + (p.total_deductions || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-rose-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="p-3 border-b">
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium text-sm">{p.driver_name}</p>
                <p className="font-bold text-red-600">{fmt(p.total_deductions)}</p>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                {p.commission_amount > 0 && <p>Comissão: {fmt(p.commission_amount)}</p>}
                {p.slot_fee > 0 && <p>Taxa slot: {fmt(p.slot_fee)}</p>}
                {p.vehicle_rental > 0 && <p>Aluguer: {fmt(p.vehicle_rental)}</p>}
                {p.via_verde_amount > 0 && <p>Via Verde: {fmt(p.via_verde_amount)}</p>}
                {p.myprio_amount > 0 && <p>MyPRIO: {fmt(p.myprio_amount)}</p>}
                {p.miio_amount > 0 && <p>Miio: {fmt(p.miio_amount)}</p>}
                {p.loan_installment > 0 && <p>Empréstimo: {fmt(p.loan_installment)}</p>}
                {p.vehicle_purchase_installment > 0 && <p>Compra: {fmt(p.vehicle_purchase_installment)}</p>}
                {p.iva_amount > 0 && <p>6% IVA: {fmt(p.iva_amount)}</p>}
                {p.irs_retention > 0 && <p>Caução: {fmt(p.irs_retention)}</p>}
                {p.upi_earned > 0 && <p>UPI: {p.upi_earned}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'net') {
    const total = payments.reduce((s, p) => s + (p.net_amount || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-indigo-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="flex justify-between items-center p-2 border-b">
              <div>
                <p className="font-medium text-sm">{p.driver_name}</p>
                <p className="text-xs text-gray-500">{p.period_label}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-indigo-700">{fmt(p.net_amount)}</p>
                <p className="text-xs text-gray-500">Bruto: {fmt(p.total_gross)} - Deduções: {fmt(p.total_deductions)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function PaymentEditForm({ payment, onSave, onCancel }) {
  const [form, setForm] = useState({ ...payment });
  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: parseFloat(v) || 0 }));
  const handleSubmit = (e) => {
    e.preventDefault();
    const totalGross = (form.uber_gross || 0) + (form.bolt_gross || 0) + (form.other_platform_gross || 0);
    const totalDeductions = (form.commission_amount || 0) + (form.slot_fee || 0) + (form.vehicle_rental || 0) + (form.via_verde_amount || 0) + (form.myprio_amount || 0) + (form.miio_amount || 0) + (form.loan_installment || 0) + (form.vehicle_purchase_installment || 0) + (form.iva_amount || 0) + (form.irs_retention || 0);
    const netAmount = totalGross - totalDeductions + (form.reimbursement_credit || 0) + (form.goal_bonus || 0);
    const upiEarned = Math.round((form.uber_gross + form.bolt_gross) * 0.04 * 100) / 100;
    onSave({ ...form, total_gross: totalGross, total_deductions: totalDeductions, net_amount: netAmount, upi_earned: upiEarned });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Uber', 'uber_gross'], ['Bolt', 'bolt_gross'], ['Outros', 'other_platform_gross'],
          ['Comissão', 'commission_amount'], ['Taxa slot', 'slot_fee'], ['Aluguer', 'vehicle_rental'],
          ['Via Verde', 'via_verde_amount'], ['MyPRIO', 'myprio_amount'], ['Miio', 'miio_amount'],
          ['Empréstimo', 'loan_installment'], ['Compra veículo', 'vehicle_purchase_installment'],
          ['Reembolsos', 'reimbursement_credit'], ['Bónus', 'goal_bonus'],
          ['6% IVA (obrigatorio estado)', 'iva_amount'], ['Caução', 'irs_retention'],
        ].map(([label, key]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input type="number" step="0.01" value={form[key] || 0} onChange={(e) => handleChange(key, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
      </div>
    </form>
  );
}

function NewPaymentForm({ drivers, onSubmit, isLoading, onCancel }) {
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [form, setForm] = useState({
    driver_id: '',
    uber_gross: 0,
    bolt_gross: 0,
    slot_fee: 0,
    vehicle_rental: 0,
    via_verde_amount: 0,
    myprio_amount: 0,
    miio_amount: 0,
    loan_installment: 0,
    vehicle_purchase_installment: 0,
    reimbursement_credit: 0,
    goal_bonus: 0,
    irs_retention: 0,
    notes: '',
  });

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const date = addWeeks(new Date(), -i);
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
      label: `Semana ${format(start, 'dd/MM')} - ${format(end, 'dd/MM/yyyy')}`,
    };
  });

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedWeek || !form.driver_id) return;

    const driver = drivers.find(d => d.id === form.driver_id);
    const totalGross = (parseFloat(form.uber_gross) || 0) + (parseFloat(form.bolt_gross) || 0);
    const upiEarned = Math.round(totalGross * 0.04 * 100) / 100;
    const ivaAmount = Math.round(totalGross * 0.06 * 100) / 100;

    const totalDeductions = 
      (parseFloat(form.slot_fee) || 0) +
      (parseFloat(form.vehicle_rental) || 0) +
      (parseFloat(form.via_verde_amount) || 0) +
      (parseFloat(form.myprio_amount) || 0) +
      (parseFloat(form.miio_amount) || 0) +
      (parseFloat(form.loan_installment) || 0) +
      (parseFloat(form.vehicle_purchase_installment) || 0) +
      ivaAmount +
      (parseFloat(form.irs_retention) || 0) +
      upiEarned;

    const netAmount = totalGross - totalDeductions + (parseFloat(form.reimbursement_credit) || 0) + (parseFloat(form.goal_bonus) || 0);

    onSubmit({
      driver_id: form.driver_id,
      driver_name: driver?.full_name || '',
      week_start: selectedWeek.start,
      week_end: selectedWeek.end,
      period_label: selectedWeek.label,
      uber_gross: parseFloat(form.uber_gross) || 0,
      bolt_gross: parseFloat(form.bolt_gross) || 0,
      total_gross: totalGross,
      slot_fee: parseFloat(form.slot_fee) || 0,
      vehicle_rental: parseFloat(form.vehicle_rental) || 0,
      via_verde_amount: parseFloat(form.via_verde_amount) || 0,
      myprio_amount: parseFloat(form.myprio_amount) || 0,
      miio_amount: parseFloat(form.miio_amount) || 0,
      loan_installment: parseFloat(form.loan_installment) || 0,
      vehicle_purchase_installment: parseFloat(form.vehicle_purchase_installment) || 0,
      reimbursement_credit: parseFloat(form.reimbursement_credit) || 0,
      goal_bonus: parseFloat(form.goal_bonus) || 0,
      iva_amount: ivaAmount,
      irs_retention: parseFloat(form.irs_retention) || 0,
      upi_earned: upiEarned,
      total_deductions: totalDeductions,
      net_amount: netAmount,
      status: 'draft',
    });
  };

  const totalGross = (parseFloat(form.uber_gross) || 0) + (parseFloat(form.bolt_gross) || 0);
  const upiPreview = Math.round(totalGross * 0.04 * 100) / 100;
  const ivaPreview = Math.round(totalGross * 0.06 * 100) / 100;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Motorista *</Label>
          <Select value={form.driver_id} onValueChange={(v) => handleChange('driver_id', v)}>
            <SelectTrigger><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
            <SelectContent>
              {drivers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.full_name} - {d.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Semana *</Label>
          <Select value={selectedWeek?.start} onValueChange={(v) => setSelectedWeek(weeks.find(w => w.start === v))}>
            <SelectTrigger><SelectValue placeholder="Escolher semana..." /></SelectTrigger>
            <SelectContent>
              {weeks.map(w => (
                <SelectItem key={w.start} value={w.start}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5"><Label className="text-xs">Uber bruto (€)</Label><Input type="number" step="0.01" value={form.uber_gross} onChange={(e) => handleChange('uber_gross', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Bolt bruto (€)</Label><Input type="number" step="0.01" value={form.bolt_gross} onChange={(e) => handleChange('bolt_gross', e.target.value)} /></div>
        
        {totalGross > 0 && (
          <div className="sm:col-span-2 p-3 bg-indigo-50 rounded-lg space-y-1 text-sm">
            <p>Total bruto: <strong>€{totalGross.toFixed(2)}</strong></p>
            <p>UPI ganhos (4%): <strong>{upiPreview} UPI</strong></p>
            <p>6% IVA (obrigatorio estado): <strong>€{ivaPreview.toFixed(2)}</strong></p>
          </div>
        )}

        <div className="space-y-1.5"><Label className="text-xs">Taxa slot (€)</Label><Input type="number" step="0.01" value={form.slot_fee} onChange={(e) => handleChange('slot_fee', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Aluguer veículo (€)</Label><Input type="number" step="0.01" value={form.vehicle_rental} onChange={(e) => handleChange('vehicle_rental', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Via Verde (€)</Label><Input type="number" step="0.01" value={form.via_verde_amount} onChange={(e) => handleChange('via_verde_amount', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">MyPRIO (€)</Label><Input type="number" step="0.01" value={form.myprio_amount} onChange={(e) => handleChange('myprio_amount', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Miio (€)</Label><Input type="number" step="0.01" value={form.miio_amount} onChange={(e) => handleChange('miio_amount', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Empréstimo (€)</Label><Input type="number" step="0.01" value={form.loan_installment} onChange={(e) => handleChange('loan_installment', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Compra veículo (€)</Label><Input type="number" step="0.01" value={form.vehicle_purchase_installment} onChange={(e) => handleChange('vehicle_purchase_installment', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Reembolsos (€)</Label><Input type="number" step="0.01" value={form.reimbursement_credit} onChange={(e) => handleChange('reimbursement_credit', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Bónus objetivos (€)</Label><Input type="number" step="0.01" value={form.goal_bonus} onChange={(e) => handleChange('goal_bonus', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Caução (€)</Label><Input type="number" step="0.01" value={form.irs_retention} onChange={(e) => handleChange('irs_retention', e.target.value)} /></div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={isLoading || !selectedWeek || !form.driver_id} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
          {isLoading ? 'A criar...' : 'Criar pagamento'}
        </Button>
      </div>
    </form>
  );
}