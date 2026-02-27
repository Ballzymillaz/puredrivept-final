import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const DOC_LABELS = {
  driving_license: 'Carta de Condução',
  id_card: 'CC/Passaporte',
  tvde_certificate: 'Certificado TVDE',
  iban_proof: 'Comprovativo IBAN',
  insurance: 'Seguro',
  inspection: 'Inspeção',
  other: 'Outro',
};

export default function DocumentApprovalCard({ document, onApprove, onReject, isProcessing }) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');

  const handleReject = () => {
    if (!rejectionNotes.trim()) {
      alert('Por favor, adicione um motivo para a rejeição');
      return;
    }
    onReject(document.id, rejectionNotes);
    setShowRejectDialog(false);
    setRejectionNotes('');
  };

  return (
    <>
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-600" />
              <div>
                <CardTitle className="text-sm">{DOC_LABELS[document.doc_type]}</CardTitle>
                <p className="text-xs text-gray-600 mt-1">{document.driver_email}</p>
              </div>
            </div>
            <Badge className="bg-yellow-100 text-yellow-800">Pendente de aprovação</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Enviado em {format(new Date(document.created_date), 'dd/MM/yyyy HH:mm')}</span>
            {document.expiry_date && (
              <span>Válido até {format(new Date(document.expiry_date), 'dd/MM/yyyy')}</span>
            )}
          </div>

          <a
            href={document.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-white rounded-lg border border-gray-200 text-sm text-indigo-600 hover:text-indigo-700 font-medium text-center"
          >
            Ver documento →
          </a>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => onApprove(document.id)}
              disabled={isProcessing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Aprovar
            </Button>
            <Button
              onClick={() => setShowRejectDialog(true)}
              disabled={isProcessing}
              variant="outline"
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rejeitar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Adicione um motivo para a rejeição. O motorista será notificado.
            </p>
            <Textarea
              placeholder="Motivo da rejeição..."
              value={rejectionNotes}
              onChange={e => setRejectionNotes(e.target.value)}
              className="h-24"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => setShowRejectDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectionNotes.trim() || isProcessing}
                variant="destructive"
                className="flex-1"
              >
                Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}