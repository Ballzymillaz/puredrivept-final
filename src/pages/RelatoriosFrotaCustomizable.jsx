import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Settings, Plus, Trash2, Eye, EyeOff, Save } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const fmt = (n) => `€${(n || 0).toFixed(2)}`;

const WIDGET_DEFINITIONS = {
  maintenance_costs: {
    title: 'Custos de Manutenção',
    icon: '🔧',
    description: 'Custos de manutenção por veículo'
  },
  driver_utilization: {
    title: 'Utilização de Motoristas',
    icon: '👥',
    description: 'Semanas ativas por motorista'
  },
  gross_vs_net: {
    title: 'Bruto vs Líquido',
    icon: '💰',
    description: 'Comparação rendimento bruto e líquido'
  },
  vehicle_status: {
    title: 'Estado dos Veículos',
    icon: '🚗',
    description: 'Distribuição de estados dos veículos'
  },
  revenue_trend: {
    title: 'Tendência de Receita',
    icon: '📈',
    description: 'Evolução mensal de receita'
  },
  top_drivers: {
    title: 'Top Motoristas',
    icon: '⭐',
    description: 'Motoristas com melhor performance'
  },
  contract_status: {
    title: 'Estado de Contratos',
    icon: '📄',
    description: 'Distribuição por tipo de contrato'
  },
  expenses_breakdown: {
    title: 'Análise de Despesas',
    icon: '💸',
    description: 'Distribuição de despesas'
  }
};

export default function RelatoriosFrotaCustomizable({ currentUser }) {
  const qc = useQueryClient();
  const userEmail = currentUser?.email;
  const userRole = currentUser?.role?.includes('admin') ? 'admin' : 'fleet_manager';

  const [showWidgetManager, setShowWidgetManager] = useState(false);
  const [dashboardName, setDashboardName] = useState('Meu Dashboard');
  const [widgets, setWidgets] = useState(Object.keys(WIDGET_DEFINITIONS).map((key, i) => ({
    id: key,
    type: key,
    title: WIDGET_DEFINITIONS[key].title,
    position: i,
    enabled: true
  })));

  const { data: dashboardConfig } = useQuery({
    queryKey: ['dashboard-config', userEmail],
    queryFn: async () => {
      const configs = await base44.entities.DashboardConfig.filter({
        user_email: userEmail,
        is_default: true
      });
      return configs[0] || null;
    },
    enabled: !!userEmail,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-dash'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-dash'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-dash'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 500),
  });

  const { data: maintenance = [] } = useQuery({
    queryKey: ['maintenance-dash'],
    queryFn: () => base44.entities.MaintenanceRecord.list('-service_date', 100),
  });

  const saveDashboardMutation = useMutation({
    mutationFn: async () => {
      if (dashboardConfig?.id) {
        return base44.entities.DashboardConfig.update(dashboardConfig.id, {
          dashboard_name: dashboardName,
          widgets: widgets,
        });
      } else {
        return base44.entities.DashboardConfig.create({
          user_email: userEmail,
          user_role: userRole,
          dashboard_name: dashboardName,
          widgets: widgets,
          is_default: true,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-config'] });
      alert('Dashboard guardado com sucesso!');
    },
  });

  useEffect(() => {
    if (dashboardConfig) {
      setDashboardName(dashboardConfig.dashboard_name);
      setWidgets(dashboardConfig.widgets || []);
    }
  }, [dashboardConfig]);

  // Widget rendering functions
  const renderMaintenanceCostsWidget = () => {
    const data = vehicles.slice(0, 5).map(v => {
      const vehicleMaintenance = maintenance.filter(m => m.vehicle_id === v.id);
      const totalCost = vehicleMaintenance.reduce((s, m) => s + (m.cost || 0), 0);
      return {
        name: `${v.brand} ${v.model}`.substring(0, 15),
        cost: Math.round(totalCost)
      };
    });

    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={v => `€${v}`} />
          <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderDriverUtilizationWidget = () => {
    const data = drivers.slice(0, 8).map(d => {
      const driverPayments = payments.filter(p => p.driver_id === d.id && p.status === 'paid');
      return {
        name: d.full_name.split(' ')[0],
        weeks: driverPayments.length
      };
    });

    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="weeks" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderGrossVsNetWidget = () => {
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const label = format(d, 'MMM yy');
      const start = startOfMonth(d).toISOString().split('T')[0];
      const end = endOfMonth(d).toISOString().split('T')[0];
      const inMonth = payments.filter(p => p.week_start >= start && p.week_start <= end && p.status === 'paid');
      monthlyData.push({
        label,
        Bruto: Math.round(inMonth.reduce((s, p) => s + (p.total_gross || 0), 0)),
        Líquido: Math.round(inMonth.reduce((s, p) => s + (p.net_amount || 0), 0)),
      });
    }

    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={v => `€${v}`} />
          <Legend />
          <Line type="monotone" dataKey="Bruto" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Líquido" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderVehicleStatusWidget = () => {
    const statusCount = {};
    vehicles.forEach(v => {
      statusCount[v.status] = (statusCount[v.status] || 0) + 1;
    });

    const data = Object.entries(statusCount).map(([status, count]) => ({
      name: status,
      value: count
    }));

    const COLORS = ['#10b981', '#4f46e5', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name} (${value})`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderRevenueTrendWidget = () => {
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const label = format(d, 'MMM yy');
      const start = startOfMonth(d).toISOString().split('T')[0];
      const end = endOfMonth(d).toISOString().split('T')[0];
      const inMonth = payments.filter(p => p.week_start >= start && p.week_start <= end && p.status === 'paid');
      monthlyData.push({
        label,
        Receita: Math.round(inMonth.reduce((s, p) => s + (p.total_gross || 0), 0))
      });
    }

    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={v => `€${v}`} />
          <Line type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderTopDriversWidget = () => {
    const driverStats = drivers.map(d => {
      const driverPayments = payments.filter(p => p.driver_id === d.id && p.status === 'paid');
      const gross = driverPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
      return { name: d.full_name.substring(0, 20), gross };
    }).sort((a, b) => b.gross - a.gross).slice(0, 5);

    return (
      <div className="space-y-2">
        {driverStats.map((d, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="text-sm font-medium text-gray-900">{i + 1}. {d.name}</span>
            <span className="text-sm font-semibold text-green-600">{fmt(d.gross)}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderContractStatusWidget = () => {
    const contractCount = {};
    drivers.forEach(d => {
      const ct = d.contract_type || 'unknown';
      contractCount[ct] = (contractCount[ct] || 0) + 1;
    });

    const data = Object.entries(contractCount).map(([type, count]) => ({
      name: type,
      value: count
    }));

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name} (${value})`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderExpensesBreakdownWidget = () => {
    const maintenanceCosts = maintenance.reduce((s, m) => s + (m.cost || 0), 0);
    const paymentCosts = payments.reduce((s, p) => s + (p.total_deductions || 0), 0);
    
    const data = [
      { name: 'Manutenção', value: Math.round(maintenanceCosts) },
      { name: 'Deduções', value: Math.round(paymentCosts) }
    ];

    const COLORS = ['#ef4444', '#f59e0b'];

    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name} €${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={v => `€${v}`} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const widgetRenderers = {
    maintenance_costs: renderMaintenanceCostsWidget,
    driver_utilization: renderDriverUtilizationWidget,
    gross_vs_net: renderGrossVsNetWidget,
    vehicle_status: renderVehicleStatusWidget,
    revenue_trend: renderRevenueTrendWidget,
    top_drivers: renderTopDriversWidget,
    contract_status: renderContractStatusWidget,
    expenses_breakdown: renderExpensesBreakdownWidget,
  };

  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={dashboardName} subtitle="Dashboard personalizável de métricas" />
        <Button
          onClick={() => setShowWidgetManager(true)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          <Settings className="w-4 h-4" /> Personalizar
        </Button>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {enabledWidgets.map((widget) => (
          <Card key={widget.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{widget.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {widgetRenderers[widget.type]?.()}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Widget Manager Dialog */}
      <Dialog open={showWidgetManager} onOpenChange={setShowWidgetManager}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Widgets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Nome do Dashboard</Label>
              <Input
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                placeholder="Ex: Meu Dashboard Principal"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">Widgets Disponíveis</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {widgets.map((widget, index) => (
                  <div key={widget.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                    <button
                      onClick={() => {
                        const newWidgets = [...widgets];
                        newWidgets[index].enabled = !newWidgets[index].enabled;
                        setWidgets(newWidgets);
                      }}
                      className="flex items-center gap-2 flex-1 text-left text-sm"
                    >
                      {widget.enabled ? (
                        <Eye className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      <span className={widget.enabled ? 'text-gray-900 font-medium' : 'text-gray-500'}>{widget.title}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowWidgetManager(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  saveDashboardMutation.mutate();
                  setShowWidgetManager(false);
                }}
                className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Save className="w-4 h-4" /> Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}