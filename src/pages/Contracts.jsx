import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Edit2, Trash2, FileText, Download, Upload } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo', color: 'bg-green-100 text-green-700' },
  { value: 'expired', label: 'Expirado', color: 'bg-red-100 text-red-700' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-gray-100 text-gray-700' },
];

const CONTRACT_TYPES = [
  { value: 'slot_standard', label: 'Slot Standard' },
  { value: 'slot_premium', label: 'Slot Premium' },
  { value: 'slot_black', label: 'Slot Black' },
  { value: 'location', label: 'Aluguel de Veículo' },
];

export default function Contracts({ currentUser }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [formData, setFormData] = useState({
    driver_id: '', driver_name: '', vehicle_id: '', vehicle_info: '',
    contract_type: 'slot_standard', slot_fee: '', weekly_rental_price: '',
    start_date: '', end_date: '', status: 'active', contract_file_url: '', notes: ''
  });

  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager');

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-start_date'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-contracts'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-contracts'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      handleCloseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.update(selectedContract.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      handleCloseForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  const qc = useQueryClient();

  // Filter contracts
  const filteredContracts = contracts.filter(c => {
    const searchLower = search.toLowerCase();
    const matchSearch = !search || 
      c.driver_name?.toLowerCase().includes(searchLower) ||
      c.vehicle_info?.toLowerCase().includes(searchLower);
    
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  const handleOpenForm = (contract = null) => {
    if (contract) {
      setSelectedContract(contract);
      setFormData(contract);
    } else {
      setSelectedContract(null);
      setFormData({
        driver_id: '', driver_name: '', vehicle_id: '', vehicle_info: '',
        contract_type: 'slot_standard', slot_fee: '', weekly_rental_price: '',
        start_date: '', end_date: '', status: 'active', contract_file_url: '', notes: ''
      });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedContract(null);
  };

  const handleUploadContract = async (file) => {
    if (!file) return;
    const uploadRes = await base44.integrations.Core.UploadFile({ file });
    setFormData(p => ({ ...p, contract_file_url: uploadRes.file_url }));
  };

  const handleSave = () => {
    const data = {
      driver_id: formData.driver_id,
      driver_name: formData.driver_name,
      vehicle_id: formData.vehicle_id || undefined,
      vehicle_info: formData.vehicle_info || undefined,
      contract_type: formData.contract_type,
      slot_fee: formData.slot_fee ? parseFloat(formData.slot_fee) : undefined,
      weekly_rental_price: formData.weekly_rental_price ? parseFloat(formData.weekly_rental_price) : undefined,
      start_date: formData.start_date,
      end_date: formData.end_date || undefined,
      status: formData.status,
      contract_file_url: formData.contract_file_url || undefined,
      notes: formData.notes || undefined,
    };

    if (selectedContract) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDriverSelect = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      setFormData(p => ({ ...p, driver_id: driverId, driver_name: driver.full_name }));
    }
  };

  const handleVehicleSelect = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setFormData(p => ({ ...p, vehicle_id: vehicleId, vehicle_info: `${vehicle.brand} ${vehicle.model} - ${vehicle.license_plate}` }));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Contratos"
        subtitle={`${filteredContracts.length} contratos`}
        actionLabel={isAdmin || isFleetManager ? "Novo Contrato" : null}
        onAction={() => handleOpenForm()}
        actionIcon={Plus}
      />

      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por motorista ou veículo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {STATUS_OPTIONS.map(status => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                statusFilter === status.value
                  ? status.color
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : filteredContracts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum contrato encontrado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredContracts.map(contract => {
            const statusConfig = STATUS_OPTIONS.find(s => s.value === contract.status);
            const typeLabel = CONTRACT_TYPES.find(t => t.value === contract.contract_type)?.label;

            return (
              <div
                key={contract.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-gray-900">
                        {contract.driver_name}
                      </h3>
                      <Badge className={`text-xs border-0 ${statusConfig?.color || 'bg-gray-100 text-gray-700'}`}>
                        {statusConfig?.label || 'Desconhecido'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {contract.vehicle_info || '—'} • {typeLabel}
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400">Início</p>
                        <p className="font-semibold text-gray-900">
                          {contract.start_date ? format(new Date(contract.start_date), 'dd/MM/yyyy') : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Fim</p>
                        <p className="font-semibold text-gray-900">
                          {contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">{contract.contract_type === 'location' ? 'Aluguel' : 'Taxa'}</p>
                        <p className="font-semibold text-gray-900">
                          €{(contract.weekly_rental_price || contract.slot_fee || 0).toFixed(2)}/sem
                        </p>
                      </div>
                    </div>
                  </div>
                  {(isAdmin || isFleetManager) && (
                    <div className="flex gap-1 shrink-0">
                      {contract.contract_file_url && (
                        <button
                          onClick={() => window.open(contract.contract_file_url, '_blank')}
                          className="p-2 hover:bg-gray-100 rounded text-gray-600"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenForm(contract)}
                        className="p-2 hover:bg-gray-100 rounded text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(contract.id)}
                        className="p-2 hover:bg-red-100 rounded text-red-600"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedContract ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Motorista *</Label>
              <select
                value={formData.driver_id}
                onChange={e => handleDriverSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecionar motorista...</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Veículo</Label>
              <select
                value={formData.vehicle_id}
                onChange={e => handleVehicleSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Nenhum</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.license_plate}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Contrato *</Label>
              <select value={formData.contract_type} onChange={e => setFormData(p => ({ ...p, contract_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                {CONTRACT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início *</Label>
                <Input type="date" value={formData.start_date} onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="date" value={formData.end_date} onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            {formData.contract_type === 'location' ? (
              <div>
                <Label className="text-xs">Aluguel Semanal (€)</Label>
                <Input type="number" step="0.01" value={formData.weekly_rental_price} onChange={e => setFormData(p => ({ ...p, weekly_rental_price: e.target.value }))} placeholder="0.00" />
              </div>
            ) : (
              <div>
                <Label className="text-xs">Taxa Semanal (€)</Label>
                <Input type="number" step="0.01" value={formData.slot_fee} onChange={e => setFormData(p => ({ ...p, slot_fee: e.target.value }))} placeholder="0.00" />
              </div>
            )}
            <div>
              <Label className="text-xs">Estado</Label>
              <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Documento do Contrato</Label>
              <input
                type="file"
                onChange={e => handleUploadContract(e.target.files?.[0])}
                className="w-full text-sm"
              />
              {formData.contract_file_url && (
                <p className="text-xs text-green-600 mt-1">✓ Ficheiro carregado</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={2}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleCloseForm}>Cancelar</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending || !formData.driver_id || !formData.start_date}>
                {createMutation.isPending || updateMutation.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}