import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DocumentApprovalCard from '../components/documents/DocumentApprovalCard';
import DocumentApprovalHistory from '../components/documents/DocumentApprovalHistory';
import BulkApprovalActions from '../components/documents/BulkApprovalActions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, History } from 'lucide-react';

export default function DocumentApproval({ currentUser }) {
  const qc = useQueryClient();
  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager');
  
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDocForHistory, setSelectedDocForHistory] = useState(null);

  // Fetch all documents (pending and processed)
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => {
      const docs = await base44.entities.Document.list();
      return docs.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );
    },
    enabled: isAdmin || isFleetManager,
  });

  // Filter pending documents
  const pendingDocuments = useMemo(() => 
    documents.filter(d => d.status === 'pending'),
    [documents]
  );
  
  // Filter processed documents
  const processedDocuments = useMemo(() => 
    documents.filter(d => d.status !== 'pending'),
    [documents]
  );

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: async (docId) => {
      const result = await base44.functions.invoke('documentApprovalWorkflow', {
        document_id: docId,
        action: 'approve',
      });
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-documents'] });
      setSelectedDocs([]);
    },
  });

  // Rejection mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ docId, notes }) => {
      const result = await base44.functions.invoke('documentApprovalWorkflow', {
        document_id: docId,
        action: 'reject',
        notes,
      });
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-documents'] });
      setSelectedDocs([]);
    },
  });

  if (!isAdmin && !isFleetManager) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso restrito a administradores e gestores de frota</p>
      </div>
    );
  }

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;
  
  const toggleDocSelect = (docId) => {
    setSelectedDocs(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovação de Documentos"
        subtitle={`${pendingDocuments.length} pendentes · ${processedDocuments.length} processados`}
      />

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">
            Pendentes ({pendingDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="processed">
            Processados ({processedDocuments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingDocuments.length === 0 && !isLoading && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertTriangle className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800">
                Nenhum documento pendente. Todos os documentos foram processados.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">A carregar...</div>
          ) : (
            <>
              {selectedDocs.length > 0 && (
                <Alert className="border-indigo-200 bg-indigo-50">
                  <AlertTriangle className="h-4 w-4 text-indigo-600" />
                  <AlertDescription className="text-indigo-800 flex items-center justify-between">
                    <span className="font-semibold">{selectedDocs.length} documento(s) selecionado(s)</span>
                    <button
                      onClick={() => setSelectedDocs([])}
                      className="text-xs underline hover:no-underline"
                    >
                      Limpar seleção
                    </button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {pendingDocuments.map(doc => (
                  <div key={doc.id} className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedDocs.includes(doc.id)}
                      onCheckedChange={() => toggleDocSelect(doc.id)}
                      className="mt-4"
                    />
                    <div className="flex-1">
                      <DocumentApprovalCard
                        document={doc}
                        onApprove={() => approveMutation.mutate(doc.id)}
                        onReject={(id, notes) => rejectMutation.mutate({ docId: id, notes })}
                        isProcessing={isProcessing}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="processed" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">A carregar...</div>
          ) : processedDocuments.length === 0 ? (
            <Alert className="border-gray-200 bg-gray-50">
              <AlertTriangle className="h-4 w-4 text-gray-600" />
              <AlertDescription className="text-gray-700">
                Nenhum documento processado ainda.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {processedDocuments.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        {doc.driver_email}
                      </p>
                      <p className="text-xs text-gray-500">•</p>
                      <p className="text-xs text-gray-600">{doc.doc_type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDocForHistory(doc);
                      setShowHistory(true);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <History className="w-3 h-3" />
                    Ver histórico
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Aprovação</DialogTitle>
          </DialogHeader>
          {selectedDocForHistory && (
            <DocumentApprovalHistory document={selectedDocForHistory} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}