import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import StatCard from '../components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HandCoins, Users, Gift } from 'lucide-react';

const REFERRAL_RATES = {
  slot_standard: 5,
  slot_premium: 5,
  slot_black: 10,
  location: 15,
};

const CONTRACT_LABELS = {
  slot_standard: 'Slot Standard',
  slot_premium: 'Slot Premium',
  slot_black: 'Slot Black',
  location: 'Location',
};

export default function Referrals() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['referral-payments'],
    queryFn: () => base44.entities.ReferralPayment.list('-created_date', 200),
  });

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.weekly_amount || 0) + (p.bonus_amount || 0), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.weekly_amount || 0), 0);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const columns = [
    { header: 'Parrain', render: (r) => (<div><p className="font-medium text-sm">{r.referrer_name}</p><p className="text-xs text-gray-500 capitalize">{r.referrer_type?.replace('_', ' ')}</p></div>) },
    { header: 'Chauffeur', render: (r) => <span className="text-sm">{r.driver_name}</span> },
    { header: 'Contrat', render: (r) => <span className="text-sm">{CONTRACT_LABELS[r.driver_contract_type] || '—'}</span> },
    { header: 'Hebdo', render: (r) => <span className="font-medium text-indigo-600">{fmt(r.weekly_amount)}</span> },
    { header: 'Bonus', render: (r) => r.bonus_amount > 0 ? <span className="font-medium text-emerald-600">{fmt(r.bonus_amount)}</span> : '—' },
    { header: 'Statut', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Parrainage" subtitle="Paiements aux commerciaux et gestionnaires" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total payé" value={fmt(totalPaid)} icon={HandCoins} color="green" />
        <StatCard title="En attente" value={fmt(totalPending)} icon={HandCoins} color="amber" />
        <StatCard title="Parrainages actifs" value={payments.length} icon={Users} color="indigo" />
      </div>

      <Card className="border-0 shadow-sm p-4">
        <CardHeader className="p-0 pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Barème des commissions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(REFERRAL_RATES).map(([type, rate]) => (
              <div key={type} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{CONTRACT_LABELS[type]}</p>
                <p className="text-xl font-bold text-indigo-600">€{rate}</p>
                <p className="text-[10px] text-gray-400">par semaine</p>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-emerald-800"><strong>Bonus location :</strong> 60€ après 30 jours continus de location</p>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={payments} isLoading={isLoading} />
    </div>
  );
}