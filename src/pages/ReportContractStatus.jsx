import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Search, FileText, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function ReportContractStatus({ currentUser }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [contractType, setContractType] = useState('all');

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts-status'],
    queryFn: () => base44.entities.Contract.list(),
  });

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search || c.driver_name?.toLowerCase().includes(searchLower) || c.vehicle_info?.toLowerCase().includes(searchLower);
      const matchStatus = status === 'all' || c.status === status;
      const matchContract = contractType === 'all' || c.contract_type === contractType;
      return matchSearch && matchStatus && matchContract;
    });
  }, [contracts, search, status, contractType]);

  const stats = useMemo(() => {
    return {
      total: filteredContracts.length,
      active: filteredContracts.filter(c => c.status === 'active').length,
      expired: filteredContracts.filter(c => c.status === 'expired').length,
      cancelled: filteredContracts.filter(c => c.status === 'cancelled').length,
    };
  }, [filteredContracts]);

  const statusDistribution = [
    { name: 'Ativo', value: stats.active },
    { name: 'Expirado', value: stats.expired },
    { name: 'Cancelado', value: stats.cancelled },
  ];

  const contractTypeDistribution = useMemo(() => {
    const dist = {};
    filteredContracts.forEach(c => {
      const type = c.contract_type || 'unknown';
      dist[type] = (dist[type] || 0) + 1;
    });
    return Object.entries(dist).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').toUpperCase(),
      value,
    }));
  }, [filteredContracts]);

  const expiringContracts = useMemo(() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return filteredContracts.filter(c => {
      if (!c.end_date || c.status !== 'active') return false;
      const endDate = new Date(c.end_date);
      return endDate <= thirtyDaysFromNow && endDate > new Date();
    });
  }, [filteredContracts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Situação de Contratos"
        subtitle={`${filteredContracts.length} contratos analisados`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total de Contratos</CardTitle>
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
            <CardTitle className="text-sm text-gray-600">Expirados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Cancelados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-600">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Pesquisar motorista ou veículo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
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
            <CardTitle>Contratos a Vencer (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringContracts.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">Nenhum contrato próximo de expirar</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {expiringContracts.map(c => (
                  <div key={c.id} className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900">{c.driver_name}</p>
                      <p className="text-[11px] text-gray-600">
                        Expira: {c.end_date ? format(new Date(c.end_date), 'dd/MM/yyyy') : '—'}
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
          <CardTitle>Lista de Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-semibold">Motorista</th>
                  <th className="text-left py-2 px-2 font-semibold">Veículo</th>
                  <th className="text-left py-2 px-2 font-semibold">Tipo</th>
                  <th className="text-left py-2 px-2 font-semibold">Início</th>
                  <th className="text-left py-2 px-2 font-semibold">Fim</th>
                  <th className="text-left py-2 px-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map(c => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-xs">{c.driver_name}</td>
                    <td className="py-2 px-2 text-xs text-gray-600">{c.vehicle_info}</td>
                    <td className="py-2 px-2 text-xs">{c.contract_type?.replace(/_/g, ' ').toUpperCase()}</td>
                    <td className="py-2 px-2 text-xs">{format(new Date(c.start_date), 'dd/MM/yyyy')}</td>
                    <td className="py-2 px-2 text-xs">{c.end_date ? format(new Date(c.end_date), 'dd/MM/yyyy') : '—'}</td>
                    <td className="py-2 px-2">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        c.status === 'active' ? 'bg-green-100 text-green-700' : 
                        c.status === 'expired' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {c.status === 'active' ? 'Ativo' : c.status === 'expired' ? 'Expirado' : 'Cancelado'}
                      </span>
                    </td>
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