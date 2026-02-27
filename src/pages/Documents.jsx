import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, AlertTriangle, CheckCircle2, Clock, Trash2, Download, Search } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';

const DOC_TYPES = [
  { value: 'driving_license', label: 'Carta de Condução' },
  { value: 'id_card', label: 'CC/Passaporte' },
  { value: 'tvde_certificate', label: 'Certificado TVDE' },
  { value: 'iban_proof', label: 'Comprovativo IBAN' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'inspection', label: 'Inspeção Técnica' },
  { value: 'other', label: 'Outro' },
];

const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

export default function Documents({ currentUser }) {
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ doc_type: '', expiry_date: '', file: null });
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const isAdmin = currentUser?.role?.includes('admin') || currentUser?.role?.includes('fleet_manager');
  const isDriver = currentUser?.role?.includes('driver');

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      if (isDriver) {
        return await base44.entities.Document.filter({ created_by: currentUser.email });
      }
      return await base44.entities.Document.list('-updated_date');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, rejection_reason }) => 
      base44.entities.Document.update(id, { status, rejection_reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      setSelectedDoc(null);
    },
  });

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.doc_type) return;
    setUploading(true);

    const fileData = new FormData();
    fileData.append('file', uploadForm.file);
    const uploadRes = await base44.integrations.Core.UploadFile({ file: uploadForm.file });

    const docRecord = await base44.entities.Document.create({
      doc_type: uploadForm.doc_type,
      driver_id: isDriver ? currentUser?.id : '',
      driver_email: currentUser?.email,
      file_url: uploadRes.file_url,
      expiry_date: uploadForm.expiry_date || null,
      status: 'pending',
    });

    // Alert admin of new document
    if (isDriver) {
      await base44.entities.Notification.create({
        title: `📄 Novo documento submetido — ${currentUser.full_name}`,
        message: `${DOC_TYPES.find(d => d.value === uploadForm.doc_type)?.label || uploadForm.doc_type} foi submetido para revisão.`,
        type: 'info',
        category: 'document_expiry',
        recipient_role: 'admin',
        related_entity: docRecord.id,
      });
    }

    setUploading(false);
    setShowUpload(false);
    setUploadForm({ doc_type: '', expiry_date: '', file: null });
    qc.invalidateQueries({ queryKey: ['documents'] });
  };

  const filteredDocs = docs.filter(d => {
    const driverName = d.driver_email || '';
    return !search || driverName.toLowerCase().includes(search.toLowerCase());
  });

  const expiringDocs = docs.filter(d => {
    if (!d.expiry_date) return false;
    const daysUntilExpiry = differenceInDays(new Date(d.expiry_date), new Date());
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  });

  const expiredDocs = docs.filter(d => {
    if (!d.expiry_date) return false;
    return isPast(new Date(d.expiry_date));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Documentos"
        subtitle={`${docs.length} documentos · ${expiringDocs.length} a expirar`}
        actionLabel="Upload"
        onAction={() => setShowUpload(true)}
        actionIcon={Upload}
      />

      {(isAdmin && expiredDocs.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-red-800">{expiredDocs.length} documentos expirados</p>
              <p className="text-xs text-red-700 mt-1">Ação requerida para os seguintes motoristas</p>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Upload className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum documento encontrado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredDocs.map(doc => {
            const docType = DOC_TYPES.find(d => d.value === doc.doc_type);
            const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            let expiryStatus = null;

            if (doc.expiry_date) {
              const daysUntilExpiry = differenceInDays(new Date(doc.expiry_date), new Date());
              if (daysUntilExpiry <= 0) {
                expiryStatus = { label: 'Expirado', color: 'text-red-600' };
              } else if (daysUntilExpiry <= 30) {
                expiryStatus = { label: `${daysUntilExpiry} dias`, color: 'text-yellow-600' };
              }
            }

            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-gray-900">{docType?.label || doc.doc_type}</p>
                    <p className="text-xs text-gray-500">{doc.driver_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {expiryStatus && (
                    <span className={`text-xs font-medium ${expiryStatus.color}`}>
                      {expiryStatus.label}
                    </span>
                  )}
                  <Badge className={`text-xs border-0 ${statusConfig.color}`}>
                    {statusConfig.label}
                  </Badge>
                  {doc.created_date && (
                    <span className="text-xs text-gray-400 hidden sm:block">
                      {format(new Date(doc.created_date), 'dd/MM/yyyy')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(o) => { if (!o) setSelectedDoc(null); }}>
        <DialogContent className="max-w-md">
          {selectedDoc && (
            <>
              <DialogHeader>
                <DialogTitle>{DOC_TYPES.find(d => d.value === selectedDoc.doc_type)?.label || selectedDoc.doc_type}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Motorista</p>
                  <p className="text-sm font-medium text-gray-900">{selectedDoc.driver_email}</p>
                </div>
                {selectedDoc.expiry_date && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Validade</p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(selectedDoc.expiry_date), 'dd/MM/yyyy')}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estado</p>
                  <Badge className={`text-xs border-0 ${STATUS_CONFIG[selectedDoc.status]?.color || STATUS_CONFIG.pending.color}`}>
                    {STATUS_CONFIG[selectedDoc.status]?.label || 'Pendente'}
                  </Badge>
                </div>
                {isAdmin && selectedDoc.status === 'pending' && (
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-xs font-semibold text-gray-700">Ação</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          updateStatusMutation.mutate({ id: selectedDoc.id, status: 'approved' });
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          updateStatusMutation.mutate({ id: selectedDoc.id, status: 'rejected' });
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                )}
                {selectedDoc.file_url && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => window.open(selectedDoc.file_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-1" /> Ver documento
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          deleteMutation.mutate(selectedDoc.id);
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo de Documento *</label>
              <select
                value={uploadForm.doc_type}
                onChange={e => setUploadForm(p => ({ ...p, doc_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecionar...</option>
                {DOC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Data de Validade</label>
              <Input
                type="date"
                value={uploadForm.expiry_date}
                onChange={e => setUploadForm(p => ({ ...p, expiry_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Ficheiro *</label>
              <input
                type="file"
                onChange={e => setUploadForm(p => ({ ...p, file: e.target.files?.[0] || null }))}
                className="w-full text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowUpload(false)}>Cancelar</Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                onClick={handleUpload}
                disabled={uploading || !uploadForm.doc_type || !uploadForm.file}
              >
                {uploading ? 'A carregar...' : 'Upload'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}