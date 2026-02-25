import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatCard from '../components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4'];

export default function CashFlow() {
  const { data: payments = [] } = useQuery({
    queryKey: ['payments-all'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 200),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: () => base44.entities.Expense.list('-date', 200),
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

  return (
    <div className="space-y-6">
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
    </div>
  );
}