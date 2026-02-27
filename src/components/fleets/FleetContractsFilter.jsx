import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FleetContractsFilter({ onFilterChange, contracts = [] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [contractType, setContractType] = useState('all');

  const handleSearchChange = (val) => {
    setSearch(val);
    onFilterChange({ search: val, status, contractType });
  };

  const handleStatusChange = (val) => {
    setStatus(val);
    onFilterChange({ search, status: val, contractType });
  };

  const handleContractChange = (val) => {
    setContractType(val);
    onFilterChange({ search, status, contractType: val });
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setContractType('all');
    onFilterChange({ search: '', status: 'all', contractType: 'all' });
  };

  const isFiltered = search || status !== 'all' || contractType !== 'all';

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Pesquisar por motorista ou veículo..."
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
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={contractType} onValueChange={handleContractChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="slot_standard">Slot Standard</SelectItem>
            <SelectItem value="slot_premium">Slot Premium</SelectItem>
            <SelectItem value="slot_black">Slot Black</SelectItem>
            <SelectItem value="location">Location</SelectItem>
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