import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import StatCard from '../components/dashboard/StatCard';
import { CreditCard, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

export default function Payments() {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 100),
  });

  const filtered = statusFilter === 'all' ? payments : payments.filter(p => p.status === statusFilter);
  const totalGross = filtered.reduce((s, p) => s + (p.total_gross || 0), 0);
  const totalNet = filtered.reduce((s, p) => s + (p.net_amount || 0), 0);
  const totalDeductions = filtered.reduce((s, p) => s + (p.total_deductions || 0), 0);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const columns = [
    { header: 'Chauffeur', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Période', render: (r) => <span className="text-sm">{r.period_label || `${r.week_start}`}</span> },
    { header: 'Brut', render: (r) => <span className="text-sm font-medium text-gray-900">{fmt(r.total_gross)}</span> },
    { header: 'Déductions', render: (r) => <span className="text-sm text-red-600">{fmt(r.total_deductions)}</span> },
    { header: 'Net', render: (r) => <span className="text-sm font-bold text-indigo-700">{fmt(r.net_amount)}</span> },
    { header: 'UPI', render: (r) => <span className="text-sm text-violet-600">{r.upi_earned || 0}</span> },
    { header: 'Statut', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Paiements hebdomadaires" subtitle={`${payments.length} paiements`}>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="approved">Approuvé</SelectItem>
            <SelectItem value="paid">Payé</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total brut" value={fmt(totalGross)} icon={TrendingUp} color="green" />
        <StatCard title="Déductions" value={fmt(totalDeductions)} icon={TrendingDown} color="rose" />
        <StatCard title="Net à payer" value={fmt(totalNet)} icon={Wallet} color="indigo" />
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelected} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Détail paiement — {selected?.driver_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Uber', fmt(selected.uber_gross)],
                  ['Bolt', fmt(selected.bolt_gross)],
                  ['Autres', fmt(selected.other_platform_gross)],
                  ['Commission', fmt(selected.commission_amount)],
                  ['Slot', fmt(selected.slot_fee)],
                  ['Location véhicule', fmt(selected.vehicle_rental)],
                  ['Via Verde', fmt(selected.via_verde_amount)],
                  ['MyPRIO', fmt(selected.myprio_amount)],
                  ['Miio', fmt(selected.miio_amount)],
                  ['Prêt', fmt(selected.loan_installment)],
                  ['Achat véhicule', fmt(selected.vehicle_purchase_installment)],
                  ['Remboursements', fmt(selected.reimbursement_credit)],
                  ['Bonus objectif', fmt(selected.goal_bonus)],
                  ['IVA', fmt(selected.iva_amount)],
                  ['IRS', fmt(selected.irs_retention)],
                  ['UPI gagnés', selected.upi_earned],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between p-3 bg-indigo-50 rounded-lg text-indigo-900 font-bold">
                <span>Net à payer</span>
                <span>{fmt(selected.net_amount)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}