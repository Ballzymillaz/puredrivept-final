import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export default function AdvanceApproval({ currentUser }) {
  const qc = useQueryClient();
  const isFleetManager = currentUser?.role?.includes('fleet_manager');
  const isAdmin = currentUser?.role?.includes('admin');

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch pending loan requests
  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['pending-loans'],
    queryFn: async () => {
      const allLoans = await base44.entities.Loan.list();
      return allLoans.filter(l => l.status === 'requested').sort((a, b) =>
        new Date(b.request_date) - new Date(a.request_date)
      );
    },
  });

  // Approve loan mutation
  const approveMutation = useMutation({
    mutationFn: async (loanId) => {
      const loan = loans.find(l => l.id === loanId);
      const weeklyInstallment = loan.amount / (loan.duration_weeks || 13) + (loan.amount * (loan.interest_rate_weekly || 1) / 100);
      const totalWithInterest = loan.amount + (loan.amount * (loan.interest_rate_weekly || 1) / 100 * (loan.duration_weeks || 13));

      await base44.entities.Loan.update(loanId, {
        status: 'approved',
        approval_date: new Date().toISOString().split('T')[0],
        approved_by: currentUser.email,
        weekly_installment: weeklyInstallment,
        total_with_interest: totalWithInterest,
        remaining_balance: totalWithInterest,
      });

      // Notify driver
      await base44.entities.Notification.create({
        title: '✅ Empréstimo Aprovado',
        message: `Seu empréstimo de €${loan.amount.toFixed(2)} foi aprovado. Taxa semanal: €${weeklyInstallment.toFixed(2)}`,
        type: 'success',
        category: 'payment',
        recipient_email: loan.driver_id,
        action_url: 'AdvanceRequest',
        sent_email: false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-loans'] });
      setProcessing(false);
    },
  });

  // Reject loan mutation
  const rejectMutation = useMutation({
    mutationFn: async (loanId) => {
      await base44.entities.Loan.update(loanId, {
        status: 'rejected',
        notes: rejectionNotes,
      });

      const loan = loans.find(l => l.id === loanId);
      // Notify driver
      await base44.entities.Notification.create({
        title: '❌ Empréstimo Rejeitado',
        message: `Seu empréstimo de €${loan.amount.toFixed(2)} foi rejeitado. Motivo: ${rejectionNotes}`,
        type: 'alert',
        category: 'payment',
        recipient_email: loan.driver_id,
        action_url: 'AdvanceRequest',
        sent_email: false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-loans'] });
      setShowRejectDialog(false);
      setSelectedLoan(null);
      setRejectionNotes('');
      setProcessing(false);
    },
  });

  if (!isFleetManager && !isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso restrito a gestores de frota e administradores</p>
      </div>
    );
  }

  const handleApprove = (loanId) => {
    setProcessing(true);
    approveMutation.mutate(loanId);
  };

  const handleRejectClick = (loan) => {
    setSelectedLoan(loan);
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = () => {
    if (!rejectionNotes.trim()) {
      alert('Por favor, adicione um motivo para a rejeição');
      return;
    }
    setProcessing(true);
    rejectMutation.mutate(selectedLoan.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovação de Adiantamentos"
        subtitle={`${loans.length} solicitações pendentes`}
      />

      {loans.length === 0 && !isLoading && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800">
            Nenhuma solicitação pendente. Todos os adiantamentos foram processados.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">A carregar...</div>
      ) : (
        <div className="space-y-4">
          {loans.map(loan => (
            <Card key={loan.id} className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{loan.driver_name}</CardTitle>
                    <p className="text-xs text-gray-600 mt-1">
                      Solicitado em {format(new Date(loan.request_date), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-white rounded-lg border">
                    <p className="text-xs text-gray-500">Valor Solicitado</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      €{(loan.amount || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border">
                    <p className="text-xs text-gray-500">Duração</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {loan.duration_weeks || 13} semanas
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border">
                    <p className="text-xs text-gray-500">Taxa Semanal</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {(loan.interest_rate_weekly || 1).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {loan.notes && (
                  <div className="p-3 bg-white rounded-lg border">
                    <p className="text-xs text-gray-500 mb-2">Motivo</p>
                    <p className="text-sm text-gray-700">{loan.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleApprove(loan.id)}
                    disabled={processing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Aprovar
                  </Button>
                  <Button
                    onClick={() => handleRejectClick(loan)}
                    disabled={processing}
                    variant="outline"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Adiantamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Motorista: <strong>{selectedLoan?.driver_name}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Valor: <strong>€{(selectedLoan?.amount || 0).toFixed(2)}</strong>
              </p>
            </div>

            <div>
              <Label className="text-xs">Motivo da Rejeição *</Label>
              <Textarea
                placeholder="Explique o motivo da rejeição..."
                value={rejectionNotes}
                onChange={e => setRejectionNotes(e.target.value)}
                className="h-24 mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowRejectDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRejectConfirm}
                disabled={!rejectionNotes.trim() || processing}
                variant="destructive"
                className="flex-1"
              >
                Rejeitar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}