import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, Euro, ShieldOff } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function IVA({ currentUser }) {
  const [detailsDialog, setDetailsDialog] = useState(null);

  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.role === 'admin';

  // Non-admins: block access
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <ShieldOff className="w-12 h-12 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-500">Acesso restrito</h2>
        <p className="text-sm text-gray-400">Este módulo é reservado exclusivamente a administradores.</p>
        <a href={createPageUrl('Dashboard')} className="text-sm text-indigo-600 hover:underline">← Voltar ao painel</a>
      </div>
    );
  }

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-approved-iva'],
    queryFn: async () => {
      const all = await base44.entities.WeeklyPayment.list('-week_start', 500);
      // Only use approved or paid payments for fiscal calculation
      return all.filter(p => p.status === 'approved' || p.status === 'paid');
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses-validated-iva'],
    queryFn: () => base44.entities.Expense.list('-date', 500),
  });

  // 6% IVA estado → receita bruta frota (from approved payments)
  const total6IVA = payments.reduce((s, p) => s + (p.iva_amount || 0), 0);

  // 23% IVA recuperável → despesas empresa (Via Verde + MyPrio + Miio)
  const total23IVA = payments.reduce((s, p) => {
    return s + ((p.via_verde_amount || 0) + (p.myprio_amount || 0) + (p.miio_amount || 0)) * 0.23;
  }, 0);

  // 23% IVA on company expenses
  const expenseIVA = expenses.reduce((s, e) => s + (e.iva_amount || 0), 0);

  const totalIVA = total6IVA + total23IVA + expenseIVA;

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <PageHeader title="IVA" subtitle={`Baseado em ${payments.length} pagamentos aprovados`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setDetailsDialog('6iva')}>
          <StatCard title="6% IVA Estado" value={fmt(total6IVA)} subtitle="Receita Bruta Frota" icon={TrendingUp} color="blue" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('23iva')}>
          <StatCard title="23% IVA Recuperável" value={fmt(total23IVA + expenseIVA)} subtitle="Despesas empresa" icon={Euro} color="green" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('total')}>
          <StatCard title="IVA Total" value={fmt(totalIVA)} icon={Euro} color="indigo" />
        </div>
      </div>

      {/* Details table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Detalhes IVA por pagamento (aprovados)</h3>
        </div>
        <div className="divide-y">
          {payments.length === 0 ? (
            <p className="text-center py-6 text-gray-400 text-sm">Nenhum pagamento aprovado</p>
          ) : (
            payments.map(p => {
              const iva6 = p.iva_amount || 0;
              const iva23 = ((p.via_verde_amount || 0) + (p.myprio_amount || 0) + (p.miio_amount || 0)) * 0.23;
              const total = iva6 + iva23;
              if (total === 0) return null;
              return (
                <div key={p.id} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{p.driver_name}</p>
                    <p className="text-xs text-gray-500">{p.period_label} — <span className="text-emerald-600 font-medium capitalize">{p.status}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{fmt(total)}</p>
                    <p className="text-xs text-gray-500">6%: {fmt(iva6)} | 23%: {fmt(iva23)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === '6iva' && 'Detalhes: 6% IVA Estado'}
              {detailsDialog === '23iva' && 'Detalhes: 23% IVA Recuperável'}
              {detailsDialog === 'total' && 'Detalhes: IVA Total'}
            </DialogTitle>
          </DialogHeader>
          <IVADetailsContent type={detailsDialog} payments={payments} expenses={expenses} expenseIVA={expenseIVA} fmt={fmt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IVADetailsContent({ type, payments, expenses, expenseIVA, fmt }) {
  if (type === '6iva') {
    const total = payments.reduce((s, p) => s + (p.iva_amount || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 rounded-lg"><p className="text-sm font-semibold">Total: {fmt(total)}</p></div>
        {payments.filter(p => p.iva_amount > 0).map(p => (
          <div key={p.id} className="flex justify-between items-center p-3 border-b">
            <div>
              <p className="font-medium">{p.driver_name}</p>
              <p className="text-sm text-gray-500">{p.period_label}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{fmt(p.iva_amount)}</p>
              <p className="text-sm text-gray-500">Bruto: {fmt(p.total_gross)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === '23iva') {
    const details = payments.map(p => ({
      ...p,
      totalIVA: ((p.via_verde_amount || 0) + (p.myprio_amount || 0) + (p.miio_amount || 0)) * 0.23,
    })).filter(p => p.totalIVA > 0);
    const totalPaymentsIVA = details.reduce((s, p) => s + p.totalIVA, 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(totalPaymentsIVA + expenseIVA)}</p>
          <p className="text-xs text-gray-500 mt-1">Pagamentos: {fmt(totalPaymentsIVA)} | Despesas empresa: {fmt(expenseIVA)}</p>
        </div>
        {details.map(p => (
          <div key={p.id} className="p-3 border-b">
            <div className="flex justify-between items-center mb-1">
              <p className="font-medium">{p.driver_name}</p>
              <p className="font-bold text-green-600">{fmt(p.totalIVA)}</p>
            </div>
            <p className="text-xs text-gray-500">{p.period_label}</p>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'total') {
    const total6 = payments.reduce((s, p) => s + (p.iva_amount || 0), 0);
    const total23 = payments.reduce((s, p) => s + ((p.via_verde_amount || 0) + (p.myprio_amount || 0) + (p.miio_amount || 0)) * 0.23, 0);
    return (
      <div className="space-y-4">
        <div className="p-3 bg-indigo-50 rounded-lg"><p className="text-sm font-semibold">Total IVA: {fmt(total6 + total23 + expenseIVA)}</p></div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-600">6% IVA Estado (Receita Bruta)</span>
            <span className="font-semibold">{fmt(total6)}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-600">23% IVA Recuperável (Via Verde / MyPRIO / Miio)</span>
            <span className="font-semibold">{fmt(total23)}</span>
          </div>
          <div className="flex justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-600">23% IVA em Despesas Empresa</span>
            <span className="font-semibold">{fmt(expenseIVA)}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}