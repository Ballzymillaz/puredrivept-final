import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Wallet, Download, Eye, EyeOff } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const fmt = (n) => `€${(n || 0).toFixed(2)}`;

export default function DriverPerformance({ currentUser }) {
  const isAdmin = currentUser?.role?.includes('admin');
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-perf'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-perf'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 500),
  });

  const toggleDriverSelection = (driverId) => {
    setSelectedDrivers((prev) =>
      prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId]
    );
  };

  const generateCharts = (driverId) => {
    const driverPayments = payments.filter((p) => p.driver_id === driverId && p.status === 'paid');
    
    if (driverPayments.length === 0) return null;

    // Monthly data
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const label = format(d, 'MMM yy');
      const start = startOfMonth(d).toISOString().split('T')[0];
      const end = endOfMonth(d).toISOString().split('T')[0];
      const inMonth = driverPayments.filter(
        (p) => p.week_start >= start && p.week_start <= end
      );

      monthlyData.push({
        label,
        Bruto: Math.round(inMonth.reduce((s, p) => s + (p.total_gross || 0), 0)),
        Líquido: Math.round(inMonth.reduce((s, p) => s + (p.net_amount || 0), 0)),
      });
    }

    // Platform breakdown
    const totalUber = driverPayments.reduce((s, p) => s + (p.uber_gross || 0), 0);
    const totalBolt = driverPayments.reduce((s, p) => s + (p.bolt_gross || 0), 0);
    const totalOther = driverPayments.reduce((s, p) => s + (p.other_platform_gross || 0), 0);

    const platformData = [];
    if (totalUber > 0) platformData.push({ name: 'Uber', value: Math.round(totalUber) });
    if (totalBolt > 0) platformData.push({ name: 'Bolt', value: Math.round(totalBolt) });
    if (totalOther > 0) platformData.push({ name: 'Outro', value: Math.round(totalOther) });

    // Stats
    const totalGross = driverPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    const totalNet = driverPayments.reduce((s, p) => s + (p.net_amount || 0), 0);
    const avgWeekly = driverPayments.length > 0 ? totalGross / driverPayments.length : 0;

    return {
      monthlyData,
      platformData,
      stats: {
        totalGross,
        totalNet,
        weeks: driverPayments.length,
        avgWeekly,
      },
    };
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleExportCSV = (driverId) => {
    const driver = drivers.find((d) => d.id === driverId);
    const driverPayments = payments.filter((p) => p.driver_id === driverId && p.status === 'paid');

    const headers = [
      'Período',
      'Semana início',
      'Semana fim',
      'Bruto Uber',
      'Bruto Bolt',
      'Total Bruto',
      'Comissão',
      'Deduções',
      'Total Líquido',
    ];

    const rows = driverPayments.map((p) => [
      p.period_label,
      p.week_start,
      p.week_end,
      p.uber_gross.toFixed(2),
      p.bolt_gross.toFixed(2),
      p.total_gross.toFixed(2),
      p.commission_amount.toFixed(2),
      p.total_deductions.toFixed(2),
      p.net_amount.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `performance_${driver.full_name.replace(/\s+/g, '_')}.csv`);
    link.click();
  };

  const handleExportPDF = async (driverId) => {
    const jsPDF = (await import('jspdf')).jsPDF;
    const driver = drivers.find((d) => d.id === driverId);
    const driverPayments = payments.filter((p) => p.driver_id === driverId && p.status === 'paid');

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Relatório de Performance — ${driver.full_name}`, 10, 10);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-PT')}`, 10, 20);
    doc.text(`Semanas ativas: ${driverPayments.length}`, 10, 28);

    const tableHeaders = [
      'Período',
      'Semana',
      'Uber',
      'Bolt',
      'Bruto',
      'Comissão',
      'Deduções',
      'Líquido',
    ];
    const tableRows = driverPayments.map((p) => [
      p.period_label,
      `${p.week_start} a ${p.week_end}`,
      p.uber_gross.toFixed(0),
      p.bolt_gross.toFixed(0),
      p.total_gross.toFixed(0),
      p.commission_amount.toFixed(0),
      p.total_deductions.toFixed(0),
      p.net_amount.toFixed(0),
    ]);

    doc.autoTable({
      head: [tableHeaders],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`performance_${driver.full_name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Análise de Performance de Motoristas"
        subtitle="Rendimento detalhado por motorista"
      />

      {/* Driver Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Selecionar Motoristas para Comparação</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowComparison(!showComparison)}
              className="gap-2"
            >
              {showComparison ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" /> Ocultar Comparação
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" /> Ver Comparação
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {drivers.map((driver) => (
              <button
                key={driver.id}
                onClick={() => toggleDriverSelection(driver.id)}
                className={`p-3 rounded-lg border-2 transition-all text-left text-sm ${
                  selectedDrivers.includes(driver.id)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">{driver.full_name}</p>
                <p className="text-xs text-gray-500">{driver.email}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison view */}
      {showComparison && selectedDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Comparação de Motoristas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">Motorista</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">Semanas</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">Total Bruto</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">Total Líquido</th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500">Média/Semana</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedDrivers.map((driverId) => {
                    const driver = drivers.find((d) => d.id === driverId);
                    const charts = generateCharts(driverId);
                    if (!charts) return null;

                    return (
                      <tr key={driverId} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{driver.full_name}</td>
                        <td className="py-3 px-4 text-right">{charts.stats.weeks}</td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                          {fmt(charts.stats.totalGross)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-blue-600">
                          {fmt(charts.stats.totalNet)}
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-600">
                          {fmt(charts.stats.avgWeekly)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Driver Details */}
      <div className="space-y-6">
        {drivers.map((driver) => {
          const charts = generateCharts(driver.id);
          if (!charts) return null;

          return (
            <div key={driver.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{driver.full_name}</h3>
                  <p className="text-sm text-gray-500">{driver.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleExportCSV(driver.id)}
                    className="gap-2"
                    variant="outline"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleExportPDF(driver.id)}
                    className="gap-2"
                    variant="outline"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500">Semanas Ativas</p>
                    <p className="text-2xl font-bold">{charts.stats.weeks}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500">Total Bruto</p>
                    <p className="text-2xl font-bold text-green-600">{fmt(charts.stats.totalGross)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500">Total Líquido</p>
                    <p className="text-2xl font-bold text-blue-600">{fmt(charts.stats.totalNet)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500">Média/Semana</p>
                    <p className="text-2xl font-bold text-indigo-600">{fmt(charts.stats.avgWeekly)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Monthly evolution */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Evolução Mensal (6 meses)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={charts.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `€${v}`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => `€${v}`} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="Bruto"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Líquido"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Platform breakdown */}
                {charts.platformData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Distribuição por Plataforma</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={charts.platformData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name} €${value}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {charts.platformData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => `€${v}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}