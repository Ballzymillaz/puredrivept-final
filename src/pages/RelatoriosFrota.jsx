import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Users, Wallet, Coins, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const fmt = (n) => `€${(n || 0).toFixed(2)}`;
const CONTRACT_LABELS = { slot_standard: 'Slot Standard', slot_premium: 'Slot Premium', slot_black: 'Slot Black', location: 'Aluguer' };

export default function RelatoriosFrota({ currentUser }) {
  const [fleetManagerFilter, setFleetManagerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isAdmin = currentUser?.role === 'admin' || currentUser?.hasRole?.('admin');
  const isFleetManager = !isAdmin && (currentUser?.role === 'fleet_manager' || currentUser?.hasRole?.('fleet_manager'));

  const { data: allDrivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.list() });
  const { data: fleetManagers = [] } = useQuery({ queryKey: ['fleet-managers'], queryFn: () => base44.entities.FleetManager.list() });
  const { data: payments = [] } = useQuery({ queryKey: ['payments-all'], queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 1000) });

  const myFleetManager = useMemo(() => isFleetManager ? fleetManagers.find(fm => fm.email === currentUser?.email || fm.user_id === currentUser?.id) : null, [fleetManagers, currentUser, isFleetManager]);

  // Scoped drivers
  const scopedDrivers = useMemo(() => {
    if (isFleetManager && myFleetManager) return allDrivers.filter(d => d.fleet_manager_id === myFleetManager.id);
    if (isAdmin && fleetManagerFilter) return allDrivers.filter(d => d.fleet_manager_id === fleetManagerFilter);
    return allDrivers;
  }, [allDrivers, isAdmin, isFleetManager, myFleetManager, fleetManagerFilter]);

  const scopedDriverIds = useMemo(() => scopedDrivers.map(d => d.id), [scopedDrivers]);

  const scopedPayments = useMemo(() => payments.filter(p => {
    if (!scopedDriverIds.includes(p.driver_id)) return false;
    if (p.status !== 'paid' && p.status !== 'approved') return false;
    if (dateFrom && p.week_start < dateFrom) return false;
    if (dateTo && p.week_end > dateTo) return false;
    return true;
  }), [payments, scopedDriverIds, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalGross = scopedPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    const totalDeductions = scopedPayments.reduce((s, p) => s + (p.total_deductions || 0), 0);
    const totalUPI = scopedPayments.reduce((s, p) => s + (p.upi_earned || 0), 0);
    const margin = totalGross - totalDeductions;
    const activeDrivers = scopedDrivers.filter(d => d.status === 'active').length;

    const driverMap = {};
    scopedPayments.forEach(p => {
      if (!driverMap[p.driver_id]) driverMap[p.driver_id] = { id: p.driver_id, name: p.driver_name, gross: 0, deductions: 0, upi: 0, count: 0 };
      driverMap[p.driver_id].gross += (p.total_gross || 0);
      driverMap[p.driver_id].deductions += (p.total_deductions || 0);
      driverMap[p.driver_id].upi += (p.upi_earned || 0);
      driverMap[p.driver_id].count += 1;
    });
    const perDriver = Object.values(driverMap).sort((a, b) => b.gross - a.gross).map(d => {
      const driver = allDrivers.find(dr => dr.id === d.id);
      return { ...d, status: driver?.status || 'unknown', contract_type: driver?.contract_type };
    });

    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(new Date(), 5 - i);
      const start = startOfMonth(month).toISOString().split('T')[0];
      const end = endOfMonth(month).toISOString().split('T')[0];
      const inMonth = scopedPayments.filter(p => p.week_start >= start && p.week_start <= end);
      return {
        label: format(month, 'MMM yy'),
        Bruto: Math.round(inMonth.reduce((s, p) => s + (p.total_gross || 0), 0)),
        Deduções: Math.round(inMonth.reduce((s, p) => s + (p.total_deductions || 0), 0)),
      };
    });

    return { totalGross, totalDeductions, totalUPI, margin, activeDrivers, perDriver, monthlyData };
  }, [scopedPayments, scopedDrivers, allDrivers]);

  const exportCSV = () => {
    const rows = [
      ['Motorista', 'Receita Bruta', 'Deduções', 'UPI', 'Status'],
      ...stats.perDriver.map(d => [d.name, d.gross.toFixed(2), d.deductions.toFixed(2), d.upi.toFixed(2), d.status])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `relatorio_frota_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const statusColor = (s) => s === 'active' ? 'text-emerald-600' : s === 'suspended' ? 'text-red-500' : 'text-amber-500';
  const statusLabel = (s) => s === 'active' ? 'Ativo' : s === 'suspended' ? 'Suspenso' : 'Atenção';

  return (
    <div className="space-y-5">
      <PageHeader title="Relatório de Frota" subtitle="Pilotagem e performance da frota">
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isAdmin && (
          <div className="space-y-1">
            <Label className="text-xs">Gestor de frota</Label>
            <Select value={fleetManagerFilter || 'all'} onValueChange={v => setFleetManagerFilter(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os gestores</SelectItem>
                {fleetManagers.map(fm => <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
      </div>

      {/* BLOC 1: KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Motoristas ativos</p><Users className="w-4 h-4 text-indigo-400" /></div>
          <p className="text-2xl font-bold">{stats.activeDrivers}</p>
          <p className="text-xs text-gray-400">{scopedDrivers.length} total</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Receita Bruta Total</p><TrendingUp className="w-4 h-4 text-green-400" /></div>
          <p className="text-2xl font-bold text-green-600">{fmt(stats.totalGross)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Total Deduções</p></div>
          <p className="text-2xl font-bold text-red-500">{fmt(stats.totalDeductions)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">Margem empresa</p><Wallet className="w-4 h-4 text-indigo-400" /></div>
          <p className="text-2xl font-bold text-indigo-700">{fmt(stats.margin)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1"><p className="text-xs text-gray-500">UPI gerados</p><Coins className="w-4 h-4 text-violet-400" /></div>
          <p className="text-2xl font-bold text-violet-600">{stats.totalUPI.toFixed(1)}</p>
        </CardContent></Card>
      </div>

      {/* BLOC 2: Driver performance table */}
      {stats.perDriver.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Performance por Motorista</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Motorista</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Receita Bruta</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Deduções</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">UPI gerados</th>
                    <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.perDriver.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{d.name}</td>
                      <td className="py-3 px-4 text-right font-medium text-indigo-700">{fmt(d.gross)}</td>
                      <td className="py-3 px-4 text-right text-red-500">{fmt(d.deductions)}</td>
                      <td className="py-3 px-4 text-right text-violet-600">{d.upi.toFixed(1)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-medium ${statusColor(d.status)}`}>{statusLabel(d.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOC 3: Monthly evolution */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução Mensal (6 meses)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => `€${v}`} />
              <Legend />
              <Line type="monotone" dataKey="Bruto" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Deduções" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}