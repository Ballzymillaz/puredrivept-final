import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Eye, Check, X, AlertTriangle, Search, FileText, CreditCard,
  Car, Shield, FileCheck, IdCard, ChevronLeft, Plus, RefreshCw
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

const DOC_TYPES_DRIVER = [
  { key: 'driving_license', label: 'Carta de condução', icon: CreditCard },
  { key: 'tvde_certificate', label: 'Certificado TVDE', icon: FileCheck },
  { key: 'id_card', label: 'Cartão de cidadão', icon: IdCard },
  { key: 'iban_proof', label: 'Comprovativo IBAN', icon: FileText },
];

const DOC_TYPES_VEHICLE = [
  { key: 'insurance', label: 'Seguro do veículo', icon: Shield },
  { key: 'periodic_inspection', label: 'Inspeção periódica', icon: FileCheck },
  { key: 'vehicle_booklet', label: 'Livro do veículo', icon: FileText },
];

const DOC_TYPE_LABELS = {
  driving_license: 'Carta de condução',
  tvde_certificate: 'Certificado TVDE',
  id_card: 'Cartão de cidadão',
  iban_proof: 'Comprovativo IBAN',
  insurance: 'Seguro',
  periodic_inspection: 'Inspeção periódica',
  vehicle_booklet: 'Livro do veículo',
};

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return { label: 'Sem data', color: 'bg-gray-100 text-gray-500', status: 'none' };
  const days = differenceInDays(new Date(expiryDate), new Date());
  if (days < 0) return { label: 'Expirado', color: 'bg-red-100 text-red-700', status: 'expired' };
  if (days <= 30) return { label: `${days}d`, color: 'bg-orange-100 text-orange-700', status: 'expiring' };
  return { label: format(new Date(expiryDate), 'dd/MM/yy'), color: 'bg-green-100 text-green-700', status: 'valid' };
}

export default function Documents({ currentUser }) {
  const [tab, setTab] = useState('driver'); // 'driver' | 'vehicle'
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [quickFilter, setQuickFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ document_type: '', expiry_date: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState(null);
  const qc = useQueryClient();

  const isDriver = currentUser?.role === 'driver';
  const isFleetManager = currentUser?.role === 'fleet_manager';

  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: allVehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  // Fleet manager: only their affiliated drivers and vehicles
  const drivers = isFleetManager
    ? allDrivers.filter(d => d.fleet_manager_id === currentUser?.id || d.fleet_manager_id === currentUser?.email)
    : allDrivers;

  const vehicles = isFleetManager
    ? allVehicles.filter(v => v.fleet_manager_id === currentUser?.id || v.fleet_manager_id === currentUser?.email || drivers.some(d => d.id === v.assigned_driver_id))
    : allVehicles;
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date'),
  });

  const myDriverRecord = isDriver ? drivers.find(d => d.email === currentUser?.email) : null;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Document.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); setShowUpload(false); setReplacingDoc(null); resetUpload(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const resetUpload = () => { setUploadForm({ document_type: '', expiry_date: '' }); setUploadFile(null); };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    let file_url = '';
    if (uploadFile) {
      const res = await base44.integrations.Core.UploadFile({ file: uploadFile });
      file_url = res.file_url;
    }
    const ownerType = tab;
    const ownerId = selectedEntity?.id;
    const ownerName = tab === 'driver' ? selectedEntity?.full_name : `${selectedEntity?.brand} ${selectedEntity?.model} - ${selectedEntity?.license_plate}`;

    // If replacing, delete old doc first
    if (replacingDoc) {
      await deleteMutation.mutateAsync(replacingDoc.id);
    }

    await createMutation.mutateAsync({ owner_type: ownerType, owner_id: ownerId, owner_name: ownerName, ...uploadForm, file_url, status: 'pending' });
    setUploading(false);
  };

  // Filtered entity list
  const entityList = isDriver
    ? (myDriverRecord ? [myDriverRecord] : [])
    : tab === 'driver'
      ? drivers.filter(d => !search || d.full_name?.toLowerCase().includes(search.toLowerCase()))
      : vehicles.filter(v => !search || `${v.brand} ${v.model} ${v.license_plate}`.toLowerCase().includes(search.toLowerCase()));

  // Filter documents to only show relevant ones
  const visibleEntityIds = new Set([
    ...drivers.map(d => d.id),
    ...vehicles.map(v => v.id),
    ...(myDriverRecord ? [myDriverRecord.id] : []),
  ]);

  // KPIs (scoped to visible entities)
  const allDocs = (isDriver || isFleetManager)
    ? documents.filter(d => visibleEntityIds.has(d.owner_id))
    : documents;
  const expiredCount = allDocs.filter(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) < 0).length;
  const expiringCount = allDocs.filter(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) >= 0 && differenceInDays(new Date(d.expiry_date), new Date()) <= 30).length;
  const expectedDocTypes = tab === 'driver' ? DOC_TYPES_DRIVER : DOC_TYPES_VEHICLE;
  const missingCount = entityList.reduce((acc, entity) => {
    const entityDocs = allDocs.filter(d => d.owner_id === entity.id);
    const missing = expectedDocTypes.filter(dt => !entityDocs.some(d => d.document_type === dt.key)).length;
    return acc + missing;
  }, 0);

  // Documents for selected entity
  const entityDocs = selectedEntity ? allDocs.filter(d => d.owner_id === selectedEntity.id) : [];

  // Quick filter applied to entity list
  const filteredEntities = entityList.filter(entity => {
    if (quickFilter === 'all') return true;
    const eDocs = allDocs.filter(d => d.owner_id === entity.id);
    if (quickFilter === 'expired') return eDocs.some(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) < 0);
    if (quickFilter === 'expiring') return eDocs.some(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) >= 0 && differenceInDays(new Date(d.expiry_date), new Date()) <= 30);
    if (quickFilter === 'missing') {
      const missing = expectedDocTypes.filter(dt => !eDocs.some(d => d.document_type === dt.key)).length;
      return missing > 0;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {selectedEntity ? (
              <button onClick={() => setSelectedEntity(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-base font-medium mb-1">
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
            ) : 'Documentos'}
          </h1>
          {selectedEntity && (
            <p className="text-lg font-bold text-gray-900">
              {tab === 'driver' ? selectedEntity.full_name : `${selectedEntity.brand} ${selectedEntity.model} — ${selectedEntity.license_plate}`}
            </p>
          )}
        </div>
        {selectedEntity && (
          <Button onClick={() => { resetUpload(); setShowUpload(true); }} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-4 h-4" /> Adicionar documento
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{expiredCount}</p>
            <p className="text-xs text-gray-500">Expirados</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{expiringCount}</p>
            <p className="text-xs text-gray-500">A expirar (&lt;30d)</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{missingCount}</p>
            <p className="text-xs text-gray-500">Em falta</p>
          </div>
        </div>
      </div>

      {!selectedEntity ? (
        <>
          {/* Tabs */}
          {!isDriver && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              <button onClick={() => { setTab('driver'); setQuickFilter('all'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'driver' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                Motoristas
              </button>
              <button onClick={() => { setTab('vehicle'); setQuickFilter('all'); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'vehicle' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                Veículos
              </button>
            </div>
          )}

          {/* Quick filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'expired', label: 'Expirados' },
              { key: 'expiring', label: 'Expiram em breve' },
              { key: 'missing', label: 'Em falta' },
            ].map(f => (
              <button key={f.key} onClick={() => setQuickFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${quickFilter === f.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Entity List */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {filteredEntities.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Nenhum registo encontrado</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      {tab === 'driver' ? 'Motorista' : 'Veículo'}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Documentos</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Em falta</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Alertas</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredEntities.map(entity => {
                    const eDocs = allDocs.filter(d => d.owner_id === entity.id);
                    const docTypes = tab === 'driver' ? DOC_TYPES_DRIVER : DOC_TYPES_VEHICLE;
                    const missingDocs = docTypes.filter(dt => !eDocs.some(d => d.document_type === dt.key));
                    const hasExpired = eDocs.some(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) < 0);
                    const hasExpiring = eDocs.some(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) >= 0 && differenceInDays(new Date(d.expiry_date), new Date()) <= 30);
                    return (
                      <tr key={entity.id} className="hover:bg-indigo-50/30 cursor-pointer transition-colors" onClick={() => setSelectedEntity(entity)}>
                        <td className="px-4 py-3">
                          {tab === 'driver' ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">{entity.full_name?.[0]}</div>
                              <div>
                                <p className="font-semibold text-sm text-gray-900">{entity.full_name}</p>
                                <p className="text-xs text-gray-400">{entity.email}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="font-semibold text-sm text-gray-900">{entity.brand} {entity.model}</p>
                                <p className="text-xs text-gray-400 font-mono">{entity.license_plate}</p>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-sm text-gray-600">{eDocs.length} / {docTypes.length}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {missingDocs.length > 0
                            ? <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{missingDocs.length} em falta</Badge>
                            : <Badge className="bg-green-100 text-green-700 border-0 text-xs">Completo</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {hasExpired && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Expirado</Badge>}
                            {hasExpiring && <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Expira</Badge>}
                            {!hasExpired && !hasExpiring && eDocs.length > 0 && <Badge className="bg-green-100 text-green-700 border-0 text-xs">OK</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-indigo-500 text-xs">›</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* Entity Detail — Document Cards */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(tab === 'driver' ? DOC_TYPES_DRIVER : DOC_TYPES_VEHICLE).map(docType => {
              const doc = entityDocs.find(d => d.document_type === docType.key);
              const expiry = doc ? getExpiryStatus(doc.expiry_date) : null;
              const Icon = docType.icon;
              return (
                <div key={docType.key} className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow ${!doc ? 'border-dashed border-gray-300' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${doc ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                        <Icon className={`w-4 h-4 ${doc ? 'text-indigo-600' : 'text-gray-400'}`} />
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{docType.label}</p>
                    </div>
                    {doc && expiry && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${expiry.color}`}>{expiry.label}</span>
                    )}
                  </div>

                  {doc ? (
                    <div className="space-y-2">
                      {doc.expiry_date && (
                        <p className="text-xs text-gray-500">Validade: {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}</p>
                      )}
                      <StatusBadge status={doc.status} />
                      <div className="flex gap-1 pt-1">
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </a>
                        )}
                        <button
                          onClick={() => { setReplacingDoc(doc); setUploadForm({ document_type: docType.key, expiry_date: '' }); setShowUpload(true); }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                          <RefreshCw className="w-3.5 h-3.5" /> Substituir
                        </button>
                        {doc.status === 'pending' && !isDriver && (
                          <>
                            <button onClick={() => updateMutation.mutate({ id: doc.id, data: { status: 'approved' } })}
                              className="p-1.5 border rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => updateMutation.mutate({ id: doc.id, data: { status: 'rejected' } })}
                              className="p-1.5 border rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-3 gap-2">
                      <p className="text-xs text-gray-400">Documento em falta</p>
                      <button
                        onClick={() => { setUploadForm({ document_type: docType.key, expiry_date: '' }); setShowUpload(true); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors">
                        <Upload className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={(o) => { if (!o) { setShowUpload(false); setReplacingDoc(null); resetUpload(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{replacingDoc ? 'Substituir documento' : 'Novo documento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            {!replacingDoc && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de documento</Label>
                <Select value={uploadForm.document_type} onValueChange={v => setUploadForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                  <SelectContent>
                    {(tab === 'driver' ? DOC_TYPES_DRIVER : DOC_TYPES_VEHICLE).map(dt => (
                      <SelectItem key={dt.key} value={dt.key}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {replacingDoc && (
              <p className="text-sm text-gray-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                Substituindo: <strong>{DOC_TYPE_LABELS[replacingDoc.document_type]}</strong>. O documento anterior será eliminado.
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Data de validade (opcional)</Label>
              <Input type="date" value={uploadForm.expiry_date} onChange={e => setUploadForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ficheiro (PDF ou imagem)</Label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setUploadFile(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById('doc-file-input').click()}
              >
                {uploadFile ? (
                  <p className="text-sm text-indigo-600 font-medium">{uploadFile.name}</p>
                ) : (
                  <div>
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Arraste ou clique para selecionar</p>
                  </div>
                )}
                <input id="doc-file-input" type="file" accept="image/*,.pdf" className="hidden" onChange={e => setUploadFile(e.target.files[0])} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => { setShowUpload(false); setReplacingDoc(null); resetUpload(); }}>Cancelar</Button>
              <Button type="submit" disabled={uploading || !uploadForm.document_type} className="bg-indigo-600 hover:bg-indigo-700">
                {uploading ? 'A enviar...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}