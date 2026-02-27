import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function DocumentApprovalHistory({ document }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  // Build history from current state
  const history = [];

  if (document.status === 'approved' && document.approved_by && document.approved_at) {
    history.push({
      action: 'approved',
      date: document.approved_at,
      user: document.approved_by,
      notes: 'Documento aprovado',
    });
  }

  if (document.status === 'rejected' && document.rejection_reason) {
    history.push({
      action: 'rejected',
      date: document.updated_date || document.created_date,
      notes: document.rejection_reason,
    });
  }

  history.push({
    action: 'submitted',
    date: document.created_date,
    notes: 'Documento enviado para revisão',
  });

  // Reverse to show chronological order
  const sortedHistory = history.reverse();

  if (sortedHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Histórico de Aprovação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500">Nenhum histórico disponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Histórico de Aprovação</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedHistory.map((entry, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                  {getStatusIcon(entry.action)}
                </div>
                {idx < sortedHistory.length - 1 && (
                  <div className="w-0.5 h-8 bg-gray-200 my-1" />
                )}
              </div>

              <div className="flex-1 py-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {entry.action === 'approved'
                      ? 'Aprovado'
                      : entry.action === 'rejected'
                      ? 'Rejeitado'
                      : 'Enviado'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(entry.date), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>

                {entry.user && (
                  <p className="text-xs text-gray-600 mb-1">Por: {entry.user}</p>
                )}

                <p className="text-xs text-gray-600">{entry.notes}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}