import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter, parseISO } from 'date-fns';

export default function Rankings() {
  const [period, setPeriod] = useState('week');
  const [view, setView] = useState('drivers');

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-ranking'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 500),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const getStartDate = () => {
    const now = new Date();
    switch(period) {
      case 'week': return startOfWeek(now, { weekStartsOn: 1 });
      case 'month': return startOfMonth(now);
      case 'quarter': return startOfQuarter(now);
      case 'year': return startOfYear(now);
      default: return startOfWeek(now, { weekStartsOn: 1 });
    }
  };

  const filteredPayments = useMemo(() => {
    const startDate = getStartDate();
    return payments.filter(p => {
      if (!p.week_start) return false;
      const paymentDate = parseISO(p.week_start);
      return isAfter(paymentDate, startDate) || paymentDate.getTime() === startDate.getTime();
    });
  }, [payments, period]);

  // Aggregate by driver
  const driverRanking = {};
  filteredPayments.forEach(p => {
    if (!driverRanking[p.driver_id]) {
      driverRanking[p.driver_id] = { name: p.driver_name, total: 0, count: 0 };
    }
    driverRanking[p.driver_id].total += (p.total_gross || 0);
    driverRanking[p.driver_id].count += 1;
  });

  const sortedDrivers = Object.entries(driverRanking)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

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
      const driverPayments = filteredPayments.filter(p => p.driver_id === d.id);
      referrerRanking[refId].totalRevenue += driverPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    }
  });

  const sortedReferrers = Object.entries(referrerRanking)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const rankIcons = [
    <Trophy className="w-5 h-5 text-amber-500" />,
    <Medal className="w-5 h-5 text-gray-400" />,
    <Award className="w-5 h-5 text-amber-700" />,
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Classificação" subtitle="Top 10 por período">
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana atual</SelectItem>
              <SelectItem value="month">Mês atual</SelectItem>
              <SelectItem value="quarter">Trimestre atual</SelectItem>
              <SelectItem value="year">Ano atual</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="drivers">Motoristas</TabsTrigger>
              <TabsTrigger value="referrers">Comerciais/Gestores</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </PageHeader>

      {view === 'drivers' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Top 10 Motoristas - {period === 'week' ? 'Semana' : period === 'month' ? 'Mês' : period === 'quarter' ? 'Trimestre' : 'Ano'} atual</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedDrivers.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Nenhum dado de pagamento</p>
            ) : (
              <div className="space-y-2">
                {sortedDrivers.map((d, i) => (
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
            <CardTitle className="text-sm font-semibold text-gray-700">Top 10 Comerciais/Gestores - {period === 'week' ? 'Semana' : period === 'month' ? 'Mês' : period === 'quarter' ? 'Trimestre' : 'Ano'} atual</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedReferrers.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Nenhum dado</p>
            ) : (
              <div className="space-y-2">
                {sortedReferrers.map((r, i) => (
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
                        <p className="text-xs text-gray-500">{r.drivers} motoristas afiliados</p>
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