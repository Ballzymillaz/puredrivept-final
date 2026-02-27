import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DataTable from '../components/shared/DataTable';

export default function CashFlow() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const qc = useQueryClient();

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => base44.entities.Ledger.list('-date', 200),
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.Cities.list(),
  });

  const filtered = typeFilter === 'all' ? ledger : ledger.filter(l => l.type === typeFilter);

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Ledger.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ledger.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ledger'] }); setEditing(null); setShowForm(false); },
  });

  // Group by type
  const byType = {};
  filtered.forEach(l => {
    const t = l.type || 'other';
    byType[t] = (byType[t] || 0) + (l.amount || 0);
  });

  const chartData = Object.entries(byType).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').toUpperCase(),
    value: Math.abs(value)
  })).slice(0, 6);

  const totalIncome = filtered.filter(l => ['rent', 'upi', 'income', 'buyback'].includes(l.type)).reduce((s, l) => s + (l.amount || 0), 0);
  const totalExpense = filtered.filter(l => ['loan', 'insurance', 'maintenance', 'expense', 'payout'].includes(l.type)).reduce((s, l) => s + Math.abs(l.amount || 0), 0);
  const netCashFlow = totalIncome - totalExpense;

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const columns = [
    { header: 'Data', render: (r) => <span className="text-xs">{r.date}</span> },
    { header: 'Tipo', render: (r) => <span className="text-sm font-medium">{r.type?.replace(/_/g, ' ')}</span> },
    { header: 'Descrição', render: (r) => <span className="text-sm">{r.description}</span> },
    { header: 'Montante', render: (r) => <span className={`font-medium ${r.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.amount)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Fluxo de Caixa" actionLabel="Adicionar movimento" onAction={() => { setEditing(null); setShowForm(true); }} />
      
      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por tipo..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="rent">Aluguer</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="loan">Empréstimo</SelectItem>
            <SelectItem value="insurance">Seguro</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
            <SelectItem value="payout">Pagamento</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Receitas" value={fmt(totalIncome)} icon={TrendingUp} color="green" />
        <StatCard title="Despesas" value={fmt(totalExpense)} icon={TrendingDown} color="rose" />
        <StatCard title="Saldo Líquido" value={fmt(netCashFlow)} icon={Wallet} color={netCashFlow >= 0 ? 'green' : 'rose'} />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Movimentos por Tipo</CardTitle></CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">Sem dados</div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold">Movimentos Recentes</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filtered.slice(0, 50)} onRowClick={(r) => { setEditing(r); setShowForm(true); }} />
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar movimento' : 'Novo movimento'}</DialogTitle></DialogHeader>
          <LedgerForm 
            entry={editing} 
            cities={cities}
            onSubmit={(data) => editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data)} 
            onDelete={editing ? () => { 
              if (confirm('Eliminar movimento?')) {
                base44.entities.Ledger.delete(editing.id).then(() => {
                  qc.invalidateQueries({ queryKey: ['ledger'] });
                  setEditing(null);
                  setShowForm(false);
                });
              }
            } : null}
            isLoading={createMutation.isPending || updateMutation.isPending} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LedgerForm({ entry, cities, onSubmit, onDelete, isLoading }) {
  const [form, setForm] = React.useState({
    date: entry?.date || new Date().toISOString().split('T')[0],
    city_id: entry?.city_id || '',
    type: entry?.type || 'other',
    amount: entry?.amount || '',
    description: entry?.description || '',
    notes: entry?.notes || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, amount: parseFloat(form.amount) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Data</Label>
        <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} required />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Cidade</Label>
        <Select value={form.city_id} onValueChange={(v) => setForm(f => ({ ...f, city_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Escolher cidade..." /></SelectTrigger>
          <SelectContent>
            {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tipo</Label>
        <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rent">Aluguer</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="loan">Empréstimo</SelectItem>
            <SelectItem value="insurance">Seguro</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
            <SelectItem value="payout">Pagamento</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descrição</Label>
        <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} required />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Montante (€)</Label>
        <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} required />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notas</Label>
        <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
      </div>

      <div className="flex gap-2">
        {onDelete && (
          <Button type="button" variant="outline" onClick={onDelete} className="flex-1 text-red-600 hover:bg-red-50">
            Eliminar
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className={`${onDelete ? 'flex-1' : 'w-full'} bg-indigo-600 hover:bg-indigo-700`}>
          {isLoading ? 'A guardar...' : entry ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}