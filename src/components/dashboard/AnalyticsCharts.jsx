import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Car, Users } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function fmt(v) {
  return `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 })}`;
}

export default function AnalyticsCharts({ payments = [], vehicles = [], drivers = [] }) {
  // 1. Weekly fleet earnings evolution (last 10 weeks)
  const weeklyEarnings = useMemo(() => {
    const byWeek = {};
    payments.forEach(p => {
      if (!p.period_label) return;
      if (!byWeek[p.period_label]) byWeek[p.period_label] = { week: p.period_label, bruto: 0, liquido: 0 };
      byWeek[p.period_label].bruto += p.total_gross || 0;
      byWeek[p.period_label].liquido += p.net_amount || 0;
    });
    return Object.values(byWeek)
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-10)
      .map(w => ({ ...w, week: w.week.replace('Semana ', 'S').split(' - ')[0] }));
  }, [payments]);

  // 2. Vehicle occupancy per week (assigned vs total)
  const occupancyData = useMemo(() => {
    const total = vehicles.length || 1;
    const byWeek = {};
    payments.forEach(p => {
      if (!p.period_label || !p.driver_id) return;
      if (!byWeek[p.period_label]) byWeek[p.period_label] = { week: p.period_label, active: new Set() };
      byWeek[p.period_label].active.add(p.driver_id);
    });
    return Object.values(byWeek)
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-8)
      .map(w => ({
        week: w.week.replace('Semana ', 'S').split(' - ')[0],
        ocupacao: Math.round((w.active.size / total) * 100),
        ativos: w.active.size,
        total,
      }));
  }, [payments, vehicles]);

  // 3. Revenue distribution among drivers (top 8 + others)
  const driverDistribution = useMemo(() => {
    const byDriver = {};
    payments.forEach(p => {
      if (!p.driver_name) return;
      byDriver[p.driver_name] = (byDriver[p.driver_name] || 0) + (p.total_gross || 0);
    });
    const sorted = Object.entries(byDriver).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 7);
    const othersTotal = sorted.slice(7).reduce((s, [, v]) => s + v, 0);
    const result = top.map(([name, value]) => ({ name, value: Math.round(value) }));
    if (othersTotal > 0) result.push({ name: 'Outros', value: Math.round(othersTotal) });
    return result;
  }, [payments]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.name !== 'Ocupação (%)' && p.name !== 'Ativos' ? fmt(p.value) : p.value}{p.name === 'Ocupação (%)' ? '%' : ''}
          </p>
        ))}
      </div>
    );
  };

  if (weeklyEarnings.length === 0 && occupancyData.length === 0 && driverDistribution.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
        Sem dados de pagamentos suficientes para gráficos analíticos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-indigo-500" /> Análise Visual da Frota
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Weekly earnings */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Evolução Semanal de Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyEarnings.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyEarnings} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="bruto" name="Bruto" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="liquido" name="Líquido" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Vehicle occupancy */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-500" /> Taxa de Ocupação dos Veículos (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {occupancyData.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={occupancyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ocupacao" name="Ocupação (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ativos" name="Ativos" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart 3: Driver revenue distribution */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" /> Distribuição de Rendimentos entre Motoristas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {driverDistribution.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-8">Sem dados</p>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={driverDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {driverDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 min-w-[180px]">
                {driverDistribution.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-700 truncate flex-1">{d.name}</span>
                    <span className="font-semibold text-gray-900">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}