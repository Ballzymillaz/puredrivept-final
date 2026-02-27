import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Car, Users, Wrench, TrendingUp, AlertTriangle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

export default function RelatorioFrotas() {
  const { data: fleets = [] } = useQuery({ queryKey: ['fleets'], queryFn: () => base44.entities.Fleet.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.list() });
  const { data: maintenance = [] } = useQuery({ queryKey: ['maintenance'], queryFn: () => base44.entities.MaintenanceRecord.list() });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 200) });

  const today = new Date();

  const fleetStats = useMemo(() => {
    return fleets.map(fleet => {
      const fleetVehicleIds = fleet.vehicle_ids || [];
      const fleetDriverIds = fleet.driver_ids || [];

      const fleetVehicles = vehicles.filter(v => fleetVehicleIds.includes(v.id));
      const fleetDrivers = drivers.filter(d => fleetDriverIds.includes(d.id));
      const fleetMaintenance = maintenance.filter(m => fleetVehicleIds.includes(m.vehicle_id));
      const fleetPayments = payments.filter(p => fleetDriverIds.includes(p.driver_id));

      const maintenanceCost = fleetMaintenance.reduce((s, m) => s + (m.cost || 0), 0);
      const totalRevenue = fleetPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
      const totalNet = fleetPayments.reduce((s, p) => s + (p.net_amount || 0), 0);

      const alertVehicles = fleetVehicles.filter(v => {
        const insExpiry = v.insurance_expiry ? differenceInDays(new Date(v.insurance_expiry), today) : 999;
        const inspecExpiry = v.inspection_expiry ? differenceInDays(new Date(v.inspection_expiry), today) : 999;
        return insExpiry <= 30 || inspecExpiry <= 30;
      });

      const assignedVehicles = fleetVehicles.filter(v => v.status === 'assigned' || v.status === 'alugado');

      return {
        ...fleet,
        fleetVehicles,
        fleetDrivers,
        maintenanceCost,
        totalRevenue,
        totalNet,
        alertVehicles,
        assignedVehicles,
      };
    });
  }, [fleets, vehicles, drivers, maintenance, payments]);

  const chartData = fleetStats.map(fs => ({
    name: fs.name.length > 15 ? fs.name.substring(0, 15) + '…' : fs.name,
    Veículos: fs.fleetVehicles.length,
    Motoristas: fs.fleetDrivers.length,
    Manutenção: parseFloat(fs.maintenanceCost.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 mb-1">Total Frotas</p>
            <p className="text-2xl font-bold text-indigo-700">{fleets.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 mb-1">Total Veículos</p>
            <p className="text-2xl font-bold">{fleetStats.reduce((s, f) => s + f.fleetVehicles.length, 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 mb-1">Custo Manutenção</p>
            <p className="text-2xl font-bold text-red-600">{fmt(fleetStats.reduce((s, f) => s + f.maintenanceCost, 0))}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 mb-1">Receita Total</p>
            <p className="text-2xl font-bold text-green-600">{fmt(fleetStats.reduce((s, f) => s + f.totalRevenue, 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Comparação entre Frotas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="Veículos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Motoristas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-fleet breakdown */}
      <div className="space-y-4">
        {fleetStats.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma frota criada ainda</p>
          </div>
        ) : (
          fleetStats.map(fs => (
            <Card key={fs.id} className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{fs.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {fs.alertVehicles.length > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 border-0 gap-1">
                        <AlertTriangle className="w-3 h-3" /> {fs.alertVehicles.length} alerta(s)
                      </Badge>
                    )}
                    <Badge className={fs.status === 'active' ? 'bg-green-100 text-green-700 border-0' : 'bg-gray-100 text-gray-500 border-0'}>
                      {fs.status === 'active' ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                </div>
                {fs.fleet_manager_name && <p className="text-xs text-gray-500">Gestor: {fs.fleet_manager_name}</p>}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-indigo-50 rounded-lg p-3 text-center">
                    <Car className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-indigo-700">{fs.fleetVehicles.length}</p>
                    <p className="text-xs text-gray-500">{fs.assignedVehicles.length} atribuídos</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <Users className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-green-700">{fs.fleetDrivers.length}</p>
                    <p className="text-xs text-gray-500">motoristas</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <Wrench className="w-5 h-5 text-red-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-red-600">{fmt(fs.maintenanceCost)}</p>
                    <p className="text-xs text-gray-500">manutenção</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-emerald-700">{fmt(fs.totalRevenue)}</p>
                    <p className="text-xs text-gray-500">receita bruta</p>
                  </div>
                </div>

                {fs.alertVehicles.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Veículos com documentos a expirar
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {fs.alertVehicles.map(v => (
                        <span key={v.id} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                          {v.brand} {v.model} – {v.license_plate}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}