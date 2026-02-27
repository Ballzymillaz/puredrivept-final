import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, Users, Zap, AlertCircle, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, differenceInDays } from 'date-fns';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdvancedReports({ currentUser }) {
  const [reportType, setReportType] = useState('drivers');
  const [dateRange, setDateRange] = useState('month');
  const [selectedDriver, setSelectedDriver] = useState('all');

  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager');

  if (!isAdmin && !isFleetManager) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
        <p className="text-gray-600">Acesso restrito a administradores e gestores de frota</p>
      </div>
    );
  }

  // Fetch data
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-reports'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-reports', dateRange],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start'),
  });

  const { data: onboardings = [] } = useQuery({
    queryKey: ['onboardings-reports'],
    queryFn: () => base44.entities.DriverOnboarding.list(),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents-reports'],
    queryFn: () => base44.entities.Document.list(),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-reports'],
    queryFn: () => base44.entities.Contract.list(),
  });

  // === DRIVER PERFORMANCE REPORT ===
  const getDriverPerformanceData = () => {
    return drivers.map(driver => {
      const driverPayments = payments.filter(p => p.driver_id === driver.id);
      const totalGross = driverPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
      const totalNet = driverPayments.reduce((s, p) => s + (p.net_amount || 0), 0);
      const weeksWorked = driverPayments.length;
      const avgWeekly = weeksWorked > 0 ? totalNet / weeksWorked : 0;

      return {
        driver_name: driver.full_name,
        total_gross: Math.round(totalGross),
        total_net: Math.round(totalNet),
        weeks_worked: weeksWorked,
        avg_weekly: Math.round(avgWeekly),
        status: driver.status,
      };
    }).sort((a, b) => b.total_net - a.total_net);
  };

  // === ONBOARDING STATE REPORT ===
  const getOnboardingStateData = () => {
    const states = {
      completed: 0,
      in_progress: 0,
      blocked: 0,
    };

    const stepStatus = {
      documents_approved: 0,
      background_check_approved: 0,
      vehicle_assigned: 0,
    };

    onboardings.forEach(ob => {
      states[ob.status] = (states[ob.status] || 0) + 1;
      if (ob.documents_status === 'approved') stepStatus.documents_approved++;
      if (ob.background_check_status === 'approved') stepStatus.background_check_approved++;
      if (ob.vehicle_assignment_status === 'assigned') stepStatus.vehicle_assigned++;
    });

    return {
      states: Object.entries(states).map(([key, value]) => ({
        name: key === 'completed' ? 'Concluído' : key === 'in_progress' ? 'Em progresso' : 'Bloqueado',
        value,
      })),
      steps: [
        { name: 'Documentos Aprovados', value: stepStatus.documents_approved },
        { name: 'Antecedentes Aprovados', value: stepStatus.background_check_approved },
        { name: 'Veículo Atribuído', value: stepStatus.vehicle_assigned },
      ],
    };
  };

  // === FINANCIAL SUMMARY ===
  const getFinancialSummary = () => {
    const paidPayments = payments.filter(p => p.status === 'paid');
    const pendingPayments = payments.filter(p => p.status !== 'paid');

    const totalGross = paidPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    const totalNet = paidPayments.reduce((s, p) => s + (p.net_amount || 0), 0);
    const totalFees = paidPayments.reduce((s, p) => s + (p.commission_amount || 0), 0);

    // Weekly breakdown
    const weeklyData = {};
    paidPayments.forEach(p => {
      const week = format(new Date(p.week_start), 'dd MMM');
      if (!weeklyData[week]) weeklyData[week] = { week, gross: 0, net: 0, drivers: 0 };
      weeklyData[week].gross += p.total_gross || 0;
      weeklyData[week].net += p.net_amount || 0;
      weeklyData[week].drivers += 1;
    });

    return {
      totalGross: Math.round(totalGross),
      totalNet: Math.round(totalNet),
      totalFees: Math.round(totalFees),
      pendingCount: pendingPayments.length,
      pendingAmount: Math.round(pendingPayments.reduce((s, p) => s + (p.net_amount || 0), 0)),
      weeklyChart: Object.values(weeklyData).slice(-12),
    };
  };

  const driverPerf = getDriverPerformanceData();
  const onboardState = getOnboardingStateData();
  const financial = getFinancialSummary();

  // === RENDER BY REPORT TYPE ===
  const renderReport = () => {
    if (reportType === 'drivers') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <p className="text-xs text-gray-500">Motoristas Ativos</p>
                </div>
                <p className="text-2xl font-bold">{drivers.filter(d => d.status === 'active').length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <p className="text-xs text-gray-500">Ganhos Brutos</p>
                </div>
                <p className="text-2xl font-bold">€{financial.totalGross.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <p className="text-xs text-gray-500">Ganhos Líquidos</p>
                </div>
                <p className="text-2xl font-bold">€{financial.totalNet.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-xs text-gray-500">Pendentes</p>
                </div>
                <p className="text-2xl font-bold">€{financial.pendingAmount.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{financial.pendingCount} pagamentos</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top 10 Motoristas por Ganhos Líquidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={driverPerf.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="driver_name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(v) => `€${v}`} />
                  <Bar dataKey="total_net" fill="#10b981" name="Ganhos Líquidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumo por Motorista</CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-96 overflow-y-auto">
                {driverPerf.map((d, i) => (
                  <div key={i} className="px-4 py-3 border-b last:border-0 hover:bg-gray-50">
                    <p className="text-sm font-medium">{d.driver_name}</p>
                    <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500">
                      <span>Bruto: €{d.total_gross}</span>
                      <span>Líquido: €{d.total_net}</span>
                      <span>{d.weeks_worked} semanas</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Distribuição por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={drivers.reduce((acc, d) => {
                        const found = acc.find(a => a.name === d.status);
                        if (found) found.value++;
                        else acc.push({ name: d.status, value: 1 });
                        return acc;
                      }, [])}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      label
                    >
                      {COLORS.map((color, idx) => (
                        <Cell key={idx} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    if (reportType === 'onboarding') {
      return (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Estado Geral</p>
                <div className="space-y-1 text-sm">
                  <p><strong className="text-green-600">{onboardState.states.find(s => s.name === 'Concluído')?.value || 0}</strong> Concluído</p>
                  <p><strong className="text-blue-600">{onboardState.states.find(s => s.name === 'Em progresso')?.value || 0}</strong> Em progresso</p>
                  <p><strong className="text-red-600">{onboardState.states.find(s => s.name === 'Bloqueado')?.value || 0}</strong> Bloqueado</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Aprovação de Etapas</p>
                <div className="space-y-1 text-sm">
                  <p>📄 Docs: <strong>{onboardState.steps[0].value}</strong></p>
                  <p>🛡️ Antecedentes: <strong>{onboardState.steps[1].value}</strong></p>
                  <p>🚗 Veículo: <strong>{onboardState.steps[2].value}</strong></p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Taxa de Conclusão</p>
                <p className="text-3xl font-bold">
                  {onboardings.length > 0 ? Math.round((onboardState.states.find(s => s.name === 'Concluído')?.value || 0) / onboardings.length * 100) : 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Motoristas em Onboarding</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {onboardings.map((ob, i) => (
                <div key={i} className="px-4 py-3 border-b last:border-0 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{ob.driver_name}</p>
                      <p className="text-xs text-gray-500">Etapa: {ob.current_step}</p>
                    </div>
                    <Badge className={ob.status === 'completed' ? 'bg-green-100 text-green-700' : ob.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                      {ob.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (reportType === 'financial') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Total Bruto</p>
                <p className="text-2xl font-bold">€{financial.totalGross.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Total Líquido</p>
                <p className="text-2xl font-bold text-green-600">€{financial.totalNet.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Comissões</p>
                <p className="text-2xl font-bold">€{financial.totalFees.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Em Atraso</p>
                <p className="text-2xl font-bold text-red-600">€{financial.pendingAmount.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{financial.pendingCount} pagamentos</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Evolução Semanal</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={financial.weeklyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip formatter={(v) => `€${Math.round(v)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="gross" stroke="#4f46e5" name="Bruto" />
                  <Line type="monotone" dataKey="net" stroke="#10b981" name="Líquido" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resumo Semanal</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {financial.weeklyChart.map((w, i) => (
                <div key={i} className="px-4 py-3 border-b last:border-0 hover:bg-gray-50">
                  <p className="text-sm font-medium">{w.week}</p>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500">
                    <span>Bruto: €{Math.round(w.gross)}</span>
                    <span>Líquido: €{Math.round(w.net)}</span>
                    <span>{w.drivers} motoristas</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios Avançados"
        subtitle="Análise de desempenho, onboarding e financeira"
      >
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </PageHeader>

      <div className="bg-white rounded-lg border shadow-sm p-4 flex gap-3 flex-wrap">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="drivers">Desempenho de Motoristas</SelectItem>
            <SelectItem value="onboarding">Estado do Onboarding</SelectItem>
            <SelectItem value="financial">Sumário Financeiro</SelectItem>
          </SelectContent>
        </Select>

        {reportType === 'financial' && (
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Este Trimestre</SelectItem>
              <SelectItem value="year">Este Ano</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {renderReport()}
    </div>
  );
}