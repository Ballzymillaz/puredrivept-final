import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FleetVehiclesFilter({ onFilterChange, vehicles = [] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [fuelType, setFuelType] = useState('all');

  const handleSearchChange = (val) => {
    setSearch(val);
    onFilterChange({ search: val, status, fuelType });
  };

  const handleStatusChange = (val) => {
    setStatus(val);
    onFilterChange({ search, status: val, fuelType });
  };

  const handleFuelChange = (val) => {
    setFuelType(val);
    onFilterChange({ search, status, fuelType: val });
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setFuelType('all');
    onFilterChange({ search: '', status: 'all', fuelType: 'all' });
  };

  const isFiltered = search || status !== 'all' || fuelType !== 'all';

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Pesquisar por matrícula ou marca..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="available">Disponível</SelectItem>
            <SelectItem value="assigned">Atribuído</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={fuelType} onValueChange={handleFuelChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Combustível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="gasoline">Gasolina</SelectItem>
            <SelectItem value="diesel">Diesel</SelectItem>
            <SelectItem value="hybrid">Híbrido</SelectItem>
            <SelectItem value="electric">Elétrico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isFiltered && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={clearFilters}
          className="w-full gap-1"
        >
          <X className="w-3 h-3" /> Limpar filtros
        </Button>
      )}
    </div>
  );
}