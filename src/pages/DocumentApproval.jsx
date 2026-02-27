import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DocumentApprovalCard from '../components/documents/DocumentApprovalCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function DocumentApproval({ currentUser }) {
  const qc = useQueryClient();
  const isAdmin = currentUser?.role?.includes('admin');

  // Fetch pending documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['pending-documents'],
    queryFn: async () => {
      const docs = await base44.entities.Document.list();
      return docs.filter(d => d.status === 'pending').sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );
    },
    enabled: isAdmin,
  });

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
      qc.invalidateQueries({ queryKey: ['pending-documents'] });
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
      qc.invalidateQueries({ queryKey: ['pending-documents'] });
    },
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso restrito a administradores</p>
      </div>
    );
  }

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovação de Documentos"
        subtitle={`${documents.length} documentos pendentes de revisão`}
      />

      {documents.length === 0 && !isLoading && (
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
        <div className="space-y-4">
          {documents.map(doc => (
            <DocumentApprovalCard
              key={doc.id}
              document={doc}
              onApprove={() => approveMutation.mutate(doc.id)}
              onReject={(id, notes) => rejectMutation.mutate({ docId: id, notes })}
              isProcessing={isProcessing}
            />
          ))}
        </div>
      )}
    </div>
  );
}