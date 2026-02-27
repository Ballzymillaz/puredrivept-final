import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Users, Car, Wallet, BarChart2, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const fmt = (n) => `€${(n || 0).toFixed(2)}`;

const CONTRACT_LABELS = {
  slot_standard: 'Slot Standard',
  slot_premium: 'Slot Premium',
  slot_black: 'Slot Black',
  location: 'Aluguer',
};

export default function RelatoriosFrota() {
  const [filters, setFilters] = useState({ fleet_manager_id: '', driver_id: '', date_from: '', date_to: '', vehicle_type: '' });
  const [selectedDriverChart, setSelectedDriverChart] = useState('');
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const handleExportCSV = () => {
    const headers = ['Motorista', 'Contrato', 'Semanas', 'Bruto Total', 'Líquido Total', 'Média/Semana', 'Uber', 'Bolt'];
    const rows = stats.perDriver.map(d => [
      d.name, CONTRACT_LABELS[d.contract_type] || '—', d.weeks,
      d.gross.toFixed(2), d.net.toFixed(2), d.avgWeekly.toFixed(2), d.uber.toFixed(2), d.bolt.toFixed(2)
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_frota_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleExportPDF = async () => {
    const jsPDF = (await import('jspdf')).jsPDF;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Relatório de Frota', 10, 10);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-PT')}`, 10, 20);
    doc.text(`Motoristas ativos: ${stats.activeDrivers} | Total Bruto: €${stats.totalGross.toFixed(2)}`, 10, 28);
    
    const tableHeaders = ['Motorista', 'Contrato', 'Sem.', 'Bruto', 'Líquido', 'Média', 'Uber', 'Bolt'];
    const tableRows = stats.perDriver.map(d => [
      d.name, CONTRACT_LABELS[d.contract_type] || '—', d.weeks,
      d.gross.toFixed(0), d.net.toFixed(0), d.avgWeekly.toFixed(0), d.uber.toFixed(0), d.bolt.toFixed(0)
    ]);
    
    doc.autoTable({
      head: [tableHeaders],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });
    
    doc.save(`relatorio_frota_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleetManagers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['payments-all'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 500),
  });

  const filteredDrivers = useMemo(() => {
    let d = drivers;
    if (filters.fleet_manager_id) d = d.filter(dr => dr.fleet_manager_id === filters.fleet_manager_id);
    if (filters.driver_id) d = d.filter(dr => dr.id === filters.driver_id);
    if (filters.vehicle_type) {
      const vehiclesOfType = vehicles.filter(v => v.brand === filters.vehicle_type);
      const vehicleIds = vehiclesOfType.map(v => v.id);
      d = d.filter(dr => vehicleIds.includes(dr.assigned_vehicle_id));
    }
    return d;
  }, [drivers, filters.fleet_manager_id, filters.driver_id, filters.vehicle_type, vehicles]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (p.status !== 'paid') return false;
      if (filters.fleet_manager_id) {
        const driver = drivers.find(d => d.id === p.driver_id);
        if (!driver || driver.fleet_manager_id !== filters.fleet_manager_id) return false;
      }
      if (filters.driver_id && p.driver_id !== filters.driver_id) return false;
      if (filters.date_from && p.week_start < filters.date_from) return false;
      if (filters.date_to && p.week_end > filters.date_to) return false;
      return true;
    });
  }, [payments, drivers, filters]);

  const stats = useMemo(() => {
    const totalGross = filteredPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    const totalNet = filteredPayments.reduce((s, p) => s + (p.net_amount || 0), 0);
    const totalDeductions = filteredPayments.reduce((s, p) => s + (p.total_deductions || 0), 0);
    const activeDrivers = filteredDrivers.filter(d => d.status === 'active').length;
    const totalWeeks = filteredPayments.length;
    const avgGrossPerDriver = activeDrivers > 0 && totalWeeks > 0 ? totalGross / activeDrivers : 0;

    // Per driver stats
    const driverIds = [...new Set(filteredPayments.map(p => p.driver_id))];
    const perDriver = driverIds.map(id => {
      const driver = drivers.find(d => d.id === id);
      const dPayments = filteredPayments.filter(p => p.driver_id === id);
      const gross = dPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
      const net = dPayments.reduce((s, p) => s + (p.net_amount || 0), 0);
      const uber = dPayments.reduce((s, p) => s + (p.uber_gross || 0), 0);
      const bolt = dPayments.reduce((s, p) => s + (p.bolt_gross || 0), 0);
      return {
        id, name: dPayments[0]?.driver_name || '—',
        contract_type: driver?.contract_type,
        status: driver?.status,
        weeks: dPayments.length, gross, net, uber, bolt,
        avgWeekly: dPayments.length > 0 ? gross / dPayments.length : 0,
      };
    }).sort((a, b) => b.gross - a.gross);

    // Chart data — top 10 by gross
    const chartData = perDriver.slice(0, 10).map(d => ({
      name: d.name.split(' ')[0],
      Bruto: Math.round(d.gross),
      Líquido: Math.round(d.net),
    }));

    // Monthly evolution for selected driver (or all)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const label = format(d, 'MMM yy');
      const start = startOfMonth(d).toISOString().split('T')[0];
      const end = endOfMonth(d).toISOString().split('T')[0];
      const inMonth = filteredPayments.filter(p => p.week_start >= start && p.week_start <= end);
      monthlyData.push({
        label,
        Bruto: Math.round(inMonth.reduce((s, p) => s + (p.total_gross || 0), 0)),
        Líquido: Math.round(inMonth.reduce((s, p) => s + (p.net_amount || 0), 0)),
      });
    }

    // Contract breakdown
    const byContract = {};
    filteredDrivers.forEach(d => {
      const ct = d.contract_type || 'unknown';
      byContract[ct] = (byContract[ct] || 0) + 1;
    });

    return { totalGross, totalNet, totalDeductions, activeDrivers, avgGrossPerDriver, perDriver, chartData, byContract, totalWeeks, monthlyData };
  }, [filteredPayments, filteredDrivers, drivers]);

  return (
    <div className="space-y-5">
      <PageHeader title="Relatório de Frota" subtitle="Performance e rendimentos dos motoristas por gestor" />

      {/* Filters */}
       <div className="bg-white rounded-xl border p-4 space-y-3">
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
           <div className="space-y-1">
             <Label className="text-xs">Gestor de frota</Label>
             <Select value={filters.fleet_manager_id || 'all'} onValueChange={v => { setFilter('fleet_manager_id', v === 'all' ? '' : v); setFilter('driver_id', ''); }}>
               <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todos os gestores</SelectItem>
                 {fleetManagers.map(fm => <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>)}
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-1">
             <Label className="text-xs">Motorista</Label>
             <Select value={filters.driver_id || 'all'} onValueChange={v => setFilter('driver_id', v === 'all' ? '' : v)}>
               <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todos os motoristas</SelectItem>
                 {(filters.fleet_manager_id ? drivers.filter(d => d.fleet_manager_id === filters.fleet_manager_id) : drivers).map(d => (
                   <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-1">
             <Label className="text-xs">Marca do veículo</Label>
             <Select value={filters.vehicle_type || 'all'} onValueChange={v => setFilter('vehicle_type', v === 'all' ? '' : v)}>
               <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todas as marcas</SelectItem>
                 {[...new Set(vehicles.map(v => v.brand))].sort().map(brand => (
                   <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-1">
             <Label className="text-xs">Data início</Label>
             <Input type="date" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
           </div>
           <div className="space-y-1">
             <Label className="text-xs">Data fim</Label>
             <Input type="date" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
           </div>
         </div>
         <div className="flex gap-2 justify-end pt-2 border-t">
           <Button onClick={handleExportCSV} size="sm" variant="outline" className="gap-2">
             <Download className="w-3.5 h-3.5" /> CSV
           </Button>
           <Button onClick={handleExportPDF} size="sm" variant="outline" className="gap-2">
             <Download className="w-3.5 h-3.5" /> PDF
           </Button>
         </div>
       </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Motoristas ativos</p>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold">{stats.activeDrivers}</p>
          <p className="text-xs text-gray-400 mt-1">{filteredDrivers.length} total</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Rendimento total bruto</p>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-600">{fmt(stats.totalGross)}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.totalWeeks} pagamentos pagos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Total líquido motoristas</p>
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{fmt(stats.totalNet)}</p>
          <p className="text-xs text-gray-400 mt-1">Após deduções</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">Média bruto / motorista</p>
            <BarChart2 className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-600">{fmt(stats.avgGrossPerDriver)}</p>
          <p className="text-xs text-gray-400 mt-1">Total período</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly evolution chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Evolução Mensal — Bruto vs Líquido (6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => `€${v}`} />
                <Legend />
                <Line type="monotone" dataKey="Bruto" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Líquido" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Contract breakdown */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Motoristas por contrato</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.byContract).map(([ct, count]) => (
              <div key={ct} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{CONTRACT_LABELS[ct] || ct}</span>
                <Badge className="bg-indigo-100 text-indigo-700 border-0">{count}</Badge>
              </div>
            ))}
            {Object.keys(stats.byContract).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum motorista</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per driver bar chart */}
      {stats.chartData.length > 0 && !filters.driver_id && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 Motoristas — Bruto vs Líquido</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => `€${v}`} />
                <Legend />
                <Bar dataKey="Bruto" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Líquido" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per driver table */}
      {stats.perDriver.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Performance por Motorista</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Motorista</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Contrato</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Semanas</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Bruto Total</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Líquido Total</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Média / Semana</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Uber</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Bolt</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.perDriver.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{d.name}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{CONTRACT_LABELS[d.contract_type] || '—'}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{d.weeks}</td>
                      <td className="py-3 px-4 text-right font-medium">{fmt(d.gross)}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-semibold">{fmt(d.net)}</td>
                      <td className="py-3 px-4 text-right text-indigo-600">{fmt(d.avgWeekly)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{fmt(d.uber)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{fmt(d.bolt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}