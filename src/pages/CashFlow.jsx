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
import { TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon, Euro } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4'];

export default function CashFlow({ currentUser }) {
  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager') && !isAdmin;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailsDialog, setDetailsDialog] = useState(null);
  const [driverFilter, setDriverFilter] = useState('all');
  const qc = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-all'],
    queryFn: async () => {
      const allPayments = await base44.entities.WeeklyPayment.list('-week_start', 200);
      return allPayments.filter(p => p.status === 'paid');
    },
  });
  const { data: allExpensesRaw = [] } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: () => base44.entities.Expense.list('-date', 200),
  });
  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  // For fleet managers, restrict to their drivers
  const fleetDriverIds = isFleetManager
    ? new Set(allDrivers.filter(d => d.fleet_manager_id === currentUser?.id || d.fleet_manager_id === currentUser?.email).map(d => d.id))
    : null;

  // Fleet managers only see expenses linked to their drivers
  const allExpenses = isFleetManager
    ? allExpensesRaw.filter(e => !e.driver_id || fleetDriverIds?.has(e.driver_id))
    : allExpensesRaw;

  const drivers = isFleetManager
    ? allDrivers.filter(d => fleetDriverIds.has(d.id))
    : allDrivers;

  const expenses = (driverFilter === 'all' 
    ? allExpenses 
    : driverFilter === 'none'
    ? allExpenses.filter(e => !e.driver_id)
    : allExpenses.filter(e => e.driver_id === driverFilter)
  ).filter(e => !e.description.startsWith('Recebido'));

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Expense.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-all'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses-all'] }); setEditing(null); setShowForm(false); },
  });

  const basePayments = isFleetManager
    ? payments.filter(p => fleetDriverIds?.has(p.driver_id))
    : payments;

  const filteredPayments = driverFilter === 'all' 
    ? basePayments 
    : driverFilter === 'none'
    ? basePayments.filter(p => !p.driver_id)
    : basePayments.filter(p => p.driver_id === driverFilter);

  const totalRevenue = filteredPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
  const totalCommissions = filteredPayments.reduce((s, p) => s + (p.commission_amount || 0), 0);
  const totalSlotFees = filteredPayments.reduce((s, p) => s + (p.slot_fee || 0), 0);
  const totalRentals = filteredPayments.reduce((s, p) => s + (p.vehicle_rental || 0), 0);
  const totalViaVerde = filteredPayments.reduce((s, p) => s + (p.via_verde_amount || 0), 0);
  const totalMyPrio = filteredPayments.reduce((s, p) => s + (p.myprio_amount || 0), 0);
  const totalMiio = filteredPayments.reduce((s, p) => s + (p.miio_amount || 0), 0);
  const totalCaucao = filteredPayments.reduce((s, p) => s + (p.irs_retention || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const income = totalCommissions + totalSlotFees + totalRentals + totalViaVerde + totalMyPrio + totalMiio + totalCaucao;
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
    { name: 'Comissões', value: totalCommissions },
    { name: 'Taxas slot', value: totalSlotFees },
    { name: 'Aluguéis', value: totalRentals },
    { name: 'Via Verde', value: totalViaVerde },
    { name: 'MyPrio', value: totalMyPrio },
    { name: 'Miio', value: totalMiio },
    { name: 'Caução', value: totalCaucao },
  ].filter(d => d.value > 0);

  const expenseColumns = [
    { header: 'Descrição', render: (r) => <span className="text-sm">{r.description}</span> },
    { header: 'Montante', render: (r) => fmt(r.amount) },
    { header: 'Data', render: (r) => <span className="text-xs">{r.date}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Fluxo de caixa" actionLabel={isAdmin ? "Adicionar despesa" : undefined} onAction={isAdmin ? () => { setEditing(null); setShowForm(true); } : undefined} />
      
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
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={() => setDetailsDialog('revenue')}>
          <StatCard title="Receita bruta frota" value={fmt(totalRevenue)} icon={TrendingUp} color="blue" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('income')}>
          <StatCard title="Receitas empresa" value={fmt(income)} icon={Wallet} color="green" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('expenses')}>
          <StatCard title="Despesas" value={fmt(totalExpenses)} icon={TrendingDown} color="rose" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('profit')}>
          <StatCard title="Lucro" value={fmt(profit)} icon={PieChartIcon} color={profit >= 0 ? 'green' : 'rose'} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Composição das receitas</CardTitle></CardHeader>
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
              <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">Sem dados</div>
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
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700">Despesas por categoria</CardTitle></CardHeader>
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
              <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">Nenhuma despesa registada</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-sm font-semibold">Despesas recentes</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={expenseColumns} data={expenses.slice(0, 20)} onRowClick={isAdmin ? (r) => { setEditing(r); setShowForm(true); } : undefined} />
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar despesa' : 'Nova despesa'}</DialogTitle></DialogHeader>
          <ExpenseForm 
            expense={editing} 
            onSubmit={(data) => editing ? updateMutation.mutate({ id: editing.id, data }) : createMutation.mutate(data)} 
            onDelete={editing ? () => { 
              if (confirm('Eliminar despesa?')) {
                base44.entities.Expense.delete(editing.id).then(() => {
                  qc.invalidateQueries({ queryKey: ['expenses-all'] });
                  setEditing(null);
                  setShowForm(false);
                });
              }
            } : null}
            isLoading={createMutation.isPending || updateMutation.isPending} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === 'revenue' && 'Detalhes: Receita Bruta Frota'}
              {detailsDialog === 'income' && 'Detalhes: Receitas Empresa'}
              {detailsDialog === 'expenses' && 'Detalhes: Despesas'}
              {detailsDialog === 'profit' && 'Detalhes: Lucro'}
            </DialogTitle>
          </DialogHeader>
          <DetailsDialogContent type={detailsDialog} payments={filteredPayments} expenses={expenses} totalCommissions={totalCommissions} totalSlotFees={totalSlotFees} totalRentals={totalRentals} totalViaVerde={totalViaVerde} totalMyPrio={totalMyPrio} totalMiio={totalMiio} totalCaucao={totalCaucao} fmt={fmt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailsDialogContent({ type, payments, expenses, totalCommissions, totalSlotFees, totalRentals, totalViaVerde, totalMyPrio, totalMiio, totalCaucao, fmt }) {
  if (type === 'revenue') {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-semibold text-gray-700">Total: {fmt(payments.reduce((s, p) => s + (p.total_gross || 0), 0))}</p>
        </div>
        <div className="space-y-2">
          {payments.slice(0, 50).map(p => (
            <div key={p.id} className="flex justify-between text-sm border-b py-2">
              <span>{p.driver_name} - {p.period_label}</span>
              <span className="font-medium">{fmt(p.total_gross)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'income') {
    const totalIncome = totalCommissions + totalSlotFees + totalRentals + totalViaVerde + totalMyPrio + totalMiio + totalCaucao;
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-semibold text-gray-700">Total: {fmt(totalIncome)}</p>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Comissões: {fmt(totalCommissions)}</p>
            {payments.filter(p => p.commission_amount > 0).slice(0, 20).map(p => (
              <div key={`comm-${p.id}`} className="flex justify-between text-sm py-1">
                <span className="text-xs">{p.driver_name}</span>
                <span>{fmt(p.commission_amount)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Taxas slot: {fmt(totalSlotFees)}</p>
            {payments.filter(p => p.slot_fee > 0).slice(0, 20).map(p => (
              <div key={`slot-${p.id}`} className="flex justify-between text-sm py-1">
                <span className="text-xs">{p.driver_name}</span>
                <span>{fmt(p.slot_fee)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Aluguéis: {fmt(totalRentals)}</p>
            {payments.filter(p => p.vehicle_rental > 0).slice(0, 20).map(p => (
              <div key={`rent-${p.id}`} className="flex justify-between text-sm py-1">
                <span className="text-xs">{p.driver_name}</span>
                <span>{fmt(p.vehicle_rental)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Via Verde: {fmt(totalViaVerde)}</p>
            {payments.filter(p => p.via_verde_amount > 0).slice(0, 20).map(p => (
              <div key={`vv-${p.id}`} className="flex justify-between text-sm py-1">
                <span className="text-xs">{p.driver_name}</span>
                <span>{fmt(p.via_verde_amount)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">MyPrio: {fmt(totalMyPrio)}</p>
            {payments.filter(p => p.myprio_amount > 0).slice(0, 20).map(p => (
              <div key={`mp-${p.id}`} className="flex justify-between text-sm py-1">
                <span className="text-xs">{p.driver_name}</span>
                <span>{fmt(p.myprio_amount)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Miio: {fmt(totalMiio)}</p>
            {payments.filter(p => p.miio_amount > 0).slice(0, 20).map(p => (
              <div key={`miio-${p.id}`} className="flex justify-between text-sm py-1">
                <span className="text-xs">{p.driver_name}</span>
                <span>{fmt(p.miio_amount)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Caução: {fmt(totalCaucao)}</p>
            {payments.filter(p => p.irs_retention > 0).slice(0, 20).map(p => (
              <div key={`caucao-${p.id}`} className="flex justify-between text-sm py-1">
                <span className="text-xs">{p.driver_name}</span>
                <span>{fmt(p.irs_retention)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'expenses') {
    const byCategory = {};
    expenses.forEach(e => {
      const cat = e.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(e);
    });

    return (
      <div className="space-y-3">
        <div className="p-3 bg-rose-50 rounded-lg">
          <p className="text-sm font-semibold text-gray-700">Total: {fmt(expenses.reduce((s, e) => s + (e.amount || 0), 0))}</p>
        </div>
        <div className="space-y-2">
          {expenses.slice(0, 50).map(e => (
            <div key={e.id} className="flex justify-between text-sm border-b py-2">
              <span>{e.description}</span>
              <span className="font-medium">{fmt(e.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'profit') {
    const totalIncome = totalCommissions + totalSlotFees + totalRentals + totalViaVerde + totalMyPrio + totalMiio + totalCaucao;
    const totalExpenseAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const profit = totalIncome - totalExpenseAmount;
    
    return (
      <div className="space-y-3">
        <div className={`p-3 rounded-lg ${profit >= 0 ? 'bg-green-50' : 'bg-rose-50'}`}>
          <p className="text-sm font-semibold text-gray-700">Lucro: {fmt(profit)}</p>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Receitas totais: {fmt(totalIncome)}</p>
            <div className="space-y-1 ml-2">
              <div className="flex justify-between text-sm py-1">
                <span className="text-xs">Comissões</span>
                <span>{fmt(totalCommissions)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-xs">Taxas slot</span>
                <span>{fmt(totalSlotFees)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-xs">Aluguéis</span>
                <span>{fmt(totalRentals)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-xs">Via Verde</span>
                <span>{fmt(totalViaVerde)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-xs">MyPrio</span>
                <span>{fmt(totalMyPrio)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-xs">Miio</span>
                <span>{fmt(totalMiio)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-xs">Caução</span>
                <span>{fmt(totalCaucao)}</span>
              </div>
            </div>
          </div>
          
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Despesas totais: {fmt(totalExpenseAmount)}</p>
            <div className="space-y-1 ml-2">
              {Object.entries(expenses.reduce((acc, e) => {
                const cat = e.category || 'other';
                acc[cat] = (acc[cat] || 0) + (e.amount || 0);
                return acc;
              }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cat, amount]) => (
                <div key={cat} className="flex justify-between text-sm py-1">
                  <span className="text-xs capitalize">{cat.replace(/_/g, ' ')}</span>
                  <span>{fmt(amount)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between text-base font-semibold py-2 border-t-2 border-gray-200">
            <span>Lucro líquido:</span>
            <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(profit)}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ExpenseForm({ expense, onSubmit, onDelete, isLoading }) {
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
            <SelectItem value="financiamento">Financiamento</SelectItem>
            <SelectItem value="combustivel">Combustível</SelectItem>
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
      <div className="flex gap-2">
        {onDelete && (
          <Button type="button" variant="outline" onClick={onDelete} className="flex-1 text-red-600 hover:bg-red-50">
            Eliminar
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className={`${onDelete ? 'flex-1' : 'w-full'} bg-indigo-600 hover:bg-indigo-700`}>
          {isLoading ? 'A guardar...' : expense ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}