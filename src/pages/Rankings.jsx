import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Rankings() {
  const [period, setPeriod] = useState('weekly');
  const [view, setView] = useState('drivers');

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-ranking'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 500),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  // Aggregate by driver
  const driverRanking = {};
  payments.forEach(p => {
    if (!driverRanking[p.driver_id]) {
      driverRanking[p.driver_id] = { name: p.driver_name, total: 0, count: 0 };
    }
    driverRanking[p.driver_id].total += (p.total_gross || 0);
    driverRanking[p.driver_id].count += 1;
  });

  const sortedDrivers = Object.entries(driverRanking)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total - a.total);

  // Aggregate by commercial/manager
  const referrerRanking = {};
  drivers.forEach(d => {
    const refId = d.commercial_id || d.fleet_manager_id;
    const refName = d.commercial_name || d.fleet_manager_name;
    if (refId && refName) {
      if (!referrerRanking[refId]) {
        referrerRanking[refId] = { name: refName, drivers: 0, totalRevenue: 0 };
      }
      referrerRanking[refId].drivers += 1;
      const driverPayments = payments.filter(p => p.driver_id === d.id);
      referrerRanking[refId].totalRevenue += driverPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    }
  });

  const sortedReferrers = Object.entries(referrerRanking)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const rankIcons = [
    <Trophy className="w-5 h-5 text-amber-500" />,
    <Medal className="w-5 h-5 text-gray-400" />,
    <Award className="w-5 h-5 text-amber-700" />,
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Classement" subtitle="Rentabilité par chauffeur et commercial">
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="drivers">Chauffeurs</TabsTrigger>
            <TabsTrigger value="referrers">Commerciaux</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {view === 'drivers' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Top chauffeurs par chiffre d'affaires</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedDrivers.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Aucune donnée de paiement</p>
            ) : (
              <div className="space-y-2">
                {sortedDrivers.slice(0, 20).map((d, i) => (
                  <div key={d.id} className={cn(
                    "flex items-center justify-between p-3 rounded-lg transition-colors",
                    i < 3 ? "bg-indigo-50" : "bg-gray-50 hover:bg-gray-100"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center">
                        {i < 3 ? rankIcons[i] : <span className="text-sm font-medium text-gray-400">#{i + 1}</span>}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{d.name}</p>
                        <p className="text-xs text-gray-500">{d.count} paiements</p>
                      </div>
                    </div>
                    <span className="font-bold text-indigo-700">{fmt(d.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === 'referrers' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Top commerciaux/gestionnaires</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedReferrers.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Aucune donnée</p>
            ) : (
              <div className="space-y-2">
                {sortedReferrers.slice(0, 20).map((r, i) => (
                  <div key={r.id} className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    i < 3 ? "bg-indigo-50" : "bg-gray-50 hover:bg-gray-100"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center">
                        {i < 3 ? rankIcons[i] : <span className="text-sm font-medium text-gray-400">#{i + 1}</span>}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.drivers} chauffeurs affiliés</p>
                      </div>
                    </div>
                    <span className="font-bold text-indigo-700">{fmt(r.totalRevenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}