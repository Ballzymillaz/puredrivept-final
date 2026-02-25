import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Commercials() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: commercials = [], isLoading } = useQuery({
    queryKey: ['commercials'],
    queryFn: () => base44.entities.Commercial.list('-created_date'),
  });
  const { data: managers = [] } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Commercial.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commercials'] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Commercial.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commercials'] }); setShowForm(false); setEditing(null); },
  });

  const [form, setForm] = useState({});
  const openForm = (c) => {
    setEditing(c);
    setForm({
      full_name: c?.full_name || '', email: c?.email || '', phone: c?.phone || '',
      nif: c?.nif || '', iban: c?.iban || '', status: c?.status || 'pending',
      fleet_manager_id: c?.fleet_manager_id || '', fleet_manager_name: c?.fleet_manager_name || '',
      referral_code: c?.referral_code || '', notes: c?.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, referral_code: form.referral_code || `CM-${Date.now().toString(36).toUpperCase()}` };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const columns = [
    { header: 'Commercial', render: (r) => (<div><p className="font-medium text-sm">{r.full_name}</p><p className="text-xs text-gray-500">{r.email}</p></div>) },
    { header: 'Gestionnaire', render: (r) => <span className="text-sm">{r.fleet_manager_name || '—'}</span> },
    { header: 'Code', render: (r) => <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{r.referral_code || '—'}</span> },
    { header: 'Chauffeurs', render: (r) => r.total_drivers || 0 },
    { header: 'Statut', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Commerciaux" subtitle={`${commercials.length} commerciaux`} actionLabel="Ajouter" onAction={() => openForm(null)} />
      <DataTable columns={columns} data={commercials} isLoading={isLoading} onRowClick={openForm} />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Modifier' : 'Nouveau commercial'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Nom complet *</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({...f, full_name: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Téléphone *</Label><Input value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Gestionnaire</Label>
                <Select value={form.fleet_manager_id} onValueChange={(v) => {
                  const mgr = managers.find(m => m.id === v);
                  setForm(f => ({...f, fleet_manager_id: v, fleet_manager_name: mgr?.full_name || ''}));
                }}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>{managers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">IBAN</Label><Input value={form.iban} onChange={(e) => setForm(f => ({...f, iban: e.target.value}))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({...f, status: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end"><Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">{editing ? 'Modifier' : 'Créer'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}