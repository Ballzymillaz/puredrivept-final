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
import { Textarea } from '@/components/ui/textarea';

export default function FleetManagers() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: managers = [], isLoading } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.FleetManager.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-managers'] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FleetManager.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet-managers'] }); setShowForm(false); setEditing(null); },
  });

  const [form, setForm] = useState({});
  const openForm = (mgr) => {
    setEditing(mgr);
    setForm({
      full_name: mgr?.full_name || '', email: mgr?.email || '', phone: mgr?.phone || '',
      nif: mgr?.nif || '', iban: mgr?.iban || '', status: mgr?.status || 'pending',
      referral_code: mgr?.referral_code || '', notes: mgr?.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate({ ...form, referral_code: form.referral_code || `FM-${Date.now().toString(36).toUpperCase()}` });
  };

  const columns = [
    {
      header: 'Gestionnaire', render: (r) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{r.full_name}</p>
          <p className="text-xs text-gray-500">{r.email}</p>
        </div>
      ),
    },
    { header: 'Téléphone', accessor: 'phone' },
    { header: 'Code parrainage', render: (r) => <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{r.referral_code || '—'}</span> },
    { header: 'Chauffeurs', render: (r) => r.total_drivers || 0 },
    { header: 'Statut', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Gestionnaires de flottes" subtitle={`${managers.length} gestionnaires`} actionLabel="Ajouter" onAction={() => openForm(null)} />
      <DataTable columns={columns} data={managers} isLoading={isLoading} onRowClick={openForm} />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Modifier' : 'Nouveau gestionnaire'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Nom complet *</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({...f, full_name: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Téléphone *</Label><Input value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">NIF</Label><Input value={form.nif} onChange={(e) => setForm(f => ({...f, nif: e.target.value}))} /></div>
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
            <div className="space-y-1.5"><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} rows={2} /></div>
            <div className="flex justify-end"><Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">{editing ? 'Modifier' : 'Créer'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}