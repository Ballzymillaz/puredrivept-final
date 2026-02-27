import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function BulkApprovalActions({ documents, onApproveSelected, onRejectSelected, isProcessing }) {
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');

  const toggleSelect = (docId) => {
    setSelectedDocs(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(documents.map(d => d.id));
    }
  };

  const handleApproveAll = () => {
    selectedDocs.forEach(docId => {
      onApproveSelected(docId);
    });
    setSelectedDocs([]);
  };

  const handleRejectAll = () => {
    if (!rejectionNotes.trim()) {
      alert('Por favor, adicione um motivo para a rejeição');
      return;
    }
    selectedDocs.forEach(docId => {
      onRejectSelected(docId, rejectionNotes);
    });
    setSelectedDocs([]);
    setShowRejectDialog(false);
    setRejectionNotes('');
  };

  if (documents.length === 0) return null;

  return (
    <>
      {selectedDocs.length > 0 && (
        <Alert className="border-indigo-200 bg-indigo-50 mb-4">
          <AlertTriangle className="h-4 w-4 text-indigo-600" />
          <AlertDescription className="text-indigo-800">
            <span className="font-semibold">{selectedDocs.length} documento(s) selecionado(s)</span>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleApproveAll}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aprovar todos
              </Button>
              <Button
                size="sm"
                onClick={() => setShowRejectDialog(true)}
                disabled={isProcessing}
                variant="outline"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar todos
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedDocs([])}
                disabled={isProcessing}
              >
                Limpar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Header Checkbox */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg mb-4">
        <Checkbox
          checked={selectedDocs.length === documents.length && documents.length > 0}
          onCheckedChange={toggleSelectAll}
          disabled={documents.length === 0}
        />
        <span className="text-xs font-medium text-gray-700">
          {selectedDocs.length > 0 ? `${selectedDocs.length} selecionado(s)` : 'Selecionar todos'}
        </span>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar {selectedDocs.length} documento(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700">Motivo da Rejeição *</label>
              <Textarea
                placeholder="Explique o motivo da rejeição..."
                value={rejectionNotes}
                onChange={e => setRejectionNotes(e.target.value)}
                className="h-24 mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRejectAll}
                disabled={!rejectionNotes.trim() || isProcessing}
                variant="destructive"
              >
                Rejeitar todos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return selected docs with selection checkboxes for rendering */}
      {documents.map(doc => ({
        ...doc,
        isSelected: selectedDocs.includes(doc.id),
        toggleSelect: () => toggleSelect(doc.id),
      }))}
    </>
  );
}