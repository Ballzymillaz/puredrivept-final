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
import WeeklyPaymentForm from '../components/payments/WeeklyPaymentForm';

export default function Payments() {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
  const [editMode, setEditMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
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
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.WeeklyPayment.update(id, data);
      
      // If status changed to 'paid', sync to expenses and UPI
      if (data.status === 'paid') {
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
        <StatCard title="Total bruto" value={fmt(totalGross)} icon={TrendingUp} color="green" />
        <StatCard title="Deduções" value={fmt(totalDeductions)} icon={TrendingDown} color="rose" />
        <StatCard title="Líquido a pagar" value={fmt(totalNet)} icon={Wallet} color="indigo" />
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
                  ['IVA', fmt(selected.iva_amount)],
                  ['IRS', fmt(selected.irs_retention)],
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
                <Select value={selected.status} onValueChange={(v) => updateMutation.mutate({ id: selected.id, data: { status: v } })}>
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
          <WeeklyPaymentForm drivers={drivers} onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentEditForm({ payment, onSave, onCancel }) {
  const [form, setForm] = useState({ ...payment });
  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: parseFloat(v) || 0 }));
  const handleSubmit = (e) => {
    e.preventDefault();
    const totalGross = (form.uber_gross || 0) + (form.bolt_gross || 0) + (form.other_platform_gross || 0);
    const totalDeductions = (form.commission_amount || 0) + (form.slot_fee || 0) + (form.vehicle_rental || 0) + (form.via_verde_amount || 0) + (form.myprio_amount || 0) + (form.miio_amount || 0) + (form.loan_installment || 0) + (form.vehicle_purchase_installment || 0) + (form.iva_amount || 0) + (form.irs_retention || 0);
    const netAmount = totalGross - totalDeductions + (form.reimbursement_credit || 0) + (form.goal_bonus || 0);
    const upiEarned = Math.round((form.uber_gross + form.bolt_gross) * 0.04);
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
          ['IVA', 'iva_amount'], ['IRS', 'irs_retention'],
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