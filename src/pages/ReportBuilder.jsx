import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileText, BarChart2, TrendingUp, PieChart as PieIcon, Filter, RefreshCw } from 'lucide-react';
import { format, subDays, subMonths, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

const CHART_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f43f5e'];

const METRICS = [
  { id: 'revenue', label: 'Receita total', unit: '€' },
  { id: 'net', label: 'Receita líquida', unit: '€' },
  { id: 'drivers_count', label: 'Motoristas ativos', unit: '' },
  { id: 'payments_count', label: 'Nº de pagamentos', unit: '' },
  { id: 'uber_gross', label: 'Uber bruto', unit: '€' },
  { id: 'bolt_gross', label: 'Bolt bruto', unit: '€' },
];

const PRESET_RANGES = [
  { id: '7d', label: '7 dias', from: () => format(subDays(new Date(), 7), 'yyyy-MM-dd') },
  { id: '30d', label: '30 dias', from: () => format(subDays(new Date(), 30), 'yyyy-MM-dd') },
  { id: '3m', label: '3 meses', from: () => format(subMonths(new Date(), 3), 'yyyy-MM-dd') },
  { id: '6m', label: '6 meses', from: () => format(subMonths(new Date(), 6), 'yyyy-MM-dd') },
  { id: '12m', label: '12 meses', from: () => format(subMonths(new Date(), 12), 'yyyy-MM-dd') },
];

const fmt = v => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const fmtEur = v => `€${fmt(v)}`;

export default function ReportBuilder({ currentUser }) {
  const isAdmin = currentUser?.role?.includes('admin');
  const isFleet = currentUser?.role?.includes('fleet_manager');

  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [selectedFleetManagers, setSelectedFleetManagers] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState(['revenue', 'net']);
  const [chartType, setChartType] = useState('bar');
  const [groupBy, setGroupBy] = useState('month');
  const [activePreset, setActivePreset] = useState('3m');

  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 500) });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: fleetManagers = [] } = useQuery({ queryKey: ['fleet_managers'], queryFn: () => base44.entities.FleetManager.list() });

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setDateFrom(preset.from());
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
  };

  const toggleMetric = (id) => setSelectedMetrics(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  const toggleItem = (list, setList, id) => setList(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  // Filter payments based on selections
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (!p.week_start) return false;
      const d = parseISO(p.week_start);
      const inRange = d >= parseISO(dateFrom) && d <= parseISO(dateTo);
      if (!inRange) return false;
      if (selectedDrivers.length > 0 && !selectedDrivers.includes(p.driver_id)) return false;
      return true;
    });
  }, [payments, dateFrom, dateTo, selectedDrivers]);

  // Build chart data grouped by period
  const chartData = useMemo(() => {
    const groups = {};
    filteredPayments.forEach(p => {
      const date = parseISO(p.week_start);
      let key;
      if (groupBy === 'week') key = format(date, 'dd/MM');
      else if (groupBy === 'month') key = format(date, 'MM/yyyy');
      else key = format(date, 'yyyy');

      if (!groups[key]) groups[key] = { period: key, revenue: 0, net: 0, drivers_count: new Set(), payments_count: 0, uber_gross: 0, bolt_gross: 0 };
      groups[key].revenue += (p.total_gross || 0);
      groups[key].net += (p.net_amount || 0);
      groups[key].drivers_count.add(p.driver_id);
      groups[key].payments_count += 1;
      groups[key].uber_gross += (p.uber_gross || 0);
      groups[key].bolt_gross += (p.bolt_gross || 0);
    });
    return Object.values(groups).map(g => ({ ...g, drivers_count: g.drivers_count.size })).sort((a, b) => a.period.localeCompare(b.period));
  }, [filteredPayments, groupBy]);

  // Summary KPIs
  const kpis = useMemo(() => ({
    totalRevenue: filteredPayments.reduce((s, p) => s + (p.total_gross || 0), 0),
    totalNet: filteredPayments.reduce((s, p) => s + (p.net_amount || 0), 0),
    activeDrivers: new Set(filteredPayments.map(p => p.driver_id)).size,
    paymentCount: filteredPayments.length,
    uberGross: filteredPayments.reduce((s, p) => s + (p.uber_gross || 0), 0),
    boltGross: filteredPayments.reduce((s, p) => s + (p.bolt_gross || 0), 0),
  }), [filteredPayments]);

  // Platform breakdown for pie
  const platformData = [
    { name: 'Uber', value: Math.round(kpis.uberGross) },
    { name: 'Bolt', value: Math.round(kpis.boltGross) },
    { name: 'Outros', value: Math.round(kpis.totalRevenue - kpis.uberGross - kpis.boltGross) },
  ].filter(d => d.value > 0);

  // Export CSV
  const exportCSV = () => {
    const headers = ['Período', ...selectedMetrics.map(m => METRICS.find(x => x.id === m)?.label || m)];
    const rows = chartData.map(d => [d.period, ...selectedMetrics.map(m => d[m] || 0)]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  // Export PDF (simple print)
  const exportPDF = () => window.print();

  const renderChart = () => {
    if (chartData.length === 0) return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sem dados para o período selecionado</div>;
    const metrics = selectedMetrics.map(m => METRICS.find(x => x.id === m)).filter(Boolean);

    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={platformData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {platformData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={v => fmtEur(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, name) => { const m = METRICS.find(x => x.id === name); return [m?.unit === '€' ? fmtEur(v) : v, m?.label || name]; }} />
            <Legend />
            {metrics.map((m, i) => <Line key={m.id} type="monotone" dataKey={m.id} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} name={m.label} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v, name) => { const m = METRICS.find(x => x.id === name); return [m?.unit === '€' ? fmtEur(v) : v, m?.label || name]; }} />
          <Legend />
          {metrics.map((m, i) => <Bar key={m.id} dataKey={m.id} fill={CHART_COLORS[i % CHART_COLORS.length]} name={m.label} radius={[3, 3, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Construtor de Relatórios</h1>
          <p className="text-sm text-gray-500">Crie relatórios personalizados com filtros e visualizações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4" /> CSV</Button>
          <Button variant="outline" onClick={exportPDF} className="gap-2"><FileText className="w-4 h-4" /> PDF</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Filters panel */}
        <div className="lg:col-span-1 space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4" /> Filtros</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Date presets */}
              <div className="space-y-1.5">
                <Label className="text-xs">Período rápido</Label>
                <div className="flex flex-wrap gap-1">
                  {PRESET_RANGES.map(p => (
                    <button key={p.id} onClick={() => applyPreset(p)}
                      className={cn('px-2 py-1 text-xs rounded-md transition-colors', activePreset === p.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }} className="text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset(''); }} className="text-xs" /></div>
              </div>

              {/* Group by */}
              <div className="space-y-1.5">
                <Label className="text-xs">Agrupar por</Label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="month">Mês</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Drivers filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Motoristas ({selectedDrivers.length || 'todos'})</Label>
                <div className="max-h-28 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {drivers.slice(0, 20).map(d => (
                    <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input type="checkbox" checked={selectedDrivers.includes(d.id)} onChange={() => toggleItem(selectedDrivers, setSelectedDrivers, d.id)} className="w-3 h-3 accent-indigo-600" />
                      <span className="truncate">{d.full_name}</span>
                    </label>
                  ))}
                </div>
                {selectedDrivers.length > 0 && <button onClick={() => setSelectedDrivers([])} className="text-xs text-indigo-600 hover:underline">Limpar</button>}
              </div>

              {/* Metrics */}
              <div className="space-y-1.5">
                <Label className="text-xs">Métricas</Label>
                <div className="space-y-1">
                  {METRICS.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={selectedMetrics.includes(m.id)} onChange={() => toggleMetric(m.id)} className="w-3 h-3 accent-indigo-600" />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Chart type */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de gráfico</Label>
                <div className="flex gap-1">
                  {[{ id: 'bar', icon: BarChart2, label: 'Barras' }, { id: 'line', icon: TrendingUp, label: 'Linhas' }, { id: 'pie', icon: PieIcon, label: 'Pizza' }].map(c => (
                    <button key={c.id} onClick={() => setChartType(c.id)}
                      className={cn('flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-colors', chartType === c.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50')}>
                      <c.icon className="w-4 h-4" />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report content */}
        <div className="lg:col-span-3 space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Receita total', value: fmtEur(kpis.totalRevenue), color: 'text-indigo-600' },
              { label: 'Receita líquida', value: fmtEur(kpis.totalNet), color: 'text-green-600' },
              { label: 'Motoristas', value: kpis.activeDrivers, color: 'text-blue-600' },
              { label: 'Pagamentos', value: kpis.paymentCount, color: 'text-gray-700' },
              { label: 'Uber bruto', value: fmtEur(kpis.uberGross), color: 'text-gray-700' },
              { label: 'Bolt bruto', value: fmtEur(kpis.boltGross), color: 'text-gray-700' },
            ].map(k => (
              <Card key={k.label} className="p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </Card>
            ))}
          </div>

          {/* Main chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Evolução por {groupBy === 'week' ? 'semana' : groupBy === 'month' ? 'mês' : 'ano'}</span>
                <Badge variant="outline" className="text-xs">{filteredPayments.length} registos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>{renderChart()}</CardContent>
          </Card>

          {/* Platform breakdown */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por plataforma</CardTitle></CardHeader>
              <CardContent>
                {platformData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={platformData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {platformData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmtEur(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-gray-400 py-8 text-center">Sem dados</p>}
              </CardContent>
            </Card>

            {/* Top drivers table */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top motoristas por receita</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(
                    filteredPayments.reduce((acc, p) => {
                      const name = p.driver_name || p.driver_id;
                      acc[name] = (acc[name] || 0) + (p.total_gross || 0);
                      return acc;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, total], i) => (
                    <div key={name} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-xs flex-1 truncate">{name}</span>
                      <span className="text-xs font-medium text-indigo-700">{fmtEur(total)}</span>
                    </div>
                  ))}
                  {filteredPayments.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sem dados</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Dados detalhados por período</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-gray-500">Período</th>
                      {selectedMetrics.map(m => {
                        const metric = METRICS.find(x => x.id === m);
                        return <th key={m} className="text-right py-2 px-3 text-gray-500">{metric?.label}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map(row => (
                      <tr key={row.period} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium">{row.period}</td>
                        {selectedMetrics.map(m => {
                          const metric = METRICS.find(x => x.id === m);
                          return <td key={m} className="py-2 px-3 text-right">{metric?.unit === '€' ? fmtEur(row[m]) : (row[m] || 0)}</td>;
                        })}
                      </tr>
                    ))}
                    {chartData.length === 0 && <tr><td colSpan={selectedMetrics.length + 1} className="py-6 text-center text-gray-400">Sem dados para os filtros selecionados</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}