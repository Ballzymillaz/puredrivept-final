import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatCard from '../components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Zap, TrendingUp, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

export default function Dashboard({ currentUser }) {
  const [detailsDialog, setDetailsDialog] = useState(null);
  
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.Cities.list(),
  });

  const { data: weeklyRevenues = [] } = useQuery({
    queryKey: ['weekly-revenues'],
    queryFn: () => base44.entities.WeeklyRevenues.list('-week_start_date', 50),
  });

  const { data: cityFinancials = [] } = useQuery({
    queryKey: ['city-financials'],
    queryFn: () => base44.entities.CityFinancials.list(),
  });

  const activeDrivers = drivers.filter(d => d.status === 'active').length;
  const assignedVehicles = vehicles.filter(v => v.status === 'assigned').length;
  const totalRevenue = weeklyRevenues.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalUPI = weeklyRevenues.reduce((s, r) => s + (r.upi_4_percent || 0), 0);

  // Distribution par ville
  const cityData = cities.map(city => {
    const cityDrivers = drivers.filter(d => d.city_id === city.id);
    return {
      name: city.name,
      drivers: cityDrivers.length,
    };
  }).filter(d => d.drivers > 0);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={() => setDetailsDialog('drivers')}>
          <StatCard title="Motoristas ativos" value={activeDrivers} subtitle={`${drivers.length} total`} icon={Users} color="indigo" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('vehicles')}>
          <StatCard title="Veículos atribuídos" value={assignedVehicles} subtitle={`${vehicles.length} total`} icon={Zap} color="blue" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('revenue')}>
          <StatCard title="Receita (Semanas recentes)" value={fmt(totalRevenue)} subtitle="Total bruto" icon={TrendingUp} color="green" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('upi')}>
          <StatCard title="UPI gerado" value={totalUPI.toFixed(0)} subtitle="4% das receitas" icon={Zap} color="violet" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Distribuição por Cidade</CardTitle>
          </CardHeader>
          <CardContent>
            {cityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={cityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="drivers" paddingAngle={3}>
                    {cityData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} motoristas`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Sem dados</div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {cityData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Saúde Financeira por Cidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cityFinancials.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Sem dados de cidades</div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {cityFinancials.slice(0, 10).map(cf => (
                  <div key={cf.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{cf.city_name}</p>
                      <p className="text-xs text-gray-500">{cf.vehicles_total} veículos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{fmt(cf.estimated_ebitda || 0)}</p>
                      <p className="text-xs text-gray-500">EBITDA estimado</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === 'drivers' && 'Motoristas ativos'}
              {detailsDialog === 'vehicles' && 'Veículos atribuídos'}
              {detailsDialog === 'revenue' && 'Receita (Semanas recentes)'}
              {detailsDialog === 'upi' && 'UPI Gerado'}
            </DialogTitle>
          </DialogHeader>
          <DashboardDetailsContent 
            type={detailsDialog} 
            drivers={drivers.filter(d => d.status === 'active')}
            vehicles={vehicles.filter(v => v.status === 'assigned')}
            weeklyRevenues={weeklyRevenues}
            fmt={fmt}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DashboardDetailsContent({ type, drivers, vehicles, weeklyRevenues, fmt }) {
  if (type === 'drivers') {
    return (
      <div className="space-y-2">
        {drivers.length === 0 ? (
          <p className="text-center py-4 text-gray-400">Sem motoristas ativos</p>
        ) : (
          drivers.map(d => (
            <div key={d.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium">{d.full_name}</p>
                <p className="text-sm text-gray-500">{d.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{d.phone}</p>
                <p className="text-xs text-gray-500">{d.city_name || 'N/A'}</p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (type === 'vehicles') {
    return (
      <div className="space-y-2">
        {vehicles.length === 0 ? (
          <p className="text-center py-4 text-gray-400">Sem veículos atribuídos</p>
        ) : (
          vehicles.map(v => (
            <div key={v.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium">{v.brand} {v.model}</p>
                <p className="text-sm text-gray-500">{v.license_plate}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{v.current_driver_name || 'N/A'}</p>
                <p className="text-xs text-gray-500">{v.city_name}</p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (type === 'revenue') {
    const total = weeklyRevenues.reduce((s, r) => s + (r.total_revenue || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {weeklyRevenues.map(r => (
            <div key={r.id} className="flex justify-between p-2 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium text-sm">{r.driver_name}</p>
                <p className="text-xs text-gray-500">{r.week_start_date} a {r.week_end_date}</p>
              </div>
              <p className="font-medium">{fmt(r.total_revenue)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'upi') {
    const total = weeklyRevenues.reduce((s, r) => s + (r.upi_4_percent || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-violet-50 rounded-lg">
          <p className="text-sm font-semibold">Total UPI: {total.toFixed(0)} UPI</p>
        </div>
        <div className="space-y-2">
          {weeklyRevenues.filter(r => r.upi_4_percent > 0).map(r => (
            <div key={r.id} className="flex justify-between p-2 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium text-sm">{r.driver_name}</p>
                <p className="text-xs text-gray-500">{r.week_start_date}</p>
              </div>
              <p className="font-medium">{r.upi_4_percent.toFixed(0)} UPI</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}