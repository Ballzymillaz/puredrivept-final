import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket, TrendingUp, TrendingDown, Users, Zap, Award, BarChart3, Coins } from 'lucide-react';
import AnalyticsCharts from '../components/dashboard/AnalyticsCharts';

export default function Dashboard({ currentUser }) {
  const isSimulation = !!currentUser?._isSimulation;
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => base44.functions.invoke('getDashboardMetrics').then(res => res.data),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 mb-4">
            <Rocket className="w-6 h-6 text-indigo-600 animate-pulse" />
          </div>
          <p className="text-gray-600">Carregando performance...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Dados não disponíveis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isSimulation && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2 text-xs text-amber-800 font-medium">
          🔒 Modo simulação ativo — vista somente leitura
        </div>
      )}
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">PureDrive em crescimento sustentável 🚀</h1>
        <p className="text-gray-600 mt-2">Performance baseada em consistência (últimas 4 semanas)</p>
      </div>

      {/* BLOCO 1: Performance 4 Weeks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PerformanceCard
          title="Receita Média Frota"
          value={`€${metrics.performance4weeks.fleetAvg.toLocaleString('pt-PT')}`}
          variation={metrics.performance4weeks.variation}
          icon={TrendingUp}
          color="emerald"
        />
        <PerformanceCard
          title="Receita Média Motorista"
          value={`€${metrics.performance4weeks.driverAvg.toLocaleString('pt-PT')}`}
          icon={Users}
          color="indigo"
        />
        <PerformanceCard
          title="Taxa Ocupação"
          value={`${metrics.performance4weeks.occupancyRate}%`}
          icon={BarChart3}
          color="blue"
        />
        <PerformanceCard
          title="Variação vs 4 Sem."
          value={`${metrics.performance4weeks.variation > 0 ? '+' : ''}${metrics.performance4weeks.variation}%`}
          variation={metrics.performance4weeks.variation}
          icon={metrics.performance4weeks.variationPositive ? TrendingUp : TrendingDown}
          color={metrics.performance4weeks.variationPositive ? 'emerald' : 'rose'}
        />
      </div>

      {/* BLOCO 2: Ranking Consistência */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Ranking de Consistência – Últimas 4 Semanas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.rankingConsistency.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Sem dados de consistência</p>
            ) : (
              metrics.rankingConsistency.map((driver, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-transparent rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-300">#{driver.rank}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{driver.badge} {driver.name}</p>
                      <p className="text-sm text-gray-500">Média: €{driver.avg.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                  {driver.rank <= 3 && (
                    <span className="text-3xl">{driver.badge}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BLOCO 3: Sistema UPI */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Sistema UPI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                <p className="text-sm text-gray-600 mb-1">Total UPI Acumulado</p>
                <p className="text-3xl font-bold text-yellow-600">{metrics.upiSystem.totalAccumulated.toLocaleString('pt-PT')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Último Preço</p>
                  <p className="text-xl font-semibold text-gray-900">€{metrics.upiSystem.lastPrice.toLocaleString('pt-PT')}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Motoristas com UPI</p>
                  <p className="text-xl font-semibold text-gray-900">{metrics.upiSystem.driversActive}</p>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">Crescimento</p>
                  <span className={`text-lg font-bold ${metrics.upiSystem.growthPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {metrics.upiSystem.growthPositive ? '↑' : '↓'} {Math.abs(metrics.upiSystem.growth)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BLOCO 4: Crescimento Estrutural */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-500" />
              Crescimento Estrutural
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-sm text-gray-600 mb-1">Veículos Ativos</p>
                <p className="text-3xl font-bold text-emerald-600">{metrics.structuralGrowth.activeVehicles}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-gray-600 mb-2">Novos Veículos (mês)</p>
                  <p className="text-2xl font-bold text-blue-600">+{metrics.structuralGrowth.newVehiclesMonth}</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                  <p className="text-xs text-gray-600 mb-2">Novos Motoristas (mês)</p>
                  <p className="text-2xl font-bold text-indigo-600">+{metrics.structuralGrowth.newDriversMonth}</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Semanas Processadas</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.structuralGrowth.totalWeeksProcessed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PerformanceCard({ title, value, variation, icon: Icon, color = 'gray' }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {variation !== undefined && (
          <div className={`text-sm font-semibold ${variation >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {variation >= 0 ? '↑' : '↓'} {Math.abs(variation)}%
          </div>
        )}
      </div>
    </Card>
  );
}