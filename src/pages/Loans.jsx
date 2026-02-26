import React, { useState } from 'react';
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
import { Wallet, Clock, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Loans() {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [driverFilter, setDriverFilter] = useState('all');
  const [detailsDialog, setDetailsDialog] = useState(null);
  const qc = useQueryClient();

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: () => base44.entities.Loan.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Loan.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }) => {
      const result = await base44.entities.Loan.update(id, data);
      
      // Si on change le montant payé, ajuster le restant et créer une recette
      if (data.paid_amount !== undefined && oldData) {
        const newRemaining = oldData.total_with_interest - data.paid_amount;
        if (newRemaining !== data.remaining_balance) {
          await base44.entities.Loan.update(id, { remaining_balance: Math.max(0, newRemaining) });
        }
        
        // Si le montant payé a augmenté, créer une recette
        const paidDiff = data.paid_amount - (oldData.paid_amount || 0);
        if (paidDiff > 0) {
          await base44.entities.Expense.create({
            category: 'loans',
            description: `Remboursement prêt - ${oldData.driver_name}`,
            amount: -paidDiff,
            date: new Date().toISOString().split('T')[0],
            driver_id: oldData.driver_id,
            notes: `Loan ID: ${id} - Paiement anticipé`,
          });
        }
      }
      
      return result;
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['loans'] }); 
      qc.invalidateQueries({ queryKey: ['expenses-all'] });
      setSelected(null); 
      setEditForm(null); 
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (loan) => {
      // Supprimer les dépenses liées au prêt
      await base44.functions.invoke('deleteLoanExpense', { loanId: loan.id });
      return await base44.entities.Loan.delete(loan.id);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['loans'] }); 
      qc.invalidateQueries({ queryKey: ['expenses-all'] });
      setSelected(null); 
      setEditForm(null); 
    },
  });
  
  const approveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.Loan.update(id, data);
      // Créer une dépense pour le prêt accordé
      await base44.functions.invoke('createLoanExpense', { loanId: id });
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['expenses-all'] });
      setSelected(null);
    },
  });

  const [form, setForm] = useState({ driver_id: '', amount: '', duration_weeks: '' });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const interestRate = 1; // 1% per week
  const calcTotal = (amount, weeks) => {
    const a = parseFloat(amount) || 0;
    const w = parseInt(weeks) || 0;
    const totalInterest = a * (interestRate / 100) * w;
    return { total: a + totalInterest, weekly: w > 0 ? (a + totalInterest) / w : 0 };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { total, weekly } = calcTotal(form.amount, form.duration_weeks);
    const driver = drivers.find(d => d.id === form.driver_id);
    createMutation.mutate({
      driver_id: form.driver_id,
      driver_name: driver?.full_name || '',
      amount: parseFloat(form.amount),
      duration_weeks: parseInt(form.duration_weeks),
      interest_rate_weekly: interestRate,
      total_with_interest: total,
      weekly_installment: weekly,
      remaining_balance: total,
      status: 'requested',
      request_date: new Date().toISOString().split('T')[0],
    });
  };

  const filteredLoans = driverFilter === 'all' 
    ? loans 
    : driverFilter === 'none'
    ? loans.filter(l => !l.driver_id)
    : loans.filter(l => l.driver_id === driverFilter);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
  const activeLoans = filteredLoans.filter(l => l.status === 'active');
  const completedLoans = filteredLoans.filter(l => l.status === 'completed');
  const totalOutstanding = activeLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);

  const columns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Montante', render: (r) => fmt(r.amount) },
    { header: 'Total c/ juros', render: (r) => fmt(r.total_with_interest) },
    { header: 'Semanal', render: (r) => fmt(r.weekly_installment) },
    { header: 'Restante', render: (r) => <span className="font-medium text-red-600">{fmt(r.remaining_balance)}</span> },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  const preview = calcTotal(form.amount, form.duration_weeks);

  return (
    <div className="space-y-4">
      <PageHeader title="Empréstimos & Adiantamentos" subtitle={`${loans.length} empréstimos`} actionLabel="Novo empréstimo" onAction={() => setShowForm(true)} />
      
      <div className="flex gap-3">
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por motorista..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motoristas</SelectItem>
            <SelectItem value="none">Sem motorista</SelectItem>
            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setDetailsDialog('active')}>
          <StatCard title="Empréstimos ativos" value={activeLoans.length} icon={Clock} color="amber" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('outstanding')}>
          <StatCard title="Saldo restante" value={fmt(totalOutstanding)} icon={Wallet} color="rose" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('completed')}>
          <StatCard title="Empréstimos quitados" value={completedLoans.length} icon={CheckCircle2} color="green" />
        </div>
      </div>
      <DataTable columns={columns} data={filteredLoans} isLoading={isLoading} onRowClick={setSelected} />

      {/* Approve/Complete dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditForm(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Empréstimo — {selected?.driver_name}</DialogTitle></DialogHeader>
          {selected && !editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Montante</span><p className="font-medium">{fmt(selected.amount)}</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Duração</span><p className="font-medium">{selected.duration_weeks} sem</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Total</span><p className="font-medium">{fmt(selected.total_with_interest)}</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Restante</span><p className="font-medium text-red-600">{fmt(selected.remaining_balance)}</p></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditForm({ ...selected })}>Editar</Button>
                <Button variant="outline" className="flex-1 text-red-600" onClick={() => { if (confirm('Eliminar empréstimo?')) deleteMutation.mutate(selected); }}>Eliminar</Button>
                {selected.status === 'requested' && (
                  <>
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMutation.mutate({ id: selected.id, data: { status: 'active', approval_date: new Date().toISOString().split('T')[0] } })}>Aprovar</Button>
                    <Button variant="outline" className="flex-1 text-red-600" onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'rejected' }, oldData: selected })}>Rejeitar</Button>
                  </>
                )}
              </div>
            </div>
          )}
          {selected && editForm && <LoanEditForm loan={editForm} onSave={(data) => { updateMutation.mutate({ id: selected.id, data, oldData: selected }); setEditForm(null); }} onCancel={() => setEditForm(null)} />}
        </DialogContent>
      </Dialog>

      {/* New loan form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo empréstimo</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Motorista</Label>
              <Select value={form.driver_id} onValueChange={(v) => setForm(f => ({...f, driver_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
                <SelectContent>
                  {drivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Montante (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({...f, amount: e.target.value}))} required /></div>
            <div className="space-y-1.5"><Label className="text-xs">Duração (semanas)</Label><Input type="number" value={form.duration_weeks} onChange={(e) => setForm(f => ({...f, duration_weeks: e.target.value}))} required /></div>
            {form.amount && form.duration_weeks && (
              <div className="bg-indigo-50 p-3 rounded-lg space-y-1 text-sm">
                <p className="text-gray-600">Taxa: <span className="font-semibold">{interestRate}%/semana</span></p>
                <p className="text-gray-600">Total a pagar: <span className="font-bold text-indigo-700">{fmt(preview.total)}</span></p>
                <p className="text-gray-600">Pagamento semanal: <span className="font-bold text-indigo-700">{fmt(preview.weekly)}</span></p>
              </div>
            )}
            <Button type="submit" disabled={createMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">Criar pedido</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === 'active' && 'Detalhes: Empréstimos Ativos'}
              {detailsDialog === 'outstanding' && 'Detalhes: Saldo Restante'}
              {detailsDialog === 'completed' && 'Detalhes: Empréstimos Quitados'}
            </DialogTitle>
          </DialogHeader>
          <LoanDetailsContent type={detailsDialog} activeLoans={activeLoans} completedLoans={completedLoans} fmt={fmt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoanDetailsContent({ type, activeLoans, completedLoans, fmt }) {
  if (type === 'active') {
    return (
      <div className="space-y-2">
        {activeLoans.length === 0 ? (
          <p className="text-center py-4 text-gray-400">Nenhum empréstimo ativo</p>
        ) : (
          activeLoans.map(l => (
            <div key={l.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium">{l.driver_name}</p>
                <p className="text-sm text-gray-500">Duração: {l.duration_weeks} semanas</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{fmt(l.amount)}</p>
                <p className="text-sm text-gray-500">Total: {fmt(l.total_with_interest)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (type === 'outstanding') {
    const total = activeLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-rose-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {activeLoans.map(l => (
            <div key={l.id} className="flex justify-between items-center p-3 border-b">
              <div>
                <p className="font-medium">{l.driver_name}</p>
                <p className="text-sm text-gray-500">Pago: {fmt(l.paid_amount || 0)}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-red-600">{fmt(l.remaining_balance)}</p>
                <p className="text-sm text-gray-500">Semanal: {fmt(l.weekly_installment)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'completed') {
    return (
      <div className="space-y-2">
        {completedLoans.length === 0 ? (
          <p className="text-center py-4 text-gray-400">Nenhum empréstimo quitado</p>
        ) : (
          completedLoans.map(l => (
            <div key={l.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium">{l.driver_name}</p>
                <p className="text-sm text-gray-500">Duração: {l.duration_weeks} semanas</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-green-600">{fmt(l.total_with_interest)}</p>
                <p className="text-sm text-gray-500">Quitado</p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return null;
}

function LoanEditForm({ loan, onSave, onCancel }) {
  const [form, setForm] = useState({ 
    remaining_balance: loan?.remaining_balance || 0,
    paid_amount: loan?.paid_amount || 0,
    status: loan?.status || 'active'
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      remaining_balance: parseFloat(form.remaining_balance) || 0, 
      paid_amount: parseFloat(form.paid_amount) || 0,
      status: form.status
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs">Restante</Label><Input type="number" step="0.01" value={form.remaining_balance || 0} onChange={(e) => setForm(f => ({ ...f, remaining_balance: e.target.value }))} /></div>
      <div className="space-y-1.5"><Label className="text-xs">Pagamento antecipado</Label><Input type="number" step="0.01" value={form.paid_amount || 0} onChange={(e) => setForm(f => ({ ...f, paid_amount: e.target.value }))} /></div>
      <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
        <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="requested">Solicitado</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
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

function LoanDeleteButton({ loanId, onDelete }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="text-red-600"
      onClick={() => { if (confirm('Eliminar empréstimo?')) onDelete(loanId); }}
    >
      Eliminar
    </Button>
  );
}