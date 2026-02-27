import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, CheckCircle2, Clock, AlertTriangle, Search, Filter } from 'lucide-react';
import { differenceInDays, addDays, format } from 'date-fns';

const DOC_CATEGORIES = [
  { value: 'driving_license', label: 'Carta de Condução', expiryMonths: 12 },
  { value: 'id_card', label: 'CC/Passaporte', expiryMonths: 60 },
  { value: 'tvde_certificate', label: 'Certificado TVDE', expiryMonths: 12 },
  { value: 'iban_proof', label: 'Comprovativo IBAN', expiryMonths: null },
  { value: 'insurance', label: 'Seguro', expiryMonths: 12 },
  { value: 'inspection', label: 'Inspeção', expiryMonths: 12 },
  { value: 'other', label: 'Outro', expiryMonths: null },
];

export default function DocumentManagement({ currentUser }) {
  const isAdmin = currentUser?.role?.includes('admin');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => await base44.entities.Document.list('-created_date'),
  });

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => await base44.entities.Driver.list(),
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (docId) => 
      base44.entities.Document.update(docId, {
        status: 'approved',
        approved_by: currentUser.email,
        approved_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-documents'] });
      setSelectedDoc(null);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (docId) => 
      base44.entities.Document.update(docId, {
        status: 'rejected',
        rejection_reason: rejectionReason,
        approved_by: currentUser.email,
        approved_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-documents'] });
      setSelectedDoc(null);
      setRejectionReason('');
      setShowRejectionDialog(false);
    },
  });

  // Filter and categorize documents
  const filtered = documents.filter(doc => {
    const matchSearch = !search || 
      doc.driver_email?.toLowerCase().includes(search.toLowerCase()) ||
      DOC_CATEGORIES.find(c => c.value === doc.doc_type)?.label?.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = !statusFilter || doc.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Calculate expiry info
  const getExpiryInfo = (doc) => {
    if (!doc.expiry_date) return null;
    const days = differenceInDays(new Date(doc.expiry_date), new Date());
    if (days <= 0) return { status: 'expired', days, text: 'Expirado' };
    if (days <= 30) return { status: 'expiring', days, text: `${days} dias` };
    return { status: 'valid', days, text: `Válido por ${days} dias` };
  };

  // Stats
  const stats = {
    pending: documents.filter(d => d.status === 'pending').length,
    approved: documents.filter(d => d.status === 'approved').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
    expiring: documents.filter(d => {
      const info = getExpiryInfo(d);
      return info?.status === 'expiring';
    }).length,
    expired: documents.filter(d => {
      const info = getExpiryInfo(d);
      return info?.status === 'expired';
    }).length,
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Documentos"
        subtitle="Aprovação e validação de documentos enviados por motoristas"
      >
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-full text-yellow-700">
            <Clock className="w-3 h-3" />{stats.pending} Pendentes
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
            {stats.expired} documento(s) expirado(s) que requerem ação imediata
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pendentes ({stats.pending})</TabsTrigger>
          <TabsTrigger value="approved">Aprovados ({stats.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados ({stats.rejected})</TabsTrigger>
        </TabsList>

        {['pending', 'approved', 'rejected'].map(status => (
          <TabsContent key={status} value={status}>
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">Nenhum documento encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map(doc => {
                  const expiryInfo = getExpiryInfo(doc);
                  const driver = drivers.find(d => d.email === doc.driver_email);
                  const docCategory = DOC_CATEGORIES.find(c => c.value === doc.doc_type);

                  return (
                    <Card key={doc.id}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-5 gap-4 items-center">
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Documento</p>
                            <p className="font-semibold text-sm">{docCategory?.label}</p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase">Motorista</p>
                            <p className="font-semibold text-sm">{driver?.full_name || doc.driver_email}</p>
                            <p className="text-xs text-gray-600">{doc.driver_email}</p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase">Validade</p>
                            {expiryInfo ? (
                              <p className={`text-sm font-medium ${
                                expiryInfo.status === 'expired' ? 'text-red-600' :
                                expiryInfo.status === 'expiring' ? 'text-yellow-600' :
                                'text-emerald-600'
                              }`}>
                                {expiryInfo.text}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-600">Sem data</p>
                            )}
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 uppercase">Status</p>
                            <Badge className={`text-xs ${
                              status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {status === 'approved' ? '✓ Aprovado' :
                               status === 'rejected' ? '✗ Rejeitado' :
                               '⏳ Pendente'}
                            </Badge>
                          </div>

                          <div className="flex gap-2 justify-end">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                            >
                              Ver
                            </a>

                            {status === 'pending' && (
                              <>
                                <Button
                                  onClick={() => approveMutation.mutate(doc.id)}
                                  disabled={approveMutation.isPending}
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  Aprovar
                                </Button>
                                <Button
                                  onClick={() => {
                                    setSelectedDoc(doc);
                                    setShowRejectionDialog(true);
                                  }}
                                  variant="outline"
                                  size="sm"
                                >
                                  Rejeitar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Documento: <strong>{selectedDoc && DOC_CATEGORIES.find(c => c.value === selectedDoc.doc_type)?.label}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium mb-2">Motivo da Rejeição</label>
              <Textarea
                placeholder="Explique por que o documento foi rejeitado..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRejectionDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => selectedDoc && rejectMutation.mutate(selectedDoc.id)}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                Confirmar Rejeição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}