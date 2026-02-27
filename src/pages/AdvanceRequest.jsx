import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

const ADVANCE_TYPES = [
  { value: 'salary_advance', label: 'Adiantamento de Salário', desc: 'Até 50% do pagamento semanal estimado' },
  { value: 'loan', label: 'Empréstimo', desc: 'Até €2000 com juros' },
];

export default function AdvanceRequest({ currentUser }) {
  const qc = useQueryClient();
  const isDriver = currentUser?.role?.includes('driver');

  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({
    type: 'salary_advance',
    amount: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch driver
  const { data: driver } = useQuery({
    queryKey: ['driver-advance'],
    queryFn: async () => {
      const drivers = await base44.entities.Driver.list();
      return drivers.find(d => d.email === currentUser?.email);
    },
    enabled: !!currentUser?.email && isDriver,
  });

  // Fetch latest payment to estimate weekly amount
  const { data: latestPayment } = useQuery({
    queryKey: ['latest-payment-advance', driver?.id],
    queryFn: async () => {
      if (!driver?.id) return null;
      const payments = await base44.entities.WeeklyPayment.filter({ driver_id: driver.id });
      return payments?.sort((a, b) => new Date(b.week_end) - new Date(a.week_end))[0];
    },
    enabled: !!driver?.id,
  });

  // Fetch pending requests
  const { data: requests = [] } = useQuery({
    queryKey: ['my-advance-requests', driver?.id],
    queryFn: async () => {
      if (!driver?.id) return [];
      const loans = await base44.entities.Loan.filter({ driver_id: driver.id });
      return loans?.sort((a, b) => new Date(b.request_date) - new Date(a.request_date)) || [];
    },
    enabled: !!driver?.id,
  });

  // Create advance request
  const createRequestMutation = useMutation({
    mutationFn: async (data) => {
      if (data.type === 'salary_advance') {
        // For salary advance, create a temporary record or notification
        await base44.entities.Notification.create({
          title: 'Novo Adiantamento Solicitado',
          message: `Motorista ${driver.full_name} solicitou um adiantamento de €${data.amount}. Motivo: ${data.reason}`,
          type: 'alert',
          category: 'payment',
          recipient_role: 'fleet_manager',
          action_url: 'AdvanceApproval',
          sent_email: false,
        });
      } else {
        // For loan, create Loan entity
        await base44.entities.Loan.create({
          driver_id: driver.id,
          driver_name: driver.full_name,
          amount: parseFloat(data.amount),
          duration_weeks: 13,
          status: 'requested',
          request_date: new Date().toISOString().split('T')[0],
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-advance-requests', driver?.id] });
      setShowRequestDialog(false);
      setRequestForm({ type: 'salary_advance', amount: '', reason: '' });
      setSubmitting(false);
    },
    onError: (error) => {
      console.error('Error:', error);
      alert('Erro ao submeter solicitação');
      setSubmitting(false);
    },
  });

  const handleSubmitRequest = (e) => {
    e.preventDefault();
    if (!requestForm.amount || parseFloat(requestForm.amount) <= 0) {
      alert('Por favor, insira um valor válido');
      return;
    }
    setSubmitting(true);
    createRequestMutation.mutate(requestForm);
  };

  if (!isDriver) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso apenas para motoristas</p>
      </div>
    );
  }

  const maxAdvance = latestPayment ? (latestPayment.net_amount * 0.5) : 0;
  const pendingLoans = requests.filter(r => r.status === 'requested' || r.status === 'approved').length;
  const activeLoans = requests.filter(r => r.status === 'active').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adiantamentos e Empréstimos"
        subtitle="Solicite adiantamentos de salário ou empréstimos com taxa baixa"
        actionLabel="Nova Solicitação"
        onAction={() => setShowRequestDialog(true)}
        actionIcon={DollarSign}
      />

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600">Adiantamento Máximo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">€{maxAdvance.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">50% do pagamento semanal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600">Solicitações Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingLoans}</div>
            <p className="text-xs text-gray-500 mt-1">Aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600">Empréstimos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{activeLoans}</div>
            <p className="text-xs text-gray-500 mt-1">Em reembolso</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suas Solicitações</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>Nenhuma solicitação ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">
                      Empréstimo - €{(req.amount || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Solicitado em {format(new Date(req.request_date), 'dd/MM/yyyy')}
                    </p>
                    {req.remaining_balance && (
                      <p className="text-xs text-gray-600 mt-2">
                        Saldo restante: €{(req.remaining_balance || 0).toFixed(2)} | Taxa semanal: €{(req.weekly_installment || 0).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <Badge className={`text-xs ${
                    req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    req.status === 'active' ? 'bg-blue-100 text-blue-700' :
                    req.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {req.status === 'requested' ? '⏳ Pendente' :
                     req.status === 'approved' ? '✓ Aprovado' :
                     req.status === 'active' ? '💳 Ativo' :
                     'Concluído'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Solicitação</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div>
              <Label className="text-xs">Tipo de Adiantamento *</Label>
              <Select value={requestForm.type} onValueChange={v => setRequestForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVANCE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-xs text-gray-500">{type.desc}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Valor (€) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={maxAdvance}
                value={requestForm.amount}
                onChange={e => setRequestForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="mt-1"
              />
              {maxAdvance > 0 && (
                <p className="text-xs text-gray-500 mt-1">Máximo: €{maxAdvance.toFixed(2)}</p>
              )}
            </div>

            <div>
              <Label className="text-xs">Motivo/Descrição *</Label>
              <Textarea
                placeholder="Explique o motivo da solicitação..."
                value={requestForm.reason}
                onChange={e => setRequestForm(p => ({ ...p, reason: e.target.value }))}
                className="h-20 mt-1"
              />
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-xs">
                {requestForm.type === 'salary_advance' 
                  ? 'Adiantamentos são descontados do seu próximo pagamento.'
                  : 'Empréstimos têm uma taxa semanal e serão descontados automaticamente.'
                }
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => setShowRequestDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || !requestForm.amount}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {submitting ? 'A enviar...' : 'Solicitar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}