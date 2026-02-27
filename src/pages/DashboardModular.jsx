import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, X, GripVertical, Download, FileText, BarChart2, TrendingUp, PieChart as PieIcon, Users, Car, CreditCard, Target, RefreshCw } from 'lucide-react';
import { format, subMonths, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const CHART_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const fmtEur = v => `€${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(v || 0)}`;

const WIDGET_TYPES = [
  { id: 'kpi_revenue', label: 'KPI Receita total', icon: CreditCard, size: 'sm' },
  { id: 'kpi_drivers', label: 'KPI Motoristas ativos', icon: Users, size: 'sm' },
  { id: 'kpi_vehicles', label: 'KPI Veículos atribuídos', icon: Car, size: 'sm' },
  { id: 'kpi_net', label: 'KPI Receita líquida', icon: Target, size: 'sm' },
  { id: 'chart_revenue_bar', label: 'Gráfico Receita (barras)', icon: BarChart2, size: 'lg' },
  { id: 'chart_revenue_line', label: 'Gráfico Receita (linha)', icon: TrendingUp, size: 'lg' },
  { id: 'chart_platform_pie', label: 'Gráfico Plataformas', icon: PieIcon, size: 'md' },
  { id: 'list_top_drivers', label: 'Lista Top Motoristas', icon: Users, size: 'md' },
];

const DEFAULT_LAYOUT = [
  { id: 'w1', type: 'kpi_revenue' },
  { id: 'w2', type: 'kpi_drivers' },
  { id: 'w3', type: 'kpi_vehicles' },
  { id: 'w4', type: 'kpi_net' },
  { id: 'w5', type: 'chart_revenue_bar' },
  { id: 'w6', type: 'chart_platform_pie' },
  { id: 'w7', type: 'list_top_drivers' },
];

function KpiWidget({ label, value, subValue, color = 'indigo', icon: Icon }) {
  return (
    <Card className="h-full">
      <CardContent className="p-5 flex items-center gap-4 h-full">
        <div className={`w-12 h-12 rounded-xl bg-${color}-100 flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
          {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function WidgetRenderer({ type, data }) {
  const { payments = [], drivers = [], vehicles = [] } = data;

  const revenueByMonth = useMemo(() => {
    const groups = {};
    payments.forEach(p => {
      if (!p.week_start) return;
      const key = format(parseISO(p.week_start), 'MM/yy');
      if (!groups[key]) groups[key] = { period: key, revenue: 0, net: 0, uber: 0, bolt: 0 };
      groups[key].revenue += p.total_gross || 0;
      groups[key].net += p.net_amount || 0;
      groups[key].uber += p.uber_gross || 0;
      groups[key].bolt += p.bolt_gross || 0;
    });
    return Object.values(groups).sort((a, b) => a.period.localeCompare(b.period)).slice(-6);
  }, [payments]);

  const totalRevenue = payments.reduce((s, p) => s + (p.total_gross || 0), 0);
  const totalNet = payments.reduce((s, p) => s + (p.net_amount || 0), 0);
  const activeDrivers = drivers.filter(d => d.status === 'active').length;
  const assignedVehicles = vehicles.filter(v => v.status === 'assigned').length;

  const platformData = [
    { name: 'Uber', value: Math.round(payments.reduce((s, p) => s + (p.uber_gross || 0), 0)) },
    { name: 'Bolt', value: Math.round(payments.reduce((s, p) => s + (p.bolt_gross || 0), 0)) },
  ].filter(d => d.value > 0);

  const topDrivers = Object.entries(
    payments.reduce((acc, p) => { acc[p.driver_name || p.driver_id] = (acc[p.driver_name || p.driver_id] || 0) + (p.total_gross || 0); return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  switch (type) {
    case 'kpi_revenue': return <KpiWidget label="Receita total" value={fmtEur(totalRevenue)} color="indigo" icon={CreditCard} />;
    case 'kpi_net': return <KpiWidget label="Receita líquida" value={fmtEur(totalNet)} color="green" icon={Target} />;
    case 'kpi_drivers': return <KpiWidget label="Motoristas ativos" value={activeDrivers} color="blue" icon={Users} />;
    case 'kpi_vehicles': return <KpiWidget label="Veículos atribuídos" value={assignedVehicles} color="purple" icon={Car} />;
    case 'chart_revenue_bar':
      return (
        <Card className="h-full">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Receita mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => fmtEur(v)} />
                <Legend />
                <Bar dataKey="revenue" fill="#6366f1" name="Receita" radius={[3, 3, 0, 0]} />
                <Bar dataKey="net" fill="#10b981" name="Líquido" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    case 'chart_revenue_line':
      return (
        <Card className="h-full">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução da receita</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => fmtEur(v)} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} name="Receita" dot={false} />
                <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} name="Líquido" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    case 'chart_platform_pie':
      return (
        <Card className="h-full">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição plataformas</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={platformData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {platformData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={v => fmtEur(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    case 'list_top_drivers':
      return (
        <Card className="h-full">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top motoristas</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topDrivers.map(([name, total], i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-xs flex-1 truncate">{name}</span>
                  <span className="text-xs font-medium text-indigo-700">{fmtEur(total)}</span>
                </div>
              ))}
              {topDrivers.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sem dados</p>}
            </div>
          </CardContent>
        </Card>
      );
    default: return <Card className="h-full flex items-center justify-center"><p className="text-xs text-gray-400">Widget desconhecido</p></Card>;
  }
}

const SIZE_CLASS = { sm: 'col-span-1', md: 'col-span-1 md:col-span-2', lg: 'col-span-1 md:col-span-2 lg:col-span-3' };

export default function DashboardModular({ currentUser }) {
  const [widgets, setWidgets] = useState(() => {
    const saved = localStorage.getItem(`dashboard_layout_${currentUser?.email}`);
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
  });
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const { data: payments = [] } = useQuery({ queryKey: ['payments_dash'], queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 200) });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers_dash'], queryFn: () => base44.entities.Driver.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles_dash'], queryFn: () => base44.entities.Vehicle.list() });

  const sharedData = { payments, drivers, vehicles };

  const saveLayout = (newWidgets) => {
    setWidgets(newWidgets);
    localStorage.setItem(`dashboard_layout_${currentUser?.email}`, JSON.stringify(newWidgets));
  };

  const onDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const items = Array.from(widgets);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    saveLayout(items);
  }, [widgets]);

  const addWidget = (type) => {
    const newWidget = { id: `w${Date.now()}`, type };
    saveLayout([...widgets, newWidget]);
    setShowWidgetPicker(false);
  };

  const removeWidget = (id) => saveLayout(widgets.filter(w => w.id !== id));

  const exportCSV = () => {
    const headers = ['Período', 'Receita', 'Líquido', 'Uber', 'Bolt'];
    const groups = {};
    payments.forEach(p => {
      if (!p.week_start) return;
      const key = format(parseISO(p.week_start), 'MM/yyyy');
      if (!groups[key]) groups[key] = { period: key, revenue: 0, net: 0, uber: 0, bolt: 0 };
      groups[key].revenue += p.total_gross || 0;
      groups[key].net += p.net_amount || 0;
      groups[key].uber += p.uber_gross || 0;
      groups[key].bolt += p.bolt_gross || 0;
    });
    const rows = Object.values(groups).map(r => [r.period, r.revenue.toFixed(2), r.net.toFixed(2), r.uber.toFixed(2), r.bolt.toFixed(2)]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dashboard_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Modular</h1>
          <p className="text-sm text-gray-500">Personalize o painel arrastando e adicionando widgets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="w-4 h-4" /> CSV</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><FileText className="w-4 h-4" /> PDF</Button>
          <Button variant="outline" onClick={() => setEditMode(!editMode)} className={cn('gap-2', editMode && 'border-indigo-500 text-indigo-600 bg-indigo-50')}>
            <GripVertical className="w-4 h-4" /> {editMode ? 'Concluir' : 'Editar layout'}
          </Button>
          <Button onClick={() => setShowWidgetPicker(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-4 h-4" /> Adicionar widget
          </Button>
        </div>
      </div>

      {editMode && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm text-indigo-700 flex items-center gap-2">
          <GripVertical className="w-4 h-4" />
          Modo de edição ativo — arraste os widgets para reposicionar. Clique no ✕ para remover.
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="dashboard" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr"
            >
              {widgets.map((widget, index) => {
                const wDef = WIDGET_TYPES.find(w => w.id === widget.type);
                return (
                  <Draggable key={widget.id} draggableId={widget.id} index={index} isDragDisabled={!editMode}>
                    {(prov, snap) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={cn(
                          'min-h-[120px] relative',
                          wDef?.size === 'lg' ? 'lg:col-span-2' : wDef?.size === 'md' ? 'md:col-span-1' : '',
                          snap.isDragging && 'opacity-80 shadow-2xl ring-2 ring-indigo-400'
                        )}
                      >
                        {editMode && (
                          <div className="absolute top-2 right-2 z-10 flex gap-1">
                            <div {...prov.dragHandleProps} className="p-1 bg-white rounded shadow cursor-grab">
                              <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                            <button onClick={() => removeWidget(widget.id)} className="p-1 bg-white rounded shadow text-red-400 hover:text-red-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <WidgetRenderer type={widget.type} data={sharedData} />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Widget picker */}
      {showWidgetPicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowWidgetPicker(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Adicionar widget</h3>
              <button onClick={() => setShowWidgetPicker(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WIDGET_TYPES.map(w => (
                <button key={w.id} onClick={() => addWidget(w.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <w.icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{w.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}