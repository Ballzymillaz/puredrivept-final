import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatCard from '../components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4'];

export default function CashFlow() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-all'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 200),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: () => base44.entities.Expense.list('-date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Expense.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-all'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-all'] }); setEditing(null); setShowForm(false); },
  });

  const totalRevenue = payments.reduce((s, p) => s + (p.total_gross || 0), 0);
  const totalCommissions = payments.reduce((s, p) => s + (p.commission_amount || 0), 0);
  const totalSlotFees = payments.reduce((s, p) => s + (p.slot_fee || 0), 0);
  const totalRentals = payments.reduce((s, p) => s + (p.vehicle_rental || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const income = totalCommissions + totalSlotFees + totalRentals;
  const profit = income - totalExpenses;

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  // Expenses by category
  const expensesByCategory = {};
  expenses.forEach(e => {
    const cat = e.category || 'other';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (e.amount || 0);
  });
  const categoryData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value
  })).sort((a, b) => b.value - a.value);

  // Income breakdown
  const incomeData = [
    { name: 'Commissions', value: totalCommissions },
    { name: 'Frais de slot', value: totalSlotFees },
    { name: 'Locations', value: totalRentals },
  ].filter(d => d.value > 0);

  const expenseColumns = [
    { header: 'Categoria', render: (r) => <span className="text-sm">{r.category}</span> },
    { header: 'Descrição', render: (r) => <span className="text-sm">{r.description}</span> },
    { header: 'Montante', render: (r) => fmt(r.amount) },
    { header: 'Data', render: (r) => <span className="text-xs">{r.date}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Fluxo de caixa" actionLabel="Adicionar despesa" onAction={() => { setEditing(null); setShowForm(true); }} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenu brut flotte" value={fmt(totalRevenue)} icon={TrendingUp} color="blue" />
        <StatCard title="Recettes entreprise" value={fmt(income)} icon={Wallet} color="green" />
        <StatCard title="Dépenses" value={fmt(totalExpenses)} icon={TrendingDown} color="rose" />
        <StatCard title="Bénéfice" value={fmt(profit)} icon={PieChartIcon} color={profit >= 0 ? 'green' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Composition des recettes</CardTitle></CardHeader>
          <CardContent>
            {incomeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={incomeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {incomeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">Aucune donnée</div>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              {incomeData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  {d.name}: {fmt(d.value)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Dépenses par catégorie</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `€${v}`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">Aucune dépense enregistrée</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold">Despesas recentes</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={expenseColumns} data={expenses.slice(0, 10)} onRowClick={(r) => { setEditing(r); setShowForm(true); }} />
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar despesa' : 'Nova despesa'}</DialogTitle></DialogHeader>
          <ExpenseForm expense={editing} onSubmit={(data) => editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data)} isLoading={createMutation.isPending || updateMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseForm({ expense, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    category: expense?.category || 'other',
    description: expense?.description || '',
    amount: expense?.amount || '',
    date: expense?.date || new Date().toISOString().split('T')[0],
    notes: expense?.notes || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, amount: parseFloat(form.amount) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Categoria</Label>
        <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="vehicle_rental">Aluguer veículo</SelectItem>
            <SelectItem value="utilities">Utilidades</SelectItem>
            <SelectItem value="services">Serviços</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="driver_payments">Pagamentos motoristas</SelectItem>
            <SelectItem value="vehicle_costs">Custos veículos</SelectItem>
            <SelectItem value="insurance">Seguros</SelectItem>
            <SelectItem value="taxes">Impostos</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
            <SelectItem value="via_verde">Via Verde</SelectItem>
            <SelectItem value="loans">Empréstimos</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Descrição</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Montante (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">Data</Label><Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} required /></div>
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
      <Button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700">{isLoading ? 'A guardar...' : expense ? 'Atualizar' : 'Criar'}</Button>
    </form>
  );
}