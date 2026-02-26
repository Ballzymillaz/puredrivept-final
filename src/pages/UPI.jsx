import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatCard from '../components/dashboard/StatCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Coins, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

export default function UPI() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['upi-transactions'],
    queryFn: () => base44.entities.UPITransaction.list('-created_date', 200),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.UPITransaction.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-transactions'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UPITransaction.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['upi-transactions'] }); setEditing(null); setShowForm(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (transaction) => {
      // Mettre à jour le solde du driver
      const driver = drivers.find(d => d.id === transaction.driver_id);
      if (driver) {
        const delta = transaction.type === 'credit' ? -transaction.amount : transaction.type === 'debit' ? transaction.amount : -transaction.amount;
        await base44.entities.Driver.update(driver.id, { upi_balance: Math.max(0, (driver.upi_balance || 0) + delta) });
      }
      return await base44.entities.UPITransaction.delete(transaction.id);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['upi-transactions'] }); 
      qc.invalidateQueries({ queryKey: ['drivers'] });
      setEditing(null); 
      setShowForm(false); 
    },
  });

  const totalUPI = Math.round(drivers.reduce((s, d) => s + (d.upi_balance || 0), 0) * 100) / 100;
  const totalEarned = Math.round(transactions.filter(t => t.type === 'earned').reduce((s, t) => s + (t.amount || 0), 0) * 100) / 100;

  const [form, setForm] = useState(editing || { driver_id: '', type: 'credit', amount: '', notes: '' });

  React.useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ driver_id: '', type: 'credit', amount: '', notes: '' });
  }, [editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: { amount: parseFloat(form.amount), notes: form.notes } });
    } else {
      const driver = drivers.find(d => d.id === form.driver_id);
      await createMutation.mutateAsync({
        ...form,
        driver_name: driver?.full_name || '',
        amount: parseFloat(form.amount),
        source: 'admin_adjustment',
        processed_by: 'admin',
      });
      // Update driver balance
      if (driver) {
        const delta = form.type === 'credit' ? parseFloat(form.amount) : -parseFloat(form.amount);
        await base44.entities.Driver.update(driver.id, { upi_balance: (driver.upi_balance || 0) + delta });
        qc.invalidateQueries({ queryKey: ['drivers'] });
      }
    }
  };

  // Top drivers by UPI
  const topDrivers = [...drivers].filter(d => d.upi_balance > 0).sort((a, b) => (b.upi_balance || 0) - (a.upi_balance || 0)).slice(0, 10);

  const columns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Tipo', render: (r) => (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.type === 'earned' ? 'bg-indigo-50 text-indigo-700' : r.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
        {r.type === 'earned' ? 'Ganho' : r.type === 'credit' ? 'Creditado' : 'Debitado'}
      </span>
    )},
    { header: 'Montante', render: (r) => <span className="font-medium">{r.amount} UPI</span> },
    { header: 'Origem', render: (r) => <span className="text-sm text-gray-500">{r.source}</span> },
    { header: 'Data', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_date), 'dd/MM/yyyy')}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Moeda UPI" subtitle="4% dos rendimentos Uber + Bolt" actionLabel="Ajustar UPI" onAction={() => setShowForm(true)} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="UPI total em circulação" value={`${totalUPI.toLocaleString()} UPI`} icon={Coins} color="violet" />
        <StatCard title="UPI ganhos (auto)" value={`${totalEarned.toLocaleString()} UPI`} icon={TrendingUp} color="indigo" />
        <StatCard title="Motoristas com UPI" value={drivers.filter(d => d.upi_balance > 0).length} icon={Users} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Top detentores UPI</CardTitle></CardHeader>
          <CardContent>
            {topDrivers.length === 0 ? (
              <p className="text-center py-6 text-sm text-gray-400">Nenhum UPI distribuído</p>
            ) : (
              <div className="space-y-2">
                {topDrivers.map((d, i) => (
                  <div key={d.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 w-5">#{i+1}</span>
                      <span className="text-sm font-medium">{d.full_name}</span>
                    </div>
                    <span className="text-sm font-bold text-violet-600">{d.upi_balance} UPI</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <DataTable columns={columns} data={transactions} isLoading={isLoading} emptyMessage="Nenhuma transação UPI" onRowClick={(t) => { setEditing(t); setShowForm(true); }} />
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Ajustar'} UPI</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <>
                <div className="space-y-1.5"><Label className="text-xs">Motorista</Label>
                  <Select value={form.driver_id} onValueChange={(v) => setForm(f => ({...f, driver_id: v}))}>
                    <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                    <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name} ({d.upi_balance || 0} UPI)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs">Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setForm(f => ({...f, type: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Creditar</SelectItem>
                        <SelectItem value="debit">Debitar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Montante UPI</Label><Input type="number" value={form.amount} onChange={(e) => setForm(f => ({...f, amount: e.target.value}))} required /></div>
                </div>
              </>
            )}
            {editing && (
              <div className="space-y-1.5"><Label className="text-xs">Montante UPI</Label><Input type="number" value={form.amount} onChange={(e) => setForm(f => ({...f, amount: e.target.value}))} required /></div>
            )}
            <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Input value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} /></div>
            <div className="flex gap-2">
              {editing && <Button type="button" variant="outline" className="flex-1 text-red-600" onClick={() => { if (confirm('Eliminar transação UPI?')) deleteMutation.mutate(editing); }}>Eliminar</Button>}
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className={editing ? "flex-1 bg-indigo-600 hover:bg-indigo-700" : "w-full bg-indigo-600 hover:bg-indigo-700"}>{editing ? 'Atualizar' : 'Confirmar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}