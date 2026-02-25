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
import { Upload, Eye, Check, X } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

const DOC_TYPE_LABELS = {
  driving_license: 'Permis de conduire',
  tvde_certificate: 'Certificat TVDE',
  id_card: "Pièce d'identité",
  iban_proof: 'Justificatif IBAN',
  insurance: 'Assurance',
  periodic_inspection: 'Contrôle technique',
  vehicle_booklet: 'Livret du véhicule',
};

export default function Documents() {
  const [showForm, setShowForm] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const qc = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); setSelectedDoc(null); },
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Document.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); setShowForm(false); },
  });

  const [form, setForm] = useState({ owner_type: 'driver', owner_id: '', owner_name: '', document_type: '', expiry_date: '' });
  const [file, setFile] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    let file_url = '';
    if (file) {
      const res = await base44.integrations.Core.UploadFile({ file });
      file_url = res.file_url;
    }
    await createMutation.mutateAsync({ ...form, file_url, status: 'pending' });
    setFile(null);
  };

  const getExpiryBadge = (doc) => {
    if (!doc.expiry_date) return null;
    const days = differenceInDays(new Date(doc.expiry_date), new Date());
    if (days < 0) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Expiré</span>;
    if (days <= 3) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{days}j</span>;
    if (days <= 7) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{days}j</span>;
    if (days <= 15) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{days}j</span>;
    return <span className="text-xs text-gray-500">{format(new Date(doc.expiry_date), 'dd/MM/yyyy')}</span>;
  };

  const columns = [
    { header: 'Propriétaire', render: (r) => (<div><p className="text-sm font-medium">{r.owner_name}</p><p className="text-xs text-gray-500 capitalize">{r.owner_type}</p></div>) },
    { header: 'Type', render: (r) => <span className="text-sm">{DOC_TYPE_LABELS[r.document_type] || r.document_type}</span> },
    { header: 'Échéance', render: (r) => getExpiryBadge(r) },
    { header: 'Statut', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Actions', render: (r) => (
        <div className="flex gap-1">
          {r.file_url && <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-100 rounded"><Eye className="w-4 h-4 text-gray-500" /></a>}
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
      <PageHeader title="Documents" subtitle={`${documents.length} documents`} actionLabel="Ajouter" actionIcon={Upload} onAction={() => setShowForm(true)} />
      <DataTable columns={columns} data={documents} isLoading={isLoading} />
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau document</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Type propriétaire</Label>
                <Select value={form.owner_type} onValueChange={(v) => setForm(f => ({...f, owner_type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">Chauffeur</SelectItem>
                    <SelectItem value="fleet_manager">Gestionnaire</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="vehicle">Véhicule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Nom propriétaire</Label><Input value={form.owner_name} onChange={(e) => setForm(f => ({...f, owner_name: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">ID propriétaire</Label><Input value={form.owner_id} onChange={(e) => setForm(f => ({...f, owner_id: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Type de document</Label>
                <Select value={form.document_type} onValueChange={(v) => setForm(f => ({...f, document_type: v}))}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Date d'échéance</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm(f => ({...f, expiry_date: e.target.value}))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fichier</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files[0])} accept="image/*,.pdf" />
            </div>
            <div className="flex justify-end"><Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">{createMutation.isPending ? 'Upload...' : 'Enregistrer'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}