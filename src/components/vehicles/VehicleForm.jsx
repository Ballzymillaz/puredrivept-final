import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function VehicleForm({ vehicle, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    brand: vehicle?.brand || '',
    model: vehicle?.model || '',
    year: vehicle?.year || '',
    license_plate: vehicle?.license_plate || '',
    color: vehicle?.color || '',
    vin: vehicle?.vin || '',
    status: vehicle?.status || 'available',
    fuel_type: vehicle?.fuel_type || '',
    mileage: vehicle?.mileage || '',
    weekly_rental_price: vehicle?.weekly_rental_price || '',
    base_purchase_price: vehicle?.base_purchase_price || '',
    insurance_expiry: vehicle?.insurance_expiry || '',
    inspection_expiry: vehicle?.inspection_expiry || '',
    notes: vehicle?.notes || '',
  });

  const handleChange = (f, v) => setForm(s => ({ ...s, [f]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    ['year', 'mileage', 'weekly_rental_price', 'base_purchase_price'].forEach(k => {
      if (data[k]) data[k] = parseFloat(data[k]);
    });
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label className="text-xs">Marque *</Label><Input value={form.brand} onChange={(e) => handleChange('brand', e.target.value)} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">Modèle *</Label><Input value={form.model} onChange={(e) => handleChange('model', e.target.value)} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">Année</Label><Input type="number" value={form.year} onChange={(e) => handleChange('year', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Immatriculation *</Label><Input value={form.license_plate} onChange={(e) => handleChange('license_plate', e.target.value)} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">Couleur</Label><Input value={form.color} onChange={(e) => handleChange('color', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Carburant</Label>
          <Select value={form.fuel_type} onValueChange={(v) => handleChange('fuel_type', v)}>
            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gasoline">Essence</SelectItem>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="hybrid">Hybride</SelectItem>
              <SelectItem value="electric">Électrique</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">Kilométrage</Label><Input type="number" value={form.mileage} onChange={(e) => handleChange('mileage', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Location/sem (€)</Label><Input type="number" step="0.01" value={form.weekly_rental_price} onChange={(e) => handleChange('weekly_rental_price', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Prix de base achat (€)</Label><Input type="number" step="0.01" value={form.base_purchase_price} onChange={(e) => handleChange('base_purchase_price', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Expiration assurance</Label><Input type="date" value={form.insurance_expiry} onChange={(e) => handleChange('insurance_expiry', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Expiration contrôle</Label><Input type="date" value={form.inspection_expiry} onChange={(e) => handleChange('inspection_expiry', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Statut</Label>
          <Select value={form.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Disponible</SelectItem>
              <SelectItem value="assigned">Attribué</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={2} /></div>
      <div className="flex justify-end"><Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">{isLoading ? '...' : vehicle ? 'Modifier' : 'Créer'}</Button></div>
    </form>
  );
}