import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Eye, Check, X, AlertTriangle, Search } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

const DOC_TYPE_LABELS = {
  driving_license: 'Carta de condução',
  tvde_certificate: 'Certificado TVDE',
  id_card: 'Cartão de cidadão',
  iban_proof: 'Comprovativo IBAN',
  insurance: 'Seguro',
  periodic_inspection: 'Inspeção periódica',
  vehicle_booklet: 'Livro do veículo',
};

export default function Documents() {
  const [showForm, setShowForm] = useState(false);
  const [ownerTypeFilter, setOwnerTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ owner_type: 'driver', owner_id: '', owner_name: '', document_type: '', expiry_date: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Document.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); setShowForm(false); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const resetForm = () => {
    setForm({ owner_type: 'driver', owner_id: '', owner_name: '', document_type: '', expiry_date: '' });
    setFile(null);
  };

  const handleOwnerSelect = (ownerId) => {
    let name = '';
    if (form.owner_type === 'driver') {
      name = drivers.find(d => d.id === ownerId)?.full_name || '';
    } else if (form.owner_type === 'vehicle') {
      const v = vehicles.find(v => v.id === ownerId);
      name = v ? `${v.brand} ${v.model} - ${v.license_plate}` : '';
    }
    setForm(f => ({ ...f, owner_id: ownerId, owner_name: name }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    let file_url = '';
    if (file) {
      const res = await base44.integrations.Core.UploadFile({ file });
      file_url = res.file_url;
    }
    await createMutation.mutateAsync({ ...form, file_url, status: 'pending' });
    setUploading(false);
  };

  const getExpiryInfo = (doc) => {
    if (!doc.expiry_date) return null;
    const days = differenceInDays(new Date(doc.expiry_date), new Date());
    if (days < 0) return { label: 'Expirado', color: 'bg-red-100 text-red-700' };
    if (days <= 7) return { label: `${days}d ⚠️`, color: 'bg-red-100 text-red-700' };
    if (days <= 30) return { label: `${days}d`, color: 'bg-orange-100 text-orange-700' };
    if (days <= 90) return { label: format(new Date(doc.expiry_date), 'dd/MM/yy'), color: 'bg-yellow-100 text-yellow-700' };
    return { label: format(new Date(doc.expiry_date), 'dd/MM/yy'), color: 'bg-gray-100 text-gray-600' };
  };

  const expiringCount = documents.filter(d => {
    if (!d.expiry_date) return false;
    return differenceInDays(new Date(d.expiry_date), new Date()) <= 30;
  }).length;

  const filtered = documents.filter(d => {
    if (ownerTypeFilter !== 'all' && d.owner_type !== ownerTypeFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search && !d.owner_name?.toLowerCase().includes(search.toLowerCase()) &&
        !DOC_TYPE_LABELS[d.document_type]?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Documentos"
        subtitle={`${documents.length} documentos`}
        actionLabel="Adicionar"
        actionIcon={Upload}
        onAction={() => { resetForm(); setShowForm(true); }}
      >
        {expiringCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {expiringCount} a expirar em 30 dias
          </div>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48" />
        </div>
        <Select value={ownerTypeFilter} onValueChange={setOwnerTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="driver">Motoristas</SelectItem>
            <SelectItem value="vehicle">Veículos</SelectItem>
            <SelectItem value="fleet_manager">Gestores</SelectItem>
            <SelectItem value="commercial">Comerciais</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <p className="text-center py-8 text-gray-400 text-sm">A carregar...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">Nenhum documento encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Proprietário</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Tipo</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Validade</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Estado</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(r => {
                const expiry = getExpiryInfo(r);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{r.owner_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{r.owner_type}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{DOC_TYPE_LABELS[r.document_type] || r.document_type}</td>
                    <td className="py-3 px-4">
                      {expiry ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${expiry.color}`}>{expiry.label}</span>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {r.file_url && (
                          <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-100 rounded">
                            <Eye className="w-4 h-4 text-gray-500" />
                          </a>
                        )}
                        {r.status === 'pending' && (
                          <>
                            <button onClick={() => updateMutation.mutate({ id: r.id, data: { status: 'approved' } })} className="p-1.5 hover:bg-emerald-50 rounded">
                              <Check className="w-4 h-4 text-emerald-600" />
                            </button>
                            <button onClick={() => updateMutation.mutate({ id: r.id, data: { status: 'rejected' } })} className="p-1.5 hover:bg-red-50 rounded">
                              <X className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                        <button onClick={() => { if (confirm('Eliminar documento?')) deleteMutation.mutate(r.id); }} className="p-1.5 hover:bg-red-50 rounded">
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de proprietário</Label>
              <Select value={form.owner_type} onValueChange={(v) => setForm(f => ({ ...f, owner_type: v, owner_id: '', owner_name: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="driver">Motorista</SelectItem>
                  <SelectItem value="vehicle">Veículo</SelectItem>
                  <SelectItem value="fleet_manager">Gestor de frota</SelectItem>
                  <SelectItem value="commercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.owner_type === 'driver' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Motorista</Label>
                <Select value={form.owner_id} onValueChange={handleOwnerSelect}>
                  <SelectTrigger><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.owner_type === 'vehicle' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Veículo</Label>
                <Select value={form.owner_id} onValueChange={handleOwnerSelect}>
                  <SelectTrigger><SelectValue placeholder="Escolher veículo..." /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.license_plate}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(form.owner_type === 'fleet_manager' || form.owner_type === 'commercial') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} required />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de documento</Label>
              <Select value={form.document_type} onValueChange={(v) => setForm(f => ({ ...f, document_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data de validade</Label>
              <Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ficheiro (PDF ou imagem)</Label>
              <Input type="file" onChange={e => setFile(e.target.files[0])} accept="image/*,.pdf" />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={uploading || !form.document_type || !form.owner_id} className="bg-indigo-600 hover:bg-indigo-700">
                {uploading ? 'A enviar...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}