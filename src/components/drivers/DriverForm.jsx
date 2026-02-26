import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function DriverForm({ driver, onSubmit, isLoading, vehicles, commercials, fleetManagers }) {
  const [form, setForm] = useState({
    full_name: driver?.full_name || '',
    email: driver?.email || '',
    phone: driver?.phone || '',
    nif: driver?.nif || '',
    address: driver?.address || '',
    date_of_birth: driver?.date_of_birth || '',
    status: driver?.status || 'pending',
    contract_type: driver?.contract_type || '',
    assigned_vehicle_id: driver?.assigned_vehicle_id || '',
    commercial_id: driver?.commercial_id || '',
    fleet_manager_id: driver?.fleet_manager_id || '',
    iva_regime: driver?.iva_regime || 'exempt',
    irs_retention_rate: driver?.irs_retention_rate || '',
    iban: driver?.iban || '',
    uber_uuid: driver?.uber_uuid || '',
    bolt_id: driver?.bolt_id || '',
    notes: driver?.notes || '',
  });

  // Frais et commission automatiques selon le type de contrat
  const CONTRACT_CONFIG = {
    slot_standard: { slot_fee: 35, commission_rate: 0 },
    slot_premium: { slot_fee: 45, commission_rate: 0 },
    slot_black: { slot_fee: 99, commission_rate: 0 },
    location: { slot_fee: 0, commission_rate: 20 },
  };

  const availableVehicles = vehicles?.filter(v => v.status === 'available' || v.id === form.assigned_vehicle_id) || [];

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    
    // Auto-assign slot_fee et commission_rate selon contract_type
    if (data.contract_type && CONTRACT_CONFIG[data.contract_type]) {
      data.slot_fee = CONTRACT_CONFIG[data.contract_type].slot_fee;
      data.commission_rate = CONTRACT_CONFIG[data.contract_type].commission_rate;
    }

    // Assign vehicle info
    if (data.assigned_vehicle_id) {
      const vehicle = vehicles?.find(v => v.id === data.assigned_vehicle_id);
      if (vehicle) {
        data.assigned_vehicle_plate = vehicle.license_plate;
      }
    } else {
      data.assigned_vehicle_id = null;
      data.assigned_vehicle_plate = null;
    }

    // Assign commercial info
    if (data.commercial_id) {
      const commercial = commercials?.find(c => c.id === data.commercial_id);
      if (commercial) data.commercial_name = commercial.full_name;
    } else {
      data.commercial_id = null;
      data.commercial_name = null;
    }

    // Assign fleet manager info
    if (data.fleet_manager_id) {
      const fm = fleetManagers?.find(f => f.id === data.fleet_manager_id);
      if (fm) data.fleet_manager_name = fm.full_name;
    } else {
      data.fleet_manager_id = null;
      data.fleet_manager_name = null;
    }
    
    // Supprimer les champs numériques vides
    if (!data.irs_retention_rate) delete data.irs_retention_rate;
    else data.irs_retention_rate = parseFloat(data.irs_retention_rate);
    
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Nome completo *</Label>
          <Input value={form.full_name} onChange={(e) => handleChange('full_name', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email *</Label>
          <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Telefone *</Label>
          <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">NIF</Label>
          <Input value={form.nif} onChange={(e) => handleChange('nif', e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Morada</Label>
          <Input value={form.address} onChange={(e) => handleChange('address', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de nascimento</Label>
          <Input type="date" value={form.date_of_birth} onChange={(e) => handleChange('date_of_birth', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Estado</Label>
          <Select value={form.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
              <SelectItem value="evaluation">Avaliação</SelectItem>
              <SelectItem value="suspended">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Tipo de contrato</Label>
          <Select value={form.contract_type} onValueChange={(v) => handleChange('contract_type', v)}>
            <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="slot_standard">Slot Standard (35€/sem)</SelectItem>
              <SelectItem value="slot_premium">Slot Premium (45€/sem)</SelectItem>
              <SelectItem value="slot_black">Slot Black (99€/sem)</SelectItem>
              <SelectItem value="location">Aluguer de veículo</SelectItem>
            </SelectContent>
          </Select>
          {form.contract_type && CONTRACT_CONFIG[form.contract_type] && (
            <p className="text-xs text-gray-500 mt-1">
              {CONTRACT_CONFIG[form.contract_type].slot_fee > 0 
                ? `Taxa de slot: ${CONTRACT_CONFIG[form.contract_type].slot_fee}€/semana`
                : `Sem comissão - preço aluguer semanal do veículo`}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Veículo (opcional)</Label>
          <Select value={form.assigned_vehicle_id} onValueChange={(v) => handleChange('assigned_vehicle_id', v)}>
            <SelectTrigger><SelectValue placeholder="Sem veículo ou selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Nenhum</SelectItem>
              {availableVehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.license_plate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Comercial (opcional)</Label>
          <Select value={form.commercial_id} onValueChange={(v) => handleChange('commercial_id', v)}>
            <SelectTrigger><SelectValue placeholder="Nenhum..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Nenhum</SelectItem>
              {commercials?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Gestor de frota (opcional)</Label>
          <Select value={form.fleet_manager_id} onValueChange={(v) => handleChange('fleet_manager_id', v)}>
            <SelectTrigger><SelectValue placeholder="Nenhum..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Nenhum</SelectItem>
              {fleetManagers?.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Regime IVA</Label>
          <Select value={form.iva_regime} onValueChange={(v) => handleChange('iva_regime', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exempt">Isento</SelectItem>
              <SelectItem value="6_percent">6%</SelectItem>
              <SelectItem value="23_percent">23%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">IBAN</Label>
          <Input value={form.iban} onChange={(e) => handleChange('iban', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">UUID Uber</Label>
          <Input value={form.uber_uuid} onChange={(e) => handleChange('uber_uuid', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">ID Bolt</Label>
          <Input value={form.bolt_id} onChange={(e) => handleChange('bolt_id', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notas internas</Label>
        <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
          {isLoading ? 'A guardar...' : driver ? 'Atualizar' : 'Criar motorista'}
        </Button>
      </div>
    </form>
  );
}