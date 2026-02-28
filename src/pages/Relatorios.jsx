import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, TrendingUp, TrendingDown, Users, Wallet, BarChart2, Trophy } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';

const CONTRACT_LABELS = { slot_standard: 'Slot Standard', slot_premium: 'Slot Premium', slot_black: 'Slot Black', location: 'Aluguer' };
const fmt = (n) => `€${(n || 0).toFixed(2)}`;

function GrowthBadge({ current, previous }) {
  if (!previous) return null;
  const pct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      {pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function Relatorios({ currentUser }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isAdmin = currentUser?.role === 'admin' || currentUser?.hasRole?.('admin');
  const isFleetManager = currentUser?.role === 'fleet_manager' || currentUser?.hasRole?.('fleet_manager');
  const isDriver = currentUser?.role === 'driver' || currentUser?.hasRole?.('driver');

  const { data: allDrivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.list() });
  const { data: fleetManagers = [] } = useQuery({ queryKey: ['fleet-managers'], queryFn: () => base44.entities.FleetManager.list() });
  const { data: payments = [], isLoading } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 1000) });
  const { data: loans = [] } = useQuery({ queryKey: ['loans'], queryFn: () => base44.entities.Loan.list(), enabled: isAdmin });

  // Role-based data scoping
  const myDriverRecord = useMemo(() => isDriver ? allDrivers.find(d => d.email === currentUser?.email) : null, [allDrivers, currentUser, isDriver]);
  const myFleetManager = useMemo(() => isFleetManager ? fleetManagers.find(fm => fm.email === currentUser?.email || fm.user_id === currentUser?.id) : null, [fleetManagers, currentUser, isFleetManager]);
  const myDriverIds = useMemo(() => {
    if (!isFleetManager || !myFleetManager) return [];
    return allDrivers.filter(d => d.fleet_manager_id === myFleetManager.id).map(d => d.id);
  }, [allDrivers, myFleetManager, isFleetManager]);

  const scopedPayments = useMemo(() => {
    let p = payments.filter(pay => pay.status === 'paid' || pay.status === 'approved');
    if (isDriver && myDriverRecord) p = p.filter(pay => pay.driver_id === myDriverRecord.id);
    if (isFleetManager) p = p.filter(pay => myDriverIds.includes(pay.driver_id));
    if (dateFrom) p = p.filter(pay => pay.week_start >= dateFrom);
    if (dateTo) p = p.filter(pay => pay.week_end <= dateTo);
    return p;
  }, [payments, isDriver, isFleetManager, myDriverRecord, myDriverIds, dateFrom, dateTo]);

  const scopedDrivers = useMemo(() => {
    if (isAdmin) return allDrivers;
    if (isFleetManager) return allDrivers.filter(d => myDriverIds.includes(d.id));
    if (isDriver && myDriverRecord) return [myDriverRecord];
    return [];
  }, [allDrivers, isAdmin, isFleetManager, isDriver, myDriverRecord, myDriverIds]);

  // Monthly data (12 months)
  const monthlyData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), 11 - i);
    const start = startOfMonth(d).toISOString().split('T')[0];
    const end = endOfMonth(d).toISOString().split('T')[0];
    const inMonth = scopedPayments.filter(p => p.week_start >= start && p.week_start <= end);
    return {
      label: format(d, 'MMM yy'),
      Bruto: Math.round(inMonth.reduce((s, p) => s + (p.total_gross || 0), 0)),
      Deduções: Math.round(inMonth.reduce((s, p) => s + (p.total_deductions || 0), 0)),
    };
  }), [scopedPayments]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalGross = scopedPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    const totalDeductions = scopedPayments.reduce((s, p) => s + (p.total_deductions || 0), 0);
    const totalCommissions = scopedPayments.reduce((s, p) => s + (p.commission_amount || 0), 0);
    const totalRankBonus = scopedPayments.reduce((s, p) => s + (p.goal_bonus || 0), 0);
    const totalUPI = scopedPayments.reduce((s, p) => s + (p.upi_earned || 0), 0);
    const avgGross = scopedPayments.length > 0 ? totalGross / scopedPayments.length : 0;
    const activeLoans = isAdmin ? loans.filter(l => l.status === 'active') : [];
    const totalActiveLoans = activeLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
    const margin = totalGross > 0 ? ((totalDeductions / totalGross) * 100) : 0;

    // Per driver
    const driverMap = {};
    scopedPayments.forEach(p => {
      if (!driverMap[p.driver_id]) driverMap[p.driver_id] = { id: p.driver_id, name: p.driver_name, gross: 0, deductions: 0, upi: 0, rankBonus: 0, count: 0 };
      driverMap[p.driver_id].gross += (p.total_gross || 0);
      driverMap[p.driver_id].deductions += (p.total_deductions || 0);
      driverMap[p.driver_id].upi += (p.upi_earned || 0);
      driverMap[p.driver_id].rankBonus += (p.goal_bonus || 0);
      driverMap[p.driver_id].count += 1;
    });
    const perDriver = Object.values(driverMap).sort((a, b) => b.gross - a.gross);

    // Contract distribution
    const byContract = {};
    scopedDrivers.forEach(d => { const ct = d.contract_type || 'unknown'; byContract[ct] = (byContract[ct] || 0) + 1; });

    // Current vs previous month
    const now = new Date();
    const currMonthStart = startOfMonth(now).toISOString().split('T')[0];
    const currMonthEnd = endOfMonth(now).toISOString().split('T')[0];
    const prevMonthDate = subMonths(now, 1);
    const prevMonthStart = startOfMonth(prevMonthDate).toISOString().split('T')[0];
    const prevMonthEnd = endOfMonth(prevMonthDate).toISOString().split('T')[0];
    const currMonth = scopedPayments.filter(p => p.week_start >= currMonthStart && p.week_start <= currMonthEnd);
    const prevMonth = scopedPayments.filter(p => p.week_start >= prevMonthStart && p.week_start <= prevMonthEnd);
    const currMonthGross = currMonth.reduce((s, p) => s + (p.total_gross || 0), 0);
    const prevMonthGross = prevMonth.reduce((s, p) => s + (p.total_gross || 0), 0);

    // Quarterly
    const currQStart = startOfQuarter(now).toISOString().split('T')[0];
    const currQEnd = endOfQuarter(now).toISOString().split('T')[0];
    const prevQStart = startOfQuarter(subQuarters(now, 1)).toISOString().split('T')[0];
    const prevQEnd = endOfQuarter(subQuarters(now, 1)).toISOString().split('T')[0];
    const currQ = scopedPayments.filter(p => p.week_start >= currQStart && p.week_start <= currQEnd);
    const prevQ = scopedPayments.filter(p => p.week_start >= prevQStart && p.week_start <= prevQEnd);
    const currQGross = currQ.reduce((s, p) => s + (p.total_gross || 0), 0);
    const prevQGross = prevQ.reduce((s, p) => s + (p.total_gross || 0), 0);

    return { totalGross, totalDeductions, totalCommissions, totalRankBonus, totalUPI, avgGross, totalActiveLoans, margin, perDriver, byContract, currMonthGross, prevMonthGross, currQGross, prevQGross };
  }, [scopedPayments, scopedDrivers, loans, isAdmin]);

  const exportCSV = () => {
    const rows = [
      ['Motorista', 'Período', 'Bruto', 'Deduções', 'Comissão', 'UPI'],
      ...scopedPayments.map(p => [p.driver_name, p.period_label, p.total_gross?.toFixed(2), p.total_deductions?.toFixed(2), p.commission_amount?.toFixed(2), p.upi_earned?.toFixed(2)])
    ];
    const csv = rows.map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `relatorio_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Relatórios" subtitle="Centro analítico">
        {(isAdmin || isFleetManager) && (
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        )}
      </PageHeader>

      {/* Date filters */}
      <div className="bg-white rounded-xl border p-4 grid grid-cols-2 gap-4 max-w-sm">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="finance">Finanças</TabsTrigger>
          <TabsTrigger value="comparativo">Análise Comparativa</TabsTrigger>
        </TabsList>

        {/* ========== PERFORMANCE ========== */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="pt-5">
              <p className="text-xs text-gray-500 mb-1">Total Bruto</p>
              <p className="text-2xl font-bold text-indigo-700">{fmt(stats.totalGross)}</p>
              <p className="text-xs text-gray-400 mt-1">{scopedPayments.length} pagamentos</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-gray-500 mb-1">Média Bruto / semana</p>
              <p className="text-2xl font-bold text-gray-800">{fmt(stats.avgGross)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-gray-500 mb-1">Motoristas ativos</p>
              <p className="text-2xl font-bold text-emerald-600">{scopedDrivers.filter(d => d.status === 'active').length}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs text-gray-500 mb-1">UPI gerados</p>
              <p className="text-2xl font-bold text-violet-600">{stats.totalUPI.toFixed(1)}</p>
            </CardContent></Card>
          </div>

          {/* Top performers */}
          {stats.perDriver.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Top Performers</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.perDriver.slice(0, 10).map((d, i) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-400 w-5">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-xs text-gray-400">{d.count} semanas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-indigo-700">{fmt(d.gross)}</p>
                        <p className="text-xs text-gray-400">{fmt(d.deductions)} deduções</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contract distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribuição por Contrato</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(stats.byContract).map(([ct, count]) => (
                  <div key={ct} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{CONTRACT_LABELS[ct] || ct}</span>
                    <Badge className="bg-indigo-100 text-indigo-700 border-0">{count}</Badge>
                  </div>
                ))}
                {Object.keys(stats.byContract).length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sem dados</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução Bruto (12 meses)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={v => `€${v}`} />
                    <Line type="monotone" dataKey="Bruto" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========== FINANCE ========== */}
        <TabsContent value="finance" className="space-y-4">
          {isAdmin && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Total Bruto Global</p>
                <p className="text-2xl font-bold text-indigo-700">{fmt(stats.totalGross)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Total Deduções</p>
                <p className="text-2xl font-bold text-red-500">{fmt(stats.totalDeductions)}</p>
                <p className="text-xs text-gray-400">{stats.totalGross > 0 ? ((stats.totalDeductions / stats.totalGross) * 100).toFixed(1) : 0}% do bruto</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Total Comissões Fleet</p>
                <p className="text-2xl font-bold text-amber-600">{fmt(stats.totalCommissions)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Total Bónus Ranking</p>
                <p className="text-2xl font-bold text-emerald-600">{fmt(stats.totalRankBonus)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Empréstimos Ativos</p>
                <p className="text-2xl font-bold text-orange-600">{fmt(stats.totalActiveLoans)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Margem (% deduções/bruto)</p>
                <p className="text-2xl font-bold text-gray-800">{stats.margin.toFixed(1)}%</p>
              </CardContent></Card>
            </div>
          )}

          {isFleetManager && (
            <div className="grid grid-cols-2 gap-4">
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Bruto gerado pelos meus motoristas</p>
                <p className="text-2xl font-bold text-indigo-700">{fmt(stats.totalGross)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Comissões recebidas</p>
                <p className="text-2xl font-bold text-amber-600">{fmt(stats.totalCommissions)}</p>
              </CardContent></Card>
            </div>
          )}

          {isDriver && (
            <div className="grid grid-cols-2 gap-4">
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Total Bruto</p>
                <p className="text-2xl font-bold text-indigo-700">{fmt(stats.totalGross)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Total Deduções</p>
                <p className="text-2xl font-bold text-red-500">{fmt(stats.totalDeductions)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">Bónus Ranking</p>
                <p className="text-2xl font-bold text-emerald-600">{fmt(stats.totalRankBonus)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-5">
                <p className="text-xs text-gray-500 mb-1">UPI gerados</p>
                <p className="text-2xl font-bold text-violet-600">{stats.totalUPI.toFixed(1)}</p>
              </CardContent></Card>
            </div>
          )}

          {/* Bruto vs Deduções chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Bruto vs Deduções (12 meses)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => `€${v}`} />
                  <Legend />
                  <Bar dataKey="Bruto" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Deduções" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== COMPARATIVO ========== */}
        <TabsContent value="comparativo" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Mês atual vs Mês anterior</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500">Mês atual</p>
                    <p className="text-xl font-bold text-indigo-700">{fmt(stats.currMonthGross)}</p>
                  </div>
                  <GrowthBadge current={stats.currMonthGross} previous={stats.prevMonthGross} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500">Mês anterior</p>
                    <p className="text-xl font-bold text-gray-600">{fmt(stats.prevMonthGross)}</p>
                  </div>
                </div>
                <div className="text-center p-2">
                  <p className="text-xs text-gray-500">Diferença</p>
                  <p className={`text-lg font-bold ${stats.currMonthGross >= stats.prevMonthGross ? 'text-emerald-600' : 'text-red-500'}`}>
                    {stats.currMonthGross >= stats.prevMonthGross ? '+' : ''}{fmt(stats.currMonthGross - stats.prevMonthGross)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Trimestre atual vs Trimestre anterior</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500">Trimestre atual</p>
                    <p className="text-xl font-bold text-indigo-700">{fmt(stats.currQGross)}</p>
                  </div>
                  <GrowthBadge current={stats.currQGross} previous={stats.prevQGross} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500">Trimestre anterior</p>
                    <p className="text-xl font-bold text-gray-600">{fmt(stats.prevQGross)}</p>
                  </div>
                </div>
                <div className="text-center p-2">
                  <p className="text-xs text-gray-500">Diferença</p>
                  <p className={`text-lg font-bold ${stats.currQGross >= stats.prevQGross ? 'text-emerald-600' : 'text-red-500'}`}>
                    {stats.currQGross >= stats.prevQGross ? '+' : ''}{fmt(stats.currQGross - stats.prevQGross)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 12-month evolution */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução 12 meses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => `€${v}`} />
                  <Legend />
                  <Line type="monotone" dataKey="Bruto" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Deduções" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}