import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Gift, Clock, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, format, parseISO, isWithinInterval, subMonths, differenceInDays } from 'date-fns';

const RANK_BONUSES = { 1: 50, 2: 25, 3: 10 };
const RANK_ICONS = [
  <Trophy className="w-5 h-5 text-amber-500" />,
  <Medal className="w-5 h-5 text-gray-400" />,
  <Award className="w-5 h-5 text-amber-700" />,
];
const RANK_LABELS = ['1º', '2º', '3º'];

export default function Rankings({ currentUser }) {
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month
  const qc = useQueryClient();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.hasRole?.('admin');
  const isFleetManager = currentUser?.role === 'fleet_manager' || currentUser?.hasRole?.('fleet_manager');
  const isDriver = currentUser?.role === 'driver' || currentUser?.hasRole?.('driver');

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-ranking'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 1000),
  });
  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  // Find my records
  const myDriverRecord = useMemo(() => isDriver ? allDrivers.find(d => d.email === currentUser?.email) : null, [allDrivers, currentUser, isDriver]);
  const myFleetManager = useMemo(() => isFleetManager ? fleetManagers.find(fm => fm.email === currentUser?.email || fm.user_id === currentUser?.id) : null, [fleetManagers, currentUser, isFleetManager]);
  const myDriverIds = useMemo(() => {
    if (!isFleetManager || !myFleetManager) return [];
    return allDrivers.filter(d => d.fleet_manager_id === myFleetManager.id).map(d => d.id);
  }, [allDrivers, myFleetManager, isFleetManager]);

  // Month options (last 6 months)
  const monthOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), i);
      return { label: format(d, 'MMMM yyyy'), value: i, date: d };
    });
  }, []);

  const selectedMonthDate = monthOptions[selectedMonth]?.date || new Date();
  const monthStart = startOfMonth(selectedMonthDate);
  const monthEnd = endOfMonth(selectedMonthDate);

  // Filter payments for selected month
  const monthPayments = useMemo(() => payments.filter(p => {
    if (!p.week_start) return false;
    try { return isWithinInterval(parseISO(p.week_start), { start: monthStart, end: monthEnd }); } catch { return false; }
  }), [payments, monthStart, monthEnd]);

  // Aggregate by driver for this month
  const driverTotals = useMemo(() => {
    const map = {};
    monthPayments.forEach(p => {
      if (!map[p.driver_id]) {
        const driver = allDrivers.find(d => d.id === p.driver_id);
        map[p.driver_id] = { id: p.driver_id, name: p.driver_name, total: 0, start_date: driver?.start_date };
      }
      map[p.driver_id].total += (p.total_gross || 0);
    });
    return Object.values(map);
  }, [monthPayments, allDrivers]);

  // Sort: by total desc, tie-break by seniority (start_date asc)
  const globalRanking = useMemo(() => {
    return [...driverTotals].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (a.start_date && b.start_date) return parseISO(a.start_date) - parseISO(b.start_date);
      return 0;
    });
  }, [driverTotals]);

  // Filtered ranking per role
  const visibleRanking = useMemo(() => {
    if (isAdmin) return globalRanking;
    if (isFleetManager) return globalRanking.filter(d => myDriverIds.includes(d.id));
    if (isDriver && myDriverRecord) return globalRanking; // drivers see full ranking for context
    return globalRanking;
  }, [globalRanking, isAdmin, isFleetManager, isDriver, myDriverIds, myDriverRecord]);

  // My position in global ranking
  const myGlobalPosition = useMemo(() => {
    if (!myDriverRecord) return null;
    const idx = globalRanking.findIndex(d => d.id === myDriverRecord.id);
    return idx >= 0 ? idx + 1 : null;
  }, [globalRanking, myDriverRecord]);

  const myData = useMemo(() => globalRanking.find(d => d.id === myDriverRecord?.id), [globalRanking, myDriverRecord]);
  const leader = globalRanking[0];

  // Top3 badge: winner from previous month
  const prevMonthDate = subMonths(new Date(), 1);
  const prevMonthStart = startOfMonth(prevMonthDate);
  const prevMonthEnd = endOfMonth(prevMonthDate);
  const prevMonthPayments = useMemo(() => payments.filter(p => {
    if (!p.week_start) return false;
    try { return isWithinInterval(parseISO(p.week_start), { start: prevMonthStart, end: prevMonthEnd }); } catch { return false; }
  }), [payments]);
  const prevMonthTotals = useMemo(() => {
    const map = {};
    prevMonthPayments.forEach(p => {
      if (!map[p.driver_id]) map[p.driver_id] = { id: p.driver_id, name: p.driver_name, total: 0 };
      map[p.driver_id].total += (p.total_gross || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [prevMonthPayments]);

  // Who has top3 badge (prev month top3, still valid 30 days)
  const top3BadgeHolders = useMemo(() => prevMonthTotals.slice(0, 3).map((d, i) => ({ ...d, rank: i + 1 })), [prevMonthTotals]);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
  const isCurrentMonth = selectedMonth === 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Classificação" subtitle="Bónus mensual — baseado no Total Bruto">
        <div className="flex gap-2">
          {monthOptions.map((m, i) => (
            <button key={i} onClick={() => setSelectedMonth(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedMonth === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Next bonus in play */}
      {isCurrentMonth && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Gift className="w-5 h-5 text-amber-600" />
              <p className="font-semibold text-amber-900">Próximo bónus em jogo — {format(new Date(), 'MMMM yyyy')}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(rank => (
                <div key={rank} className="text-center bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex justify-center mb-1">{RANK_ICONS[rank - 1]}</div>
                  <p className="text-xs text-gray-500">{RANK_LABELS[rank - 1]} lugar</p>
                  <p className="text-xl font-bold text-indigo-700">+€{RANK_BONUSES[rank]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver: personal summary */}
      {isDriver && myDriverRecord && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">A minha posição</p>
              <p className="text-3xl font-bold text-indigo-700">#{myGlobalPosition || '—'}</p>
              <p className="text-sm text-gray-600">{myData ? fmt(myData.total) : '€0'} total bruto</p>
            </CardContent>
          </Card>
          {leader && myDriverRecord.id !== leader.id && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">Diferença para o 1º</p>
                <p className="text-3xl font-bold text-red-500">{fmt(Math.max(0, (leader.total || 0) - (myData?.total || 0)))}</p>
                <p className="text-sm text-gray-600">vs {leader.name}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Top 3 badge holders from last month */}
      {top3BadgeHolders.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Badge Top 3 — {format(prevMonthDate, 'MMMM yyyy')}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-3">
              {top3BadgeHolders.map(d => (
                <div key={d.id} className={cn(
                  "flex-1 text-center p-3 rounded-xl",
                  d.rank === 1 ? "bg-amber-50 border border-amber-200" : d.rank === 2 ? "bg-gray-50 border border-gray-200" : "bg-orange-50 border border-orange-200"
                )}>
                  <div className="flex justify-center mb-1">{RANK_ICONS[d.rank - 1]}</div>
                  <p className="text-xs font-medium text-gray-700 truncate">{d.name}</p>
                  <p className="text-xs text-gray-500">{fmt(d.total)}</p>
                  <Badge className={`mt-1 text-[10px] ${d.rank === 1 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                    Badge 30 dias
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main ranking */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Classificação — {format(selectedMonthDate, 'MMMM yyyy')}
            {isFleetManager && <span className="text-xs font-normal text-gray-400 ml-2">(os seus motoristas)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visibleRanking.length === 0 ? (
            <p className="text-center py-8 text-gray-400">Nenhum dado de pagamento para este período</p>
          ) : (
            <div className="space-y-2">
              {visibleRanking.map((d, i) => {
                // Position in global ranking
                const globalPos = globalRanking.findIndex(g => g.id === d.id) + 1;
                const isMe = myDriverRecord?.id === d.id;
                const bonus = RANK_BONUSES[globalPos];
                return (
                  <div key={d.id} className={cn(
                    "flex items-center justify-between p-3 rounded-xl transition-colors",
                    isMe ? "bg-indigo-100 ring-1 ring-indigo-300" : globalPos <= 3 ? "bg-indigo-50" : "bg-gray-50"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center">
                        {globalPos <= 3 ? RANK_ICONS[globalPos - 1] : <span className="text-sm font-medium text-gray-400">#{globalPos}</span>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900">{d.name}</p>
                          {isMe && <Badge className="bg-indigo-600 text-white text-[10px]">Eu</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-700">{fmt(d.total)}</p>
                      {bonus && <p className="text-xs text-emerald-600 font-medium">+€{bonus} bónus</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Winners history */}
      {isAdmin && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Clock className="w-4 h-4" /> Histórico de ganhadores</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monthOptions.slice(1).map((m, idx) => {
                const mStart = startOfMonth(m.date);
                const mEnd = endOfMonth(m.date);
                const mPayments = payments.filter(p => {
                  if (!p.week_start) return false;
                  try { return isWithinInterval(parseISO(p.week_start), { start: mStart, end: mEnd }); } catch { return false; }
                });
                const mMap = {};
                mPayments.forEach(p => {
                  if (!mMap[p.driver_id]) mMap[p.driver_id] = { name: p.driver_name, total: 0 };
                  mMap[p.driver_id].total += (p.total_gross || 0);
                });
                const mRanking = Object.entries(mMap).sort((a, b) => b[1].total - a[1].total).slice(0, 3);
                if (mRanking.length === 0) return null;
                return (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs font-semibold text-gray-600 mb-2">{m.label}</p>
                    <div className="flex gap-2">
                      {mRanking.map(([id, data], ri) => (
                        <div key={id} className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1 shadow-sm">
                          {RANK_ICONS[ri]}
                          <span className="text-xs font-medium text-gray-700">{data.name.split(' ')[0]}</span>
                          <span className="text-xs text-indigo-600">{fmt(data.total)}</span>
                          <span className="text-[10px] text-emerald-600">+€{RANK_BONUSES[ri + 1]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}