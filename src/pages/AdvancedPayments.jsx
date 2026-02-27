import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AdvancedPayments({ currentUser }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [formData, setFormData] = useState({
    driver_id: '',
    driver_name: '',
    payment_type: 'advance',
    amount: 0,
    via_verde: 0,
    miio: 0,
    myprio: 0,
    iva_rate: 6,
    upi_percent: 4,
    notes: ''
  });

  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager');

  const { data: advancedPayments = [], isLoading } = useQuery({
    queryKey: ['advancedPayments'],
    queryFn: async () => {
      const payments = await base44.entities.WeeklyPayment.list();
      return payments.filter(p => p.status === 'draft' || p.status === 'processing');
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const driver = drivers.find(d => d.id === data.driver_id);
      const totalDeductions = (data.via_verde || 0) + (data.miio || 0) + (data.myprio || 0);
      const ivaAmount = (data.amount * data.iva_rate) / 100;
      const upiAmount = (data.amount * data.upi_percent) / 100;
      const totalDeductionsWithTax = totalDeductions + ivaAmount + upiAmount;
      const netAmount = data.amount - totalDeductionsWithTax;

      return base44.entities.WeeklyPayment.create({
        driver_id: data.driver_id,
        driver_name: driver?.full_name || data.driver_name,
        fleet_manager_id: isFleetManager ? currentUser?.id : '',
        fleet_manager_name: isFleetManager ? currentUser?.full_name : '',
        week_start: new Date().toISOString().split('T')[0],
        week_end: new Date().toISOString().split('T')[0],
        period_label: `Adiantamento - ${format(new Date(), 'dd/MM/yyyy')}`,
        total_gross: data.amount,
        via_verde_amount: data.via_verde || 0,
        miio_amount: data.miio || 0,
        myprio_amount: data.myprio || 0,
        iva_rate: data.iva_rate,
        iva_amount: ivaAmount,
        upi_earned: upiAmount,
        total_deductions: totalDeductionsWithTax,
        net_amount: netAmount,
        payment_method: 'bank_transfer',
        status: 'processing',
        notes: data.notes
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advancedPayments'] });
      handleCloseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const totalDeductions = (data.via_verde || 0) + (data.miio || 0) + (data.myprio || 0);
      const ivaAmount = (data.amount * data.iva_rate) / 100;
      const upiAmount = (data.amount * data.upi_percent) / 100;
      const totalDeductionsWithTax = totalDeductions + ivaAmount + upiAmount;
      const netAmount = data.amount - totalDeductionsWithTax;

      return base44.entities.WeeklyPayment.update(selectedPayment.id, {
        via_verde_amount: data.via_verde || 0,
        miio_amount: data.miio || 0,
        myprio_amount: data.myprio || 0,
        iva_rate: data.iva_rate,
        iva_amount: ivaAmount,
        upi_earned: upiAmount,
        total_deductions: totalDeductionsWithTax,
        net_amount: netAmount,
        notes: data.notes
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advancedPayments'] });
      handleCloseForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WeeklyPayment.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advancedPayments'] });
    },
  });

  const qc = useQueryClient();

  const filteredPayments = advancedPayments.filter(p => {
    const searchLower = search.toLowerCase();
    return !search || p.driver_name?.toLowerCase().includes(searchLower);
  });

  const handleOpenForm = (payment = null) => {
    if (payment) {
      setSelectedPayment(payment);
      setFormData({
        driver_id: payment.driver_id,
        driver_name: payment.driver_name,
        payment_type: 'advance',
        amount: payment.total_gross,
        via_verde: payment.via_verde_amount || 0,
        miio: payment.miio_amount || 0,
        myprio: payment.myprio_amount || 0,
        iva_rate: payment.iva_rate || 6,
        upi_percent: 4,
        notes: payment.notes || ''
      });
    } else {
      setSelectedPayment(null);
      setFormData({
        driver_id: '',
        driver_name: '',
        payment_type: 'advance',
        amount: 0,
        via_verde: 0,
        miio: 0,
        myprio: 0,
        iva_rate: 6,
        upi_percent: 4,
        notes: ''
      });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedPayment(null);
  };

  const handleSave = () => {
    if (!formData.driver_id || !formData.amount) return;

    if (selectedPayment) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const calculateTotals = () => {
    const ivaAmount = (formData.amount * formData.iva_rate) / 100;
    const upiAmount = (formData.amount * formData.upi_percent) / 100;
    const totalDeductions = (formData.via_verde || 0) + (formData.miio || 0) + (formData.myprio || 0) + ivaAmount + upiAmount;
    const netAmount = formData.amount - totalDeductions;
    return { ivaAmount, upiAmount, totalDeductions, netAmount };
  };

  const totals = calculateTotals();

  if (!isAdmin && !isFleetManager) {
    return <div className="text-center py-12 text-gray-400">Acesso não autorizado</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos Avançados"
        subtitle="Adiantamentos e pagamentos manuais com deduções"
        actionLabel="Novo Pagamento"
        onAction={() => handleOpenForm()}
        actionIcon={Plus}
      />

      <div className="bg-white rounded-lg border shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por motorista..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : filteredPayments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Nenhum pagamento pendente</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPayments.map(payment => (
            <Card key={payment.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-gray-900">{payment.driver_name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(payment.week_start), 'dd/MM/yyyy')}
                    </p>
                    <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-gray-400">Bruto</p>
                        <p className="font-semibold">€{(payment.total_gross || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Via Verde</p>
                        <p className="font-semibold">€{(payment.via_verde_amount || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Deduções</p>
                        <p className="font-semibold text-red-600">-€{(payment.total_deductions || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Líquido</p>
                        <p className="font-semibold text-green-600">€{(payment.net_amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenForm(payment)}
                      className="p-2 hover:bg-gray-100 rounded text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(payment.id)}
                      className="p-2 hover:bg-red-100 rounded text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPayment ? 'Editar Pagamento' : 'Novo Pagamento Avançado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Motorista *</Label>
              <select
                value={formData.driver_id}
                onChange={e => {
                  const driver = drivers.find(d => d.id === e.target.value);
                  setFormData(p => ({ ...p, driver_id: e.target.value, driver_name: driver?.full_name || '' }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Selecionar motorista...</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs">Valor do Adiantamento (€) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">Deduções Automáticas</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Via Verde (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.via_verde}
                    onChange={e => setFormData(p => ({ ...p, via_verde: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs">Miio (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.miio}
                    onChange={e => setFormData(p => ({ ...p, miio: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs">MyPRIO (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.myprio}
                    onChange={e => setFormData(p => ({ ...p, myprio: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-xs">IVA (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.iva_rate}
                    onChange={e => setFormData(p => ({ ...p, iva_rate: parseFloat(e.target.value) || 6 }))}
                    placeholder="6"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Valor Base:</span>
                <span className="font-semibold">€{formData.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA ({formData.iva_rate}%):</span>
                <span>-€{totals.ivaAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>UPI (4%):</span>
                <span>-€{totals.upiAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Outras Deduções:</span>
                <span>-€{((formData.via_verde || 0) + (formData.miio || 0) + (formData.myprio || 0)).toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-green-600">
                <span>Valor Líquido:</span>
                <span>€{totals.netAmount.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs">Notas</Label>
              <Input
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Observações sobre o pagamento"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleCloseForm}>Cancelar</Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending || !formData.driver_id}
              >
                {createMutation.isPending || updateMutation.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}