import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';

const DOC_LABELS = {
  driving_license: 'Carta de Condução',
  tvde_certificate: 'Certificado TVDE',
  id_card: 'CC / Passaporte',
  iban_proof: 'Comprovativo IBAN',
  insurance: 'Seguro',
  inspection: 'Inspeção',
  other: 'Outro'
};

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700'
};

const STATUS_ICONS = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle
};

export default function DocumentManagement({ currentUser }) {
  const qc = useQueryClient();
  const isAdmin = currentUser?.role?.includes('admin');
  
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [reviewForm, setReviewForm] = useState({ action: '', notes: '' });
  const [reviewing, setReviewing] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date'),
    enabled: isAdmin,
  });

  const filtered = documents.filter(doc =>
    !search ||
    doc.driver_email?.toLowerCase().includes(search.toLowerCase()) ||
    DOC_LABELS[doc.doc_type]?.toLowerCase().includes(search.toLowerCase())
  );

  const handleReview = async () => {
    setReviewing(true);
    try {
      const newStatus = reviewForm.action === 'approve' ? 'approved' : 'rejected';
      
      await base44.entities.Document.update(selectedDoc.id, {
        status: newStatus,
        rejection_reason: reviewForm.notes || undefined,
        approved_by: currentUser.email,
        approved_at: new Date().toISOString(),
      });

      // Notify driver
      const statusMsg = newStatus === 'approved' 
        ? `O seu documento ${DOC_LABELS[selectedDoc.doc_type]} foi aprovado.`
        : `O seu documento ${DOC_LABELS[selectedDoc.doc_type]} foi rejeitado. Motivo: ${reviewForm.notes}`;

      await base44.entities.Notification.create({
        title: newStatus === 'approved' ? '✅ Documento aprovado' : '❌ Documento rejeitado',
        message: statusMsg,
        type: newStatus === 'approved' ? 'success' : 'alert',
        category: 'document_expiry',
        recipient_email: selectedDoc.driver_email,
        related_entity: selectedDoc.id,
        sent_email: false,
      });

      setReviewing(false);
      setSelectedDoc(null);
      setReviewForm({ action: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (error) {
      console.error('Review error:', error);
      alert('Erro ao revisar documento');
      setReviewing(false);
    }
  };

  const stats = {
    total: documents.length,
    pending: documents.filter(d => d.status === 'pending').length,
    approved: documents.filter(d => d.status === 'approved').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
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
        subtitle={`${stats.pending} pendentes · ${stats.approved} aprovados · ${stats.rejected} rejeitados`}
      >
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-full text-gray-700">
            <Clock className="w-3 h-3" />{stats.pending} pendentes
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full text-emerald-700">
            <CheckCircle2 className="w-3 h-3" />{stats.approved} aprovados
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-full text-red-700">
            <XCircle className="w-3 h-3" />{stats.rejected} rejeitados
          </span>
        </div>
      </PageHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Pesquisar por email ou tipo de documento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">A carregar...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum documento encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const IconStatus = STATUS_ICONS[doc.status];
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{DOC_LABELS[doc.doc_type]}</p>
                    <p className="text-xs text-gray-500">{doc.driver_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {doc.expiry_date && (
                    <span className="text-xs text-gray-500">
                      Válido até: {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}
                    </span>
                  )}
                  <Badge className={`${STATUS_COLORS[doc.status]} flex items-center gap-1`}>
                    {IconStatus && <IconStatus className="w-3 h-3" />}
                    {doc.status === 'pending' ? 'Pendente' : doc.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                  </Badge>
                  {doc.created_date && (
                    <span className="text-xs text-gray-400 hidden md:block">
                      {format(new Date(doc.created_date), 'dd/MM/yyyy')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Document Review Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(o) => { if (!o) setSelectedDoc(null); }}>
        <DialogContent className="max-w-md">
          {selectedDoc && (
            <>
              <DialogHeader>
                <DialogTitle>Revisar Documento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{DOC_LABELS[selectedDoc.doc_type]}</p>
                  <p className="text-xs text-gray-500">{selectedDoc.driver_email}</p>
                </div>

                {selectedDoc.file_url && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <a
                      href={selectedDoc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      Ver documento →
                    </a>
                  </div>
                )}

                {selectedDoc.status === 'pending' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-2">
                        Notas (opcional)
                      </label>
                      <Textarea
                        placeholder="Adicionar motivo de rejeição ou observações..."
                        value={reviewForm.notes}
                        onChange={e => setReviewForm(p => ({ ...p, notes: e.target.value }))}
                        className="h-20 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setReviewForm({ action: 'approve', notes: '' });
                          setTimeout(handleReview, 0);
                        }}
                        disabled={reviewing}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        ✅ Aprovar
                      </Button>
                      <Button
                        onClick={() => {
                          setReviewForm(p => ({ ...p, action: 'reject' }));
                          setTimeout(handleReview, 0);
                        }}
                        disabled={reviewing}
                        variant="destructive"
                        className="flex-1"
                      >
                        ❌ Rejeitar
                      </Button>
                    </div>
                  </>
                )}

                {selectedDoc.status === 'approved' && (
                  <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">
                    ✅ Documento aprovado por {selectedDoc.approved_by}
                    {selectedDoc.approved_at && (
                      <p className="text-xs mt-1">
                        {format(new Date(selectedDoc.approved_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                )}

                {selectedDoc.status === 'rejected' && (
                  <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
                    ❌ Documento rejeitado
                    {selectedDoc.rejection_reason && (
                      <p className="text-xs mt-2">Motivo: {selectedDoc.rejection_reason}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}