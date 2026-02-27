import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import FleetDriversFilter from '../components/fleets/FleetDriversFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, Phone, Car } from 'lucide-react';

export default function FleetDrivers({ currentUser }) {
  const [filters, setFilters] = useState({ search: '', status: 'all', contractType: 'all' });

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['fleet-drivers-list'],
    queryFn: () => base44.entities.Driver.list('-created_date'),
  });

  const statusConfig = {
    active: { label: 'Ativo', color: 'bg-green-100 text-green-700' },
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
    inactive: { label: 'Inativo', color: 'bg-gray-100 text-gray-600' },
    evaluation: { label: 'Avaliação', color: 'bg-blue-100 text-blue-700' },
    suspended: { label: 'Suspenso', color: 'bg-red-100 text-red-700' },
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const searchLower = filters.search.toLowerCase();
      const matchSearch =
        !filters.search ||
        d.full_name?.toLowerCase().includes(searchLower) ||
        d.email?.toLowerCase().includes(searchLower);

      const matchStatus = filters.status === 'all' || d.status === filters.status;
      const matchContract = filters.contractType === 'all' || d.contract_type === filters.contractType;

      return matchSearch && matchStatus && matchContract;
    });
  }, [drivers, filters]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motoristas de Frota"
        subtitle={`${filteredDrivers.length} de ${drivers.length} motoristas`}
      />

      <FleetDriversFilter onFilterChange={setFilters} drivers={drivers} />

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum motorista encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => (
            <Card key={driver.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{driver.full_name}</CardTitle>
                    <Badge
                      className={`mt-2 ${statusConfig[driver.status]?.color || 'bg-gray-100'}`}
                    >
                      {statusConfig[driver.status]?.label || driver.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${driver.email}`} className="text-indigo-600 hover:underline truncate">
                      {driver.email}
                    </a>
                  </div>
                  {driver.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${driver.phone}`} className="text-indigo-600 hover:underline">
                        {driver.phone}
                      </a>
                    </div>
                  )}
                  {driver.assigned_vehicle_plate && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Car className="w-4 h-4 text-gray-400" />
                      <span className="font-mono text-sm">{driver.assigned_vehicle_plate}</span>
                    </div>
                  )}
                </div>

                {driver.contract_type && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500 mb-1">Tipo de contrato</p>
                    <Badge variant="outline" className="text-xs">
                      {driver.contract_type.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}