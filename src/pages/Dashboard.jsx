import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Coins, Zap, Users, Car, Target } from 'lucide-react';

const fmt = (v) => `€${(v || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`;
const medalEmojis = ['🥇', '🥈', '🥉'];

export default function Dashboard({ currentUser }) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => base44.functions.invoke('getDashboardMetrics', {}),
    select: (res) => res.data,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Carregando dashboard...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8 text-gray-400">
        Não há dados disponíveis
      </div>
    );
  }

  const { performance, ranking, upi, growth } = metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Performance Board PureDrive 🚀</h1>
        <p className="text-sm text-gray-600 mt-1">Performance baseada em consistência (últimas 4 semanas)</p>
      </div>

      {/* BLOCO 1: Performance 4 Semanas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PerformanceCard
          title="Receita média semanal"
          value={fmt(performance.avgFleetRevenueWeekly)}
          variation={performance.revenueVariation}
          icon={TrendingUp}
        />
        <PerformanceCard
          title="Receita média por motorista"
          value={fmt(performance.avgRevenuePerDriver)}
          icon={Users}
        />
        <PerformanceCard
          title="Taxa de ocupação"
          value={`${performance.occupancyRate}%`}
          icon={Target}
        />
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-emerald-700 font-medium mb-2">Estabilidade da frota</p>
              <p className="text-2xl font-bold text-emerald-900">✓ Consistente</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 2: Ranking de Consistência */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-gray-900">
            Ranking de Consistência – Top 5 (Últimas 4 Semanas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ranking && ranking.length > 0 ? (
              ranking.map((driver, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{medalEmojis[idx] || `#${idx + 1}`}</span>
                    <div>
                      <p className="font-medium text-gray-900">{driver.name}</p>
                      <p className="text-xs text-gray-500">Média semanal</p>
                    </div>
                  </div>
                  <p className="font-bold text-indigo-600">{fmt(driver.avgRevenue)}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 py-4">Nenhum dado disponível</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 3 & 4: UPI + Crescimento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* UPI System */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-600" />
              Sistema UPI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total UPI acumulado</p>
              <p className="text-3xl font-bold text-violet-700">{upi.totalEarned.toFixed(0)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-600">Preço atual</p>
                <p className="text-lg font-semibold text-gray-900">{fmt(upi.price)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Crescimento</p>
                <p className="text-lg font-semibold text-emerald-600">+{upi.growthPercent}%</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-gray-600">{upi.activeDrivers} motoristas com UPI ativo</p>
            </div>
          </CardContent>
        </Card>

        {/* Crescimento Estrutural */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              Crescimento Estrutural
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-600">Veículos ativos</p>
                <p className="text-2xl font-bold text-blue-700">{growth.activeVehicles}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Novos este mês</p>
                <p className="text-2xl font-bold text-emerald-600">+{growth.newVehiclesThisMonth}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <p className="text-xs text-gray-600">Motoristas novos</p>
                <p className="text-lg font-semibold text-blue-600">+{growth.newDriversThisMonth}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Semanas processadas</p>
                <p className="text-lg font-semibold text-gray-900">{growth.totalWeeksProcessed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer message */}
      <div className="text-center text-sm text-gray-500 py-4">
        Dashboard atualizado em tempo real • Dados baseados em 4 semanas contínuas
      </div>
    </div>
  );
}

function PerformanceCard({ title, value, variation, icon: Icon }) {
  const isPositive = variation !== undefined && variation >= 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-gray-600 font-medium mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {variation !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{variation.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center">
            <Icon className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}