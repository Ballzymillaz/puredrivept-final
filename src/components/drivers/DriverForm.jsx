import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function DriverForm({ driver, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    full_name: driver?.full_name || '',
    email: driver?.email || '',
    phone: driver?.phone || '',
    nif: driver?.nif || '',
    address: driver?.address || '',
    date_of_birth: driver?.date_of_birth || '',
    status: driver?.status || 'pending',
    contract_type: driver?.contract_type || '',
    slot_fee: driver?.slot_fee || '',
    commission_rate: driver?.commission_rate || '',
    iva_regime: driver?.iva_regime || 'exempt',
    irs_retention_rate: driver?.irs_retention_rate || '',
    iban: driver?.iban || '',
    uber_uuid: driver?.uber_uuid || '',
    bolt_id: driver?.bolt_id || '',
    notes: driver?.notes || '',
  });

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (data.slot_fee) data.slot_fee = parseFloat(data.slot_fee);
    if (data.commission_rate) data.commission_rate = parseFloat(data.commission_rate);
    if (data.irs_retention_rate) data.irs_retention_rate = parseFloat(data.irs_retention_rate);
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Nom complet *</Label>
          <Input value={form.full_name} onChange={(e) => handleChange('full_name', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email *</Label>
          <Input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Téléphone *</Label>
          <Input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">NIF</Label>
          <Input value={form.nif} onChange={(e) => handleChange('nif', e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Adresse</Label>
          <Input value={form.address} onChange={(e) => handleChange('address', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date de naissance</Label>
          <Input type="date" value={form.date_of_birth} onChange={(e) => handleChange('date_of_birth', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Statut</Label>
          <Select value={form.status} onValueChange={(v) => handleChange('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
              <SelectItem value="evaluation">Évaluation</SelectItem>
              <SelectItem value="suspended">Suspendu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type de contrat</Label>
          <Select value={form.contract_type} onValueChange={(v) => handleChange('contract_type', v)}>
            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="slot_standard">Slot Standard (35€)</SelectItem>
              <SelectItem value="slot_premium">Slot Premium (45€)</SelectItem>
              <SelectItem value="slot_black">Slot Black (99€)</SelectItem>
              <SelectItem value="location">Location véhicule</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Frais de slot (€/sem)</Label>
          <Input type="number" step="0.01" value={form.slot_fee} onChange={(e) => handleChange('slot_fee', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Taux de commission (%)</Label>
          <Input type="number" step="0.01" value={form.commission_rate} onChange={(e) => handleChange('commission_rate', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Régime IVA</Label>
          <Select value={form.iva_regime} onValueChange={(v) => handleChange('iva_regime', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exempt">Exempt</SelectItem>
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
        <Label className="text-xs">Notes internes</Label>
        <Textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
          {isLoading ? 'Enregistrement...' : driver ? 'Modifier' : 'Créer le chauffeur'}
        </Button>
      </div>
    </form>
  );
}