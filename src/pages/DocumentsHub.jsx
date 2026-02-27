import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Upload, Search, Filter, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const DOC_CATEGORIES = [
  { value: 'driving_license', label: 'Carta de Condução' },
  { value: 'id_card', label: 'CC/Passaporte' },
  { value: 'tvde_certificate', label: 'Certificado TVDE' },
  { value: 'iban_proof', label: 'Comprovativo IBAN' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'inspection', label: 'Inspeção' },
  { value: 'other', label: 'Outro' },
];

const OWNER_TYPES = {
  driver: 'Motorista',
  vehicle: 'Veículo',
};

export default function DocumentsHub({ currentUser }) {
  const qc = useQueryClient();
  const isAdmin = currentUser?.role?.includes('admin');
  const isDriver = currentUser?.role?.includes('driver');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState({ doc_type: '', expiry_date: '', owner_type: 'driver' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => {
      if (isDriver) {
        return await base44.entities.Document.filter({ driver_email: currentUser.email }) || [];
      }
      return await base44.entities.Document.list('-created_date') || [];
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, docType, expiryDate }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('Falha ao fazer upload do ficheiro');

      await base44.entities.Document.create({
        doc_type: docType,
        driver_email: currentUser.email,
        file_url,
        status: 'pending',
        expiry_date: expiryDate || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-documents'] });
      setShowUploadDialog(false);
      setUploadForm({ doc_type: '', expiry_date: '', owner_type: 'driver' });
      fileInputRef.current = null;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (docId) => base44.entities.Document.delete(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-documents'] });
    },
  });

  // Filter documents
  const filtered = documents.filter(doc => {
    const matchSearch = !search || 
      doc.driver_email?.toLowerCase().includes(search.toLowerCase()) ||
      DOC_CATEGORIES.find(c => c.value === doc.doc_type)?.label?.toLowerCase().includes(search.toLowerCase());
    
    const matchCategory = !categoryFilter || doc.doc_type === categoryFilter;
    const matchStatus = !statusFilter || doc.status === statusFilter;

    return matchSearch && matchCategory && matchStatus;
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadForm.doc_type) {
      alert('Por favor selecione um tipo de documento');
      return;
    }
    
    setUploading(true);
    uploadMutation.mutate({ 
      file, 
      docType: uploadForm.doc_type,
      expiryDate: uploadForm.expiry_date,
    }, {
      onSettled: () => setUploading(false),
    });
  };

  // Stats
  const stats = {
    total: documents.length,
    approved: documents.filter(d => d.status === 'approved').length,
    pending: documents.filter(d => d.status === 'pending').length,
    expired: documents.filter(d => d.expiry_date && differenceInDays(new Date(d.expiry_date), new Date()) <= 0).length,
    expiring: documents.filter(d => d.expiry_date && {
      const days = differenceInDays(new Date(d.expiry_date), new Date());
      return days > 0 && days <= 30;
    }).length,
  };

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days <= 0) return { text: 'Expirado', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (days <= 30) return { text: `${days} dias`, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Documentos"
        subtitle="Centralize e gerencie todos os seus documentos"
        actionLabel={isDriver ? "Enviar Documento" : null}
        onAction={() => setShowUploadDialog(true)}
        actionIcon={Upload}
      >
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full text-blue-700">
            <FileText className="w-3 h-3" />{stats.total} Total
          </span>
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-full text-emerald-700">
            <CheckCircle2 className="w-3 h-3" />{stats.approved} Aprovados
          </span>
          {stats.expired > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-full text-red-700">
              <AlertTriangle className="w-3 h-3" />{stats.expired} Expirados
            </span>
          )}
        </div>
      </PageHeader>

      {/* Alerts */}
      {stats.expired > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Você tem {stats.expired} documento(s) expirado(s). Atualize-os urgentemente.
          </AlertDescription>
        </Alert>
      )}

      {stats.expiring > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Você tem {stats.expiring} documento(s) vencendo nos próximos 30 dias.
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pesquisar e Filtrar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Pesquisar por tipo ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas as categorias</SelectItem>
                  {DOC_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos os tipos</SelectItem>
                  <SelectItem value="driver">Motorista</SelectItem>
                  <SelectItem value="vehicle">Veículo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">A carregar...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Nenhum documento encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(doc => {
                const expiryStatus = getExpiryStatus(doc.expiry_date);
                const docLabel = DOC_CATEGORIES.find(c => c.value === doc.doc_type)?.label || doc.doc_type;

                return (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      expiryStatus ? expiryStatus.bgColor : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{docLabel}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {isAdmin && (
                            <p className="text-xs text-gray-500">{doc.driver_email}</p>
                          )}
                          {doc.expiry_date && (
                            <p className={`text-xs font-medium ${expiryStatus?.color || 'text-gray-500'}`}>
                              {expiryStatus ? expiryStatus.text : format(new Date(doc.expiry_date), 'dd/MM/yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${
                        doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {doc.status === 'approved' ? '✓ Aprovado' :
                         doc.status === 'rejected' ? '✗ Rejeitado' :
                         '⏳ Pendente'}
                      </Badge>

                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                      >
                        Ver
                      </a>

                      {isDriver && (
                        <button
                          onClick={() => deleteMutation.mutate(doc.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1 hover:bg-red-50 rounded text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      {isDriver && (
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enviar Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Tipo de Documento *</Label>
                <Select value={uploadForm.doc_type} onValueChange={v => setUploadForm(p => ({ ...p, doc_type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Data de Validade (opcional)</Label>
                <Input
                  type="date"
                  value={uploadForm.expiry_date}
                  onChange={e => setUploadForm(p => ({ ...p, expiry_date: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Arquivo *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !uploadForm.doc_type}
                  variant="outline"
                  className="w-full mt-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'A enviar...' : 'Selecionar arquivo'}
                </Button>
              </div>

              <Button
                onClick={() => setShowUploadDialog(false)}
                variant="outline"
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}