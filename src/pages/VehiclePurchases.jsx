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

export default function VehiclePurchases() {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const qc = useQueryClient();

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['vehicle-purchases'],
    queryFn: () => base44.entities.VehiclePurchase.list('-created_date'),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.VehiclePurchase.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-purchases'] }); setShowForm(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VehiclePurchase.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicle-purchases'] }); setSelected(null); },
  });

  const [form, setForm] = useState({ driver_name: '', vehicle_id: '', duration_months: '' });

  const selectedVehicle = vehicles.find(v => v.id === form.vehicle_id);
  const basePrice = selectedVehicle?.base_purchase_price || 0;
  const totalPrice = basePrice * 1.25;
  const months = parseInt(form.duration_months) || 0;
  const weeklyInstallment = months > 0 ? totalPrice / (months * 4.33) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      driver_name: form.driver_name,
      driver_id: form.driver_name,
      vehicle_id: form.vehicle_id,
      vehicle_info: selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model} - ${selectedVehicle.license_plate}` : '',
      base_price: basePrice,
      total_price: totalPrice,
      duration_months: months,
      weekly_installment: weeklyInstallment,
      remaining_balance: totalPrice,
      status: 'requested',
    });
  };

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const columns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Veículo', render: (r) => <span className="text-sm">{r.vehicle_info}</span> },
    { header: 'Preço base', render: (r) => fmt(r.base_price) },
    { header: 'Preço total (+25%)', render: (r) => fmt(r.total_price) },
    { header: 'Semanal', render: (r) => <span className="font-medium text-indigo-600">{fmt(r.weekly_installment)}</span> },
    { header: 'Restante', render: (r) => <span className="text-red-600 font-medium">{fmt(r.remaining_balance)}</span> },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Compra de veículos" subtitle="Opção de compra para motoristas" actionLabel="Novo pedido" onAction={() => setShowForm(true)} />
      <DataTable columns={columns} data={purchases} isLoading={isLoading} onRowClick={setSelected} />

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditForm(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Compra — {selected?.driver_name}</DialogTitle></DialogHeader>
          {selected && !editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Veículo</span><p className="font-medium">{selected.vehicle_info}</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Preço total</span><p className="font-medium">{fmt(selected.total_price)}</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Duração</span><p className="font-medium">{selected.duration_months} meses</p></div>
                <div className="bg-gray-50 p-2 rounded"><span className="text-gray-500 text-xs">Restante</span><p className="font-medium text-red-600">{fmt(selected.remaining_balance)}</p></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditForm({ ...selected })}>Editar</Button>
                {selected.status === 'requested' && (
                  <>
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'active', start_date: new Date().toISOString().split('T')[0] } })}>Aprovar</Button>
                    <Button variant="outline" className="flex-1 text-red-600" onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'rejected' } })}>Rejeitar</Button>
                  </>
                )}
              </div>
            </div>
          )}
          {selected && editForm && <PurchaseEditForm purchase={editForm} onSave={(data) => { updateMutation.mutate({ id: selected.id, data }); setEditForm(null); }} onCancel={() => setEditForm(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo pedido de compra</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Motorista</Label><Input value={form.driver_name} onChange={(e) => setForm(f => ({...f, driver_name: e.target.value}))} required /></div>
            <div className="space-y-1.5"><Label className="text-xs">Veículo</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm(f => ({...f, vehicle_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Escolher veículo..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.filter(v => v.base_purchase_price > 0).map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} - {v.license_plate} ({fmt(v.base_purchase_price)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Duração (meses)</Label><Input type="number" value={form.duration_months} onChange={(e) => setForm(f => ({...f, duration_months: e.target.value}))} required /></div>
            {form.vehicle_id && form.duration_months && (
              <div className="bg-indigo-50 p-3 rounded-lg space-y-1 text-sm">
                <p>Preço base: <strong>{fmt(basePrice)}</strong></p>
                <p>Preço total (+25%): <strong className="text-indigo-700">{fmt(totalPrice)}</strong></p>
                <p>Pagamento semanal: <strong className="text-indigo-700">{fmt(weeklyInstallment)}</strong></p>
              </div>
            )}
            <Button type="submit" disabled={createMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">Criar pedido</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseEditForm({ purchase, onSave, onCancel }) {
  const [form, setForm] = useState({ ...purchase });
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ remaining_balance: parseFloat(form.remaining_balance), paid_amount: parseFloat(form.paid_amount), status: form.status });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs">Restante</Label><Input type="number" step="0.01" value={form.remaining_balance} onChange={(e) => setForm(f => ({ ...f, remaining_balance: e.target.value }))} /></div>
      <div className="space-y-1.5"><Label className="text-xs">Pago</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm(f => ({ ...f, paid_amount: e.target.value }))} /></div>
      <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
        <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="requested">Solicitado</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
      </div>
    </form>
  );
}