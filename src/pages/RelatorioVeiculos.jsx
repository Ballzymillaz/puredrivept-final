import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Car, Wrench, AlertTriangle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { format, differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

const fmt = (n) => `€${(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-PT') : '—';

const MAINT_LABELS = {
  oil_change: 'Mudança de óleo', tire: 'Pneus', brake: 'Travões',
  inspection: 'Inspeção', repair: 'Reparação', cleaning: 'Limpeza',
  fuel: 'Combustível', other: 'Outro'
};

export default function RelatorioVeiculos() {
  const [filters, setFilters] = useState({ vehicle_id: '', date_from: '', date_to: '' });
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const today = new Date();

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: maintenances = [], isLoading } = useQuery({
    queryKey: ['maintenance-all'],
    queryFn: () => base44.entities.MaintenanceRecord.list('-service_date'),
  });

  const filteredMaint = useMemo(() => {
    return maintenances.filter(m => {
      if (filters.vehicle_id && m.vehicle_id !== filters.vehicle_id) return false;
      if (filters.date_from && m.service_date < filters.date_from) return false;
      if (filters.date_to && m.service_date > filters.date_to) return false;
      return true;
    });
  }, [maintenances, filters]);

  const stats = useMemo(() => {
    const vehicleIds = [...new Set(filteredMaint.map(m => m.vehicle_id))];
    const perVehicle = vehicleIds.map(id => {
      const vehicle = vehicles.find(v => v.id === id);
      const mRecords = filteredMaint.filter(m => m.vehicle_id === id);
      const totalCost = mRecords.reduce((s, m) => s + (m.cost || 0), 0);
      const fuelCost = 0;
      const maintCost = mRecords.filter(m => m.type !== 'fuel').reduce((s, m) => s + (m.cost || 0), 0);
      const lastMaint = mRecords[0];
      const nextMaint = mRecords.find(m => m.next_service_date);
      const daysToNext = nextMaint?.next_service_date ? differenceInDays(new Date(nextMaint.next_service_date), today) : null;
      return { id, vehicle, totalCost, fuelCost, maintCost, count: mRecords.length, lastMaint, nextMaint, daysToNext, mRecords };
    }).sort((a, b) => b.totalCost - a.totalCost);

    const totalCost = filteredMaint.reduce((s, m) => s + (m.cost || 0), 0);
    const totalFuel = filteredMaint.filter(m => m.type === 'fuel').reduce((s, m) => s + (m.cost || 0), 0);
    const alerts = perVehicle.filter(v => v.daysToNext !== null && v.daysToNext <= 30 && v.daysToNext >= 0);

    const chartData = perVehicle.slice(0, 10).map(v => ({
      name: v.vehicle?.license_plate || v.id.slice(-4),
      Manutenção: Math.round(v.maintCost),
      Combustível: Math.round(v.fuelCost),
    }));

    return { perVehicle, totalCost, totalFuel, alerts, chartData };
  }, [filteredMaint, vehicles, today]);

  const exportCSV = () => {
    const rows = [
      ['Veículo', 'Matrícula', 'Nº Registos', 'Custo Total', 'Combustível', 'Manutenção', 'Última Serviço', 'Próximo Serviço'],
      ...stats.perVehicle.map(v => [
        `${v.vehicle?.brand || ''} ${v.vehicle?.model || ''}`,
        v.vehicle?.license_plate || '',
        v.count,
        v.totalCost.toFixed(2),
        v.fuelCost.toFixed(2),
        v.maintCost.toFixed(2),
        v.lastMaint?.service_date || '',
        v.nextMaint?.next_service_date || '',
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `relatorio_veiculos_${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;
    doc.setFontSize(16); doc.setTextColor(67, 56, 202);
    doc.text('Relatório de Desempenho de Veículos', pageW / 2, y, { align: 'center' }); y += 8;
    doc.setFontSize(9); doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW / 2, y, { align: 'center' }); y += 10;
    doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(80, 80, 80);
    ['Veículo', 'Matrícula', 'Registos', 'Combustível', 'Manutenção', 'Total'].forEach((h, i) => {
      doc.text(h, [10, 50, 80, 105, 135, 165][i], y);
    }); y += 4;
    doc.line(10, y, pageW - 10, y); y += 3;
    doc.setFont(undefined, 'normal'); doc.setTextColor(30, 30, 30);
    stats.perVehicle.forEach(v => {
      if (y > 270) { doc.addPage(); y = 20; }
      const label = `${v.vehicle?.brand || ''} ${v.vehicle?.model || ''}`.substring(0, 20);
      doc.text(label, 10, y); doc.text(v.vehicle?.license_plate || '', 50, y);
      doc.text(String(v.count), 82, y); doc.text(fmt(v.fuelCost), 100, y);
      doc.text(fmt(v.maintCost), 130, y); doc.text(fmt(v.totalCost), 160, y); y += 6;
    });
    doc.save(`relatorio_veiculos_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Relatório de Veículos" subtitle="Manutenção, combustível e custos por veículo">
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5"><Download className="w-3.5 h-3.5" /> CSV</Button>
        <Button size="sm" onClick={exportPDF} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"><Download className="w-3.5 h-3.5" /> PDF</Button>
      </PageHeader>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Veículo</Label>
          <Select value={filters.vehicle_id || 'all'} onValueChange={v => setFilter('vehicle_id', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} – {v.license_plate}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} /></div>
      </div>

      {/* Alerts */}
      {stats.alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-600" /><p className="font-medium text-sm text-amber-800">{stats.alerts.length} veículo(s) com manutenção nos próximos 30 dias</p></div>
          <div className="space-y-1">
            {stats.alerts.map(a => (
              <p key={a.id} className="text-xs text-amber-700">
                {a.vehicle?.brand} {a.vehicle?.model} ({a.vehicle?.license_plate}) — {a.daysToNext} dias — {fmtDate(a.nextMaint?.next_service_date)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Custo total</p><p className="text-xl font-bold text-red-600">{fmt(stats.totalCost)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Combustível</p><p className="text-xl font-bold text-orange-500">{fmt(stats.totalFuel)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Manutenção</p><p className="text-xl font-bold text-amber-600">{fmt(stats.totalCost - stats.totalFuel)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Registos</p><p className="text-xl font-bold text-gray-700">{filteredMaint.length}</p></CardContent></Card>
      </div>

      {/* Chart */}
      {stats.chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top 10 — Custos por Veículo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => `€${v}`} />
                <Legend />
                <Bar dataKey="Manutenção" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Combustível" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per vehicle table */}
      {stats.perVehicle.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Detalhe por Veículo</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Veículo</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Matrícula</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Registos</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Combustível</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Manutenção</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Total</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Último serviço</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Próximo</th>
                    <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.perVehicle.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-sm">{v.vehicle?.brand} {v.vehicle?.model}</td>
                      <td className="py-3 px-4 font-mono text-xs">{v.vehicle?.license_plate}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{v.count}</td>
                      <td className="py-3 px-4 text-right text-orange-600">{fmt(v.fuelCost)}</td>
                      <td className="py-3 px-4 text-right text-indigo-600">{fmt(v.maintCost)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-red-600">{fmt(v.totalCost)}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{fmtDate(v.lastMaint?.service_date)}</td>
                      <td className="py-3 px-4 text-xs">
                        {v.daysToNext !== null ? (
                          <span className={v.daysToNext <= 7 ? 'text-red-600 font-medium' : v.daysToNext <= 30 ? 'text-amber-600' : 'text-gray-500'}>
                            {fmtDate(v.nextMaint?.next_service_date)} ({v.daysToNext}d)
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link to={createPageUrl(`VehicleDetail?id=${v.id}`)} className="text-xs text-indigo-600 hover:underline">Ver</Link>
                      </td>
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