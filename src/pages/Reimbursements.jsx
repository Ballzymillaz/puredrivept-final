import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Eye } from 'lucide-react';
import { format } from 'date-fns';

const CAT_LABELS = {
  fuel: 'Combustível',
  maintenance: 'Manutenção',
  cleaning: 'Limpeza',
  tolls: 'Portagens',
  bonus: 'Bónus',
  penalty: 'Penalidade',
  other: 'Outro',
};

export default function Reimbursements({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ category: 'other', type: 'credit', amount: '', description: '' });
  const [file, setFile] = useState(null);
  const qc = useQueryClient();

  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.role === 'admin';
  const isFleetManager = !isAdmin && (currentUser?.roles?.includes('fleet_manager') || currentUser?.role === 'fleet_manager');
  const isDriver = !isAdmin && !isFleetManager && (currentUser?.roles?.includes('driver') || currentUser?.role === 'driver');

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const myDriverRecord = isDriver ? drivers.find(d => d.user_id === currentUser?.id || d.email === currentUser?.email) : null;

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ['financial-adjustments', currentUser?.id],
    queryFn: async () => {
      const all = await base44.entities.FinancialAdjustment.list('-created_date');
      if (isDriver && myDriverRecord) {
        return all.filter(a => a.driver_id === myDriverRecord.id);
      }
      if (isFleetManager) {
        const myDriverIds = new Set(drivers.filter(d => d.fleet_manager_id === currentUser?.id || d.fleet_manager_id === currentUser?.email).map(d => d.id));
        return all.filter(a => myDriverIds.has(a.driver_id));
      }
      return all;
    },
    enabled: !isDriver || !!myDriverRecord,
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.FinancialAdjustment.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-adjustments'] }); setShowForm(false); resetForm(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FinancialAdjustment.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-adjustments'] }); setShowForm(false); resetForm(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FinancialAdjustment.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-adjustments'] }); setShowForm(false); resetForm(); },
  });

  const resetForm = () => { setEditing(null); setFile(null); setForm({ category: 'other', type: 'credit', amount: '', description: '' }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let receipt_url = editing?.receipt_url || '';
    if (file) {
      const res = await base44.integrations.Core.UploadFile({ file });
      receipt_url = res.file_url;
    }
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: { ...form, amount: parseFloat(form.amount), receipt_url } });
    } else {
      const driver = isDriver ? myDriverRecord : drivers.find(d => d.id === form.driver_id);
      await createMutation.mutateAsync({
        ...form,
        driver_id: isDriver ? myDriverRecord?.id : form.driver_id,
        driver_name: driver?.full_name || '',
        amount: parseFloat(form.amount),
        receipt_url,
        status: 'pending',
        created_by: currentUser?.email,
        type: isDriver ? 'credit' : form.type,
      });
    }
    setFile(null);
  };

  const handleApprove = (r) => updateMutation.mutate({ id: r.id, data: { status: 'approved', approved_by: currentUser?.email } });
  const handleReject = (r) => updateMutation.mutate({ id: r.id, data: { status: 'rejected', approved_by: currentUser?.email } });

  const fmt = (v) => `€${(v || 0).toFixed(2)}`;

  const columns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Tipo', render: (r) => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.type === 'credit' ? 'Crédito' : 'Débito'}</span> },
    { header: 'Categoria', render: (r) => <span className="text-sm">{CAT_LABELS[r.category] || r.category}</span> },
    { header: 'Montante', render: (r) => <span className={`font-medium ${r.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.amount)}</span> },
    { header: 'Data', render: (r) => <span className="text-xs text-gray-500">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy') : '—'}</span> },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Ações', render: (r) => (
        <div className="flex gap-1">
          {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-100 rounded"><Eye className="w-4 h-4 text-gray-500" /></a>}
          {r.status === 'pending' && isAdmin && (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleApprove(r); }} className="p-1.5 hover:bg-emerald-50 rounded"><Check className="w-4 h-4 text-emerald-600" /></button>
              <button onClick={(e) => { e.stopPropagation(); handleReject(r); }} className="p-1.5 hover:bg-red-50 rounded"><X className="w-4 h-4 text-red-500" /></button>
            </>
          )}
        </div>
      ),
    },
  ];

  const canCreate = isAdmin;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ajustamentos Financeiros"
        subtitle={`${adjustments.length} pedidos`}
        actionLabel={canCreate ? 'Novo pedido' : undefined}
        onAction={canCreate ? () => { resetForm(); setShowForm(true); } : undefined}
      />
      <DataTable
        columns={columns}
        data={adjustments}
        isLoading={isLoading}
        onRowClick={(r) => {
          if (isAdmin || (isDriver && r.status === 'pending' && r.driver_id === myDriverRecord?.id)) {
            setEditing(r);
            setForm({ ...r });
            setShowForm(true);
          }
        }}
      />

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); setShowForm(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} ajustamento financeiro</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isDriver && (
              <div className="space-y-1.5">
                <Label className="text-xs">Motorista</Label>
                <Select value={form.driver_id || ''} onValueChange={(v) => { const d = drivers.find(dr => dr.id === v); setForm(f => ({ ...f, driver_id: v, driver_name: d?.full_name || '' })); }}>
                  <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                  <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {isAdmin && !editing && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Crédito (a favor do motorista)</SelectItem>
                    <SelectItem value="debit">Débito (contra o motorista)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Montante (€)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description || ''} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Comprovativo</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files[0])} accept="image/*,.pdf" />
            </div>

            {editing && isAdmin && (
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2">
              {editing && isAdmin && (
                <Button type="button" variant="outline" className="flex-1 text-red-600" onClick={() => { if (confirm('Eliminar ajustamento?')) deleteMutation.mutate(editing.id); }}>
                  Eliminar
                </Button>
              )}
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                {(createMutation.isPending || updateMutation.isPending) ? 'A guardar...' : editing ? 'Atualizar' : 'Criar pedido'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}