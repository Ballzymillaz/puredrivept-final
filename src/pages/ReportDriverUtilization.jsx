import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Search, Users, TrendingUp } from 'lucide-react';

const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function ReportDriverUtilization({ currentUser }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [contractType, setContractType] = useState('all');

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers-utilization'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['weekly-payments'],
    queryFn: () => base44.entities.WeeklyPayment.list(),
  });

  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search || d.full_name?.toLowerCase().includes(searchLower) || d.email?.toLowerCase().includes(searchLower);
      const matchStatus = status === 'all' || d.status === status;
      const matchContract = contractType === 'all' || d.contract_type === contractType;
      return matchSearch && matchStatus && matchContract;
    });
  }, [drivers, search, status, contractType]);

  const stats = useMemo(() => {
    return {
      total: filteredDrivers.length,
      active: filteredDrivers.filter(d => d.status === 'active').length,
      pending: filteredDrivers.filter(d => d.status === 'pending').length,
      inactive: filteredDrivers.filter(d => d.status === 'inactive').length,
    };
  }, [filteredDrivers]);

  const statusDistribution = [
    { name: 'Ativo', value: stats.active },
    { name: 'Pendente', value: stats.pending },
    { name: 'Inativo', value: stats.inactive },
  ];

  const contractDistribution = useMemo(() => {
    const dist = {};
    filteredDrivers.forEach(d => {
      const type = d.contract_type || 'sem_contrato';
      dist[type] = (dist[type] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').toUpperCase(),
      value,
    }));
  }, [filteredDrivers]);

  const driverEarnings = useMemo(() => {
    const earnings = {};
    filteredDrivers.forEach(d => {
      const driverPayments = payments.filter(p => p.driver_id === d.id);
      const total = driverPayments.reduce((sum, p) => sum + (p.net_amount || 0), 0);
      earnings[d.full_name] = total;
    });
    return Object.entries(earnings).slice(0, 10).map(([name, value]) => ({
      name,
      ganhos: value,
    }));
  }, [filteredDrivers, payments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilização de Motoristas"
        subtitle={`${filteredDrivers.length} motoristas analisados`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total de Motoristas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-indigo-600">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Inativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats.inactive}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Pesquisar motorista..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os contratos</SelectItem>
                <SelectItem value="slot_standard">Slot Standard</SelectItem>
                <SelectItem value="slot_premium">Slot Premium</SelectItem>
                <SelectItem value="slot_black">Slot Black</SelectItem>
                <SelectItem value="location">Location</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            <CardTitle>Distribuição por Tipo de Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={contractDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {driverEarnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Motoristas por Ganhos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={driverEarnings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} />
                <YAxis />
                <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
                <Bar dataKey="ganhos" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de Motoristas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">Nome</th>
                  <th className="text-left py-2 px-2 font-semibold">Email</th>
                  <th className="text-left py-2 px-2 font-semibold">Estado</th>
                  <th className="text-left py-2 px-2 font-semibold">Tipo Contrato</th>
                  <th className="text-left py-2 px-2 font-semibold">Veículo</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map(d => (
                  <tr key={d.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium">{d.full_name}</td>
                    <td className="py-2 px-2 text-xs text-gray-600">{d.email}</td>
                    <td className="py-2 px-2">
                      <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs">{d.contract_type?.replace(/_/g, ' ').toUpperCase() || '—'}</td>
                    <td className="py-2 px-2 font-mono text-xs">{d.assigned_vehicle_plate || '—'}</td>
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