import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function VehicleForm({ vehicle, onSubmit, isLoading, drivers }) {
  const [form, setForm] = useState({
    brand: vehicle?.brand || '',
    model: vehicle?.model || '',
    year: vehicle?.year || '',
    license_plate: vehicle?.license_plate || '',
    color: vehicle?.color || '',
    vin: vehicle?.vin || '',
    status: vehicle?.status || 'available',
    assigned_driver_id: vehicle?.assigned_driver_id || '',
    fuel_type: vehicle?.fuel_type || '',
    mileage: vehicle?.mileage || '',
    weekly_rental_price: vehicle?.weekly_rental_price || '',
    base_purchase_price: vehicle?.base_purchase_price || '',
    insurance_expiry: vehicle?.insurance_expiry || '',
    inspection_expiry: vehicle?.inspection_expiry || '',
    notes: vehicle?.notes || '',
  });

  const availableDrivers = drivers?.filter(d => !d.assigned_vehicle_id || d.id === form.assigned_driver_id) || [];

  const handleChange = (f, v) => setForm(s => ({ ...s, [f]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    ['year', 'mileage', 'weekly_rental_price', 'base_purchase_price'].forEach(k => {
      if (data[k]) data[k] = parseFloat(data[k]);
    });

    // Assign driver info
    if (data.assigned_driver_id) {
      const driver = drivers?.find(d => d.id === data.assigned_driver_id);
      if (driver) data.assigned_driver_name = driver.full_name;
    } else {
      data.assigned_driver_id = null;
      data.assigned_driver_name = null;
    }

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label className="text-xs">Marca *</Label><Input value={form.brand} onChange={(e) => handleChange('brand', e.target.value)} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">Modelo *</Label><Input value={form.model} onChange={(e) => handleChange('model', e.target.value)} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">Ano</Label><Input type="number" value={form.year} onChange={(e) => handleChange('year', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Matrícula *</Label><Input value={form.license_plate} onChange={(e) => handleChange('license_plate', e.target.value)} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">Cor</Label><Input value={form.color} onChange={(e) => handleChange('color', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Combustível</Label>
          <Select value={form.fuel_type} onValueChange={(v) => handleChange('fuel_type', v)}>
            <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gasoline">Gasolina</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="hybrid">Híbrido</SelectItem>
              <SelectItem value="electric">Elétrico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">Quilometragem</Label><Input type="number" value={form.mileage} onChange={(e) => handleChange('mileage', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Aluguer/sem (€)</Label><Input type="number" step="0.01" value={form.weekly_rental_price} onChange={(e) => handleChange('weekly_rental_price', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Preço base compra (€)</Label><Input type="number" step="0.01" value={form.base_purchase_price} onChange={(e) => handleChange('base_purchase_price', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Expiração seguro</Label><Input type="date" value={form.insurance_expiry} onChange={(e) => handleChange('insurance_expiry', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Expiração inspeção</Label><Input type="date" value={form.inspection_expiry} onChange={(e) => handleChange('inspection_expiry', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
          <Select value={form.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Disponível</SelectItem>
              <SelectItem value="assigned">Atribuído</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Motorista (opcional)</Label>
          <Select value={form.assigned_driver_id} onValueChange={(v) => handleChange('assigned_driver_id', v)}>
            <SelectTrigger><SelectValue placeholder="Sem motorista ou selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Nenhum</SelectItem>
              {availableDrivers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.full_name} ({d.email})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Notas</Label><Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={2} /></div>
      <div className="flex justify-end"><Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">{isLoading ? 'A guardar...' : vehicle ? 'Atualizar' : 'Criar veículo'}</Button></div>
    </form>
  );
}