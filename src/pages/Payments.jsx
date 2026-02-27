import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit2, Trash2, DollarSign } from 'lucide-react';
import { format, startOfYear, endOfYear, eachWeekOfInterval } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  { value: 'processing', label: 'Processando', color: 'bg-blue-100 text-blue-700' },
  { value: 'approved', label: 'Aprovado', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'paid', label: 'Pago', color: 'bg-green-100 text-green-700' },
  { value: 'disputed', label: 'Contestado', color: 'bg-red-100 text-red-700' },
];

export default function Payments({ currentUser }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [formData, setFormData] = useState({
    driver_id: '', driver_name: '', week_start: '', week_end: '',
    contract_type: 'slot_standard', total_gross: 0, total_deductions: 0, net_amount: 0, status: 'draft'
  });

  const isAdmin = currentUser?.role?.includes('admin');
  const isFleetManager = currentUser?.role?.includes('fleet_manager');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-payments'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WeeklyPayment.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      handleCloseForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.WeeklyPayment.update(selectedPayment.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      handleCloseForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WeeklyPayment.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });

  const qc = useQueryClient();

  // Filter payments
  const filteredPayments = payments.filter(p => {
    const searchLower = search.toLowerCase();
    const matchSearch = !search || 
      p.driver_name?.toLowerCase().includes(searchLower) ||
      p.fleet_manager_name?.toLowerCase().includes(searchLower);
    
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchFleet = !isFleetManager || p.fleet_manager_id === currentUser?.id;
    
    return matchSearch && matchStatus && matchFleet;
  }).sort((a, b) => new Date(b.week_start) - new Date(a.week_start));

  const handleOpenForm = (payment = null) => {
    if (payment) {
      setSelectedPayment(payment);
      setFormData(payment);
    } else {
      setSelectedPayment(null);
      setFormData({
        driver_id: '', driver_name: '', week_start: '', week_end: '',
        contract_type: 'slot_standard', total_gross: 0, total_deductions: 0, net_amount: 0, status: 'draft'
      });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedPayment(null);
  };

  const handleSave = () => {
    const data = {
      driver_id: formData.driver_id,
      driver_name: formData.driver_name,
      fleet_manager_id: isFleetManager ? currentUser?.id : formData.fleet_manager_id,
      fleet_manager_name: isFleetManager ? currentUser?.full_name : formData.fleet_manager_name,
      week_start: formData.week_start,
      week_end: formData.week_end,
      contract_type: formData.contract_type,
      total_gross: parseFloat(formData.total_gross) || 0,
      total_deductions: parseFloat(formData.total_deductions) || 0,
      net_amount: parseFloat(formData.net_amount) || (parseFloat(formData.total_gross) || 0) - (parseFloat(formData.total_deductions) || 0),
      status: formData.status,
    };

    if (selectedPayment) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDriverSelect = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver) {
      setFormData(p => ({ ...p, driver_id: driverId, driver_name: driver.full_name }));
    }
  };

  // KPI Calculations
  const totalGross = filteredPayments.reduce((sum, p) => sum + (p.total_gross || 0), 0);
  const totalNet = filteredPayments.reduce((sum, p) => sum + (p.net_amount || 0), 0);
  const totalDeductions = filteredPayments.reduce((sum, p) => sum + (p.total_deductions || 0), 0);
  const paidPayments = filteredPayments.filter(p => p.status === 'paid').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Pagamentos"
        subtitle={`${filteredPayments.length} pagamentos`}
        actionLabel={isAdmin || isFleetManager ? "Novo Pagamento" : null}
        onAction={() => handleOpenForm()}
        actionIcon={Plus}
      >
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-full text-indigo-700">
            €{totalGross.toFixed(0)} bruto
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-full text-green-700">
            €{totalNet.toFixed(0)} líquido
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full text-emerald-700">
            {paidPayments} pagos
          </span>
        </div>
      </PageHeader>

      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por motorista ou gestor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {STATUS_OPTIONS.map(status => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                statusFilter === status.value
                  ? status.color
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : filteredPayments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum pagamento encontrado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredPayments.map(payment => {
            const statusConfig = STATUS_OPTIONS.find(s => s.value === payment.status);
            return (
              <div
                key={payment.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-gray-900">
                        {payment.driver_name}
                      </h3>
                      <Badge className={`text-xs border-0 ${statusConfig?.color || 'bg-gray-100 text-gray-700'}`}>
                        {statusConfig?.label || 'Desconhecido'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {payment.week_start ? format(new Date(payment.week_start), 'dd/MM/yyyy') : '—'} até {payment.week_end ? format(new Date(payment.week_end), 'dd/MM/yyyy') : '—'}
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400">Bruto</p>
                        <p className="font-semibold text-gray-900">€{(payment.total_gross || 0).toFixed(2)}</p>
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
                  {(isAdmin || isFleetManager) && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenForm(payment)}
                        className="p-2 hover:bg-gray-100 rounded text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(payment.id)}
                        className="p-2 hover:bg-red-100 rounded text-red-600"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPayment ? 'Editar Pagamento' : 'Novo Pagamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Motorista *</Label>
              <select
                value={formData.driver_id}
                onChange={e => handleDriverSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecionar motorista...</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Semana Inicial *</Label>
                <Input type="date" value={formData.week_start} onChange={e => setFormData(p => ({ ...p, week_start: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Semana Final *</Label>
                <Input type="date" value={formData.week_end} onChange={e => setFormData(p => ({ ...p, week_end: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo de Contrato</Label>
              <select value={formData.contract_type} onChange={e => setFormData(p => ({ ...p, contract_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="slot_standard">Slot Standard</option>
                <option value="slot_premium">Slot Premium</option>
                <option value="slot_black">Slot Black</option>
                <option value="location">Aluguel</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Ganhos Brutos (€) *</Label>
                <Input type="number" step="0.01" value={formData.total_gross} onChange={e => setFormData(p => ({ ...p, total_gross: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Deduções (€)</Label>
                <Input type="number" step="0.01" value={formData.total_deductions} onChange={e => setFormData(p => ({ ...p, total_deductions: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Valor Líquido (€)</Label>
              <Input type="number" step="0.01" value={formData.net_amount} onChange={e => setFormData(p => ({ ...p, net_amount: e.target.value }))} placeholder="0.00" />
              <p className="text-xs text-gray-400 mt-1">Auto-calculado: {(parseFloat(formData.total_gross || 0) - parseFloat(formData.total_deductions || 0)).toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={handleCloseForm}>Cancelar</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending || !formData.driver_id}>
                {createMutation.isPending || updateMutation.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}