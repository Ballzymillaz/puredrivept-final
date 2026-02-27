import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Search, TrendingUp, AlertTriangle } from 'lucide-react';

const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function ReportVehiclePerformance({ currentUser }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles-performance'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const { data: maintenance = [] } = useQuery({
    queryKey: ['maintenance-records'],
    queryFn: () => base44.entities.MaintenanceRecord.list(),
  });

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search || v.license_plate?.toLowerCase().includes(searchLower) || v.brand?.toLowerCase().includes(searchLower);
      const matchStatus = status === 'all' || v.status === status;
      return matchSearch && matchStatus;
    });
  }, [vehicles, search, status]);

  const stats = useMemo(() => {
    return {
      total: filteredVehicles.length,
      available: filteredVehicles.filter(v => v.status === 'available').length,
      assigned: filteredVehicles.filter(v => v.status === 'assigned').length,
      maintenance: filteredVehicles.filter(v => v.status === 'maintenance').length,
    };
  }, [filteredVehicles]);

  const statusDistribution = [
    { name: 'Disponível', value: stats.available },
    { name: 'Atribuído', value: stats.assigned },
    { name: 'Manutenção', value: stats.maintenance },
  ];

  const expiringDocs = useMemo(() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return filteredVehicles.filter(v => {
      const insurance = v.insurance_expiry ? new Date(v.insurance_expiry) : null;
      const inspection = v.inspection_expiry ? new Date(v.inspection_expiry) : null;
      return (insurance && insurance <= thirtyDaysFromNow && insurance > new Date()) || 
             (inspection && inspection <= thirtyDaysFromNow && inspection > new Date());
    });
  }, [filteredVehicles]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Desempenho de Veículos"
        subtitle={`${filteredVehicles.length} veículos analisados`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total de Veículos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-indigo-600">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Atribuídos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{stats.assigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Em Manutenção</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{stats.maintenance}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Pesquisar matrícula..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="available">Disponível</SelectItem>
              <SelectItem value="assigned">Atribuído</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Estados</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentos a Vencer</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringDocs.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">Nenhum documento próximo de expirar</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {expiringDocs.map(v => (
                  <div key={v.id} className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900">{v.license_plate}</p>
                      <p className="text-[11px] text-gray-600">
                        {v.insurance_expiry && new Date(v.insurance_expiry) < new Date(new Date().getTime() + 30*24*60*60*1000) && `Seguro: ${new Date(v.insurance_expiry).toLocaleDateString('pt-PT')}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Veículos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">Matrícula</th>
                  <th className="text-left py-2 px-2 font-semibold">Marca/Modelo</th>
                  <th className="text-left py-2 px-2 font-semibold">Estado</th>
                  <th className="text-left py-2 px-2 font-semibold">Motorista</th>
                  <th className="text-left py-2 px-2 font-semibold">Quilometragem</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map(v => (
                  <tr key={v.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-mono text-xs">{v.license_plate}</td>
                    <td className="py-2 px-2">{v.brand} {v.model}</td>
                    <td className="py-2 px-2">
                      <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                        {v.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-600">{v.assigned_driver_name || '—'}</td>
                    <td className="py-2 px-2 text-xs text-gray-600">{v.mileage || '—'} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}