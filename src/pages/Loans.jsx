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

export default function Loans() {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
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
    mutationFn: ({ id, data }) => base44.entities.Loan.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); setSelected(null); },
  });

  const [form, setForm] = useState({ driver_name: '', amount: '', duration_weeks: '' });

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
    createMutation.mutate({
      ...form,
      driver_id: form.driver_name,
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

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
  const activeLoans = loans.filter(l => l.status === 'active');
  const totalOutstanding = activeLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);

  const columns = [
    { header: 'Chauffeur', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Montant', render: (r) => fmt(r.amount) },
    { header: 'Total avec intérêts', render: (r) => fmt(r.total_with_interest) },
    { header: 'Hebdo', render: (r) => fmt(r.weekly_installment) },
    { header: 'Restant', render: (r) => <span className="font-medium text-red-600">{fmt(r.remaining_balance)}</span> },
    { header: 'Statut', render: (r) => <StatusBadge status={r.status} /> },
  ];

  const preview = calcTotal(form.amount, form.duration_weeks);

  return (
    <div className="space-y-4">
      <PageHeader title="Prêts & Avances" subtitle={`${loans.length} prêts`} actionLabel="Nouveau prêt" onAction={() => setShowForm(true)} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Prêts actifs" value={activeLoans.length} icon={Clock} color="amber" />
        <StatCard title="Solde restant" value={fmt(totalOutstanding)} icon={Wallet} color="rose" />
        <StatCard title="Prêts soldés" value={loans.filter(l => l.status === 'completed').length} icon={CheckCircle2} color="green" />
      </div>
      <DataTable columns={columns} data={loans} isLoading={isLoading} onRowClick={setSelected} />

      {/* Approve/Complete dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Prêt — {selected?.driver_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Montant</span><p className="font-medium">{fmt(selected.amount)}</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Durée</span><p className="font-medium">{selected.duration_weeks} sem</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Total</span><p className="font-medium">{fmt(selected.total_with_interest)}</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Restant</span><p className="font-medium text-red-600">{fmt(selected.remaining_balance)}</p></div>
              </div>
              {selected.status === 'requested' && (
                <div className="flex gap-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'active', approval_date: new Date().toISOString().split('T')[0] } })}>Approuver</Button>
                  <Button variant="outline" className="flex-1 text-red-600" onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'rejected' } })}>Rejeter</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New loan form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nouveau prêt</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Nom du chauffeur</Label><Input value={form.driver_name} onChange={(e) => setForm(f => ({...f, driver_name: e.target.value}))} required /></div>
            <div className="space-y-1.5"><Label className="text-xs">Montant (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({...f, amount: e.target.value}))} required /></div>
            <div className="space-y-1.5"><Label className="text-xs">Durée (semaines)</Label><Input type="number" value={form.duration_weeks} onChange={(e) => setForm(f => ({...f, duration_weeks: e.target.value}))} required /></div>
            {form.amount && form.duration_weeks && (
              <div className="bg-indigo-50 p-3 rounded-lg space-y-1 text-sm">
                <p className="text-gray-600">Taux : <span className="font-semibold">{interestRate}%/semaine</span></p>
                <p className="text-gray-600">Total à rembourser : <span className="font-bold text-indigo-700">{fmt(preview.total)}</span></p>
                <p className="text-gray-600">Paiement hebdo : <span className="font-bold text-indigo-700">{fmt(preview.weekly)}</span></p>
              </div>
            )}
            <Button type="submit" disabled={createMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">Créer la demande</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}