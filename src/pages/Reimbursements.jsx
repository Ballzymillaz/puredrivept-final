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
import { Check, X, Eye } from 'lucide-react';
import { format } from 'date-fns';

const CAT_LABELS = { fuel: 'Carburant', maintenance: 'Entretien', cleaning: 'Nettoyage', tolls: 'Péages', other: 'Autre' };

export default function Reimbursements() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: reimbursements = [], isLoading } = useQuery({
    queryKey: ['reimbursements'],
    queryFn: () => base44.entities.Reimbursement.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Reimbursement.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reimbursements'] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Reimbursement.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reimbursements'] }),
  });

  const [form, setForm] = useState({ driver_name: '', category: 'fuel', amount: '', description: '' });
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let receipt_url = '';
    if (file) {
      const res = await base44.integrations.Core.UploadFile({ file });
      receipt_url = res.file_url;
    }
    await createMutation.mutateAsync({ ...form, driver_id: form.driver_name, amount: parseFloat(form.amount), receipt_url, status: 'pending' });
    setFile(null);
  };

  const fmt = (v) => `€${(v || 0).toFixed(2)}`;

  const columns = [
    { header: 'Chauffeur', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Catégorie', render: (r) => <span className="text-sm">{CAT_LABELS[r.category] || r.category}</span> },
    { header: 'Montant', render: (r) => <span className="font-medium">{fmt(r.amount)}</span> },
    { header: 'Date', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_date), 'dd/MM/yyyy')}</span> },
    { header: 'Statut', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Actions', render: (r) => (
        <div className="flex gap-1">
          {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-100 rounded"><Eye className="w-4 h-4 text-gray-500" /></a>}
          {r.status === 'pending' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: r.id, data: { status: 'approved' } }); }} className="p-1.5 hover:bg-emerald-50 rounded"><Check className="w-4 h-4 text-emerald-600" /></button>
              <button onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: r.id, data: { status: 'rejected' } }); }} className="p-1.5 hover:bg-red-50 rounded"><X className="w-4 h-4 text-red-500" /></button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Remboursements" subtitle={`${reimbursements.length} demandes`} actionLabel="Nouvelle demande" onAction={() => setShowForm(true)} />
      <DataTable columns={columns} data={reimbursements} isLoading={isLoading} />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Demande de remboursement</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Chauffeur</Label><Input value={form.driver_name} onChange={(e) => setForm(f => ({...f, driver_name: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({...f, category: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Montant (€)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({...f, amount: e.target.value}))} required /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} rows={2} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Justificatif</Label><Input type="file" onChange={(e) => setFile(e.target.files[0])} accept="image/*,.pdf" /></div>
            <Button type="submit" disabled={createMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">{createMutation.isPending ? 'Envoi...' : 'Envoyer'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}