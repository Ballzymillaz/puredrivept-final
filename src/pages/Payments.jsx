import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import StatCard from '../components/dashboard/StatCard';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { format } from 'date-fns';

export default function Payments() {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [editMode, setEditMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState(null);
  const qc = useQueryClient();

  const { data: revenues = [], isLoading } = useQuery({
    queryKey: ['weekly-revenues'],
    queryFn: () => base44.entities.WeeklyRevenues.list('-week_start_date', 100),
  });

  const { data: drivers = [], isLoading: driversLoading, error: driversError } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      console.log('Fetching drivers...');
      try {
        const result = await base44.entities.Drivers.list();
        console.log('Drivers loaded:', result);
        return result;
      } catch (err) {
        console.error('Error loading drivers:', err);
        throw err;
      }
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => base44.entities.Ledger.list('-date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.WeeklyRevenues.create(d),
    onSuccess: async () => { 
      await qc.invalidateQueries({ queryKey: ['weekly-revenues'] });
      setShowForm(false); 
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const result = await base44.entities.WeeklyRevenues.update(id, data);
      
      // Create ledger entry if paid
      if (data.status === 'paid') {
        try {
          await base44.entities.Ledger.create({
            date: new Date().toISOString().split('T')[0],
            city_id: data.city_id,
            driver_id: data.driver_id,
            type: 'payout',
            amount: data.net_driver_payout || 0,
            description: `Pagamento semanal - ${data.driver_name}`,
            reference_id: id,
          });
        } catch (error) {
          console.error('Erro criando ledger:', error);
        }
      }
      return result;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['weekly-revenues'] });
      await qc.invalidateQueries({ queryKey: ['ledger'] });
      setEditMode(false);
      setSelected(null);
    },
  });

  const filtered = revenues.filter(r => {
    const statusMatch = statusFilter === 'all' || r.status === statusFilter;
    const driverMatch = driverFilter === 'all' || r.driver_id === driverFilter;
    return statusMatch && driverMatch;
  });

  const totalGross = filtered.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalNet = filtered.reduce((s, r) => s + (r.net_driver_payout || 0), 0);
  const totalUPI = filtered.reduce((s, r) => s + (r.upi_4_percent || 0), 0);

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const columns = [
    { header: 'Motorista', render: (r) => <span className="font-medium text-sm">{r.driver_name}</span> },
    { header: 'Período', render: (r) => <span className="text-sm">{r.week_start_date} a {r.week_end_date}</span> },
    { header: 'Bruto', render: (r) => <span className="text-sm font-medium text-gray-900">{fmt(r.total_revenue)}</span> },
    { header: 'UPI (4%)', render: (r) => <span className="text-sm text-violet-600">{r.upi_4_percent.toFixed(0)}</span> },
    { header: 'Líquido', render: (r) => <span className="text-sm font-bold text-indigo-700">{fmt(r.net_driver_payout)}</span> },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Pagamentos Semanais" subtitle={`${revenues.length} períodos`} actionLabel="Novo pagamento" onAction={() => { setShowForm(true); }} />
      
      <div className="flex flex-wrap gap-3">
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os motoristas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motoristas</SelectItem>
            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="validated">Validado</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cursor-pointer" onClick={() => setDetailsDialog('gross')}>
          <StatCard title="Total bruto" value={fmt(totalGross)} icon={TrendingUp} color="green" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('upi')}>
          <StatCard title="UPI gerado" value={totalUPI.toFixed(0)} icon={Wallet} color="violet" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('net')}>
          <StatCard title="Líquido a pagar" value={fmt(totalNet)} icon={Wallet} color="indigo" />
        </div>
      </div>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelected} />

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setEditMode(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe pagamento — {selected?.driver_name}</DialogTitle>
          </DialogHeader>
          {selected && !editMode && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Uber', fmt(selected.uber_revenue)],
                  ['Bolt', fmt(selected.bolt_revenue)],
                  ['Outros', fmt(selected.other_revenue)],
                  ['Total bruto', fmt(selected.total_revenue)],
                  ['UPI (4%)', selected.upi_4_percent.toFixed(0)],
                  ['Aluguer veículo', fmt(selected.rent_due)],
                  ['Empréstimo', fmt(selected.loan_due)],
                  ['Seguros', fmt(selected.insurance)],
                  ['Outras deduções', fmt(selected.other_deductions)],
                  ['6% IVA', fmt(selected.iva_6_percent)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between p-3 bg-indigo-50 rounded-lg text-indigo-900 font-bold">
                <span>Líquido a pagar</span>
                <span>{fmt(selected.net_driver_payout)}</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setEditMode(true)} variant="outline" className="flex-1">Editar</Button>
                <Select value={selected.status} onValueChange={(v) => updateMutation.mutate({ id: selected.id, data: { status: v } })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="validated">Validado</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {selected && editMode && <RevenueEditForm revenue={selected} onSave={(data) => updateMutation.mutate({ id: selected.id, data })} onCancel={() => setEditMode(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo pagamento semanal</DialogTitle></DialogHeader>
          <NewRevenueForm drivers={drivers} onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === 'gross' && 'Detalhes: Total Bruto'}
              {detailsDialog === 'upi' && 'Detalhes: UPI Gerado'}
              {detailsDialog === 'net' && 'Detalhes: Líquido a Pagar'}
            </DialogTitle>
          </DialogHeader>
          <RevenueDetailsContent type={detailsDialog} revenues={filtered} fmt={fmt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RevenueDetailsContent({ type, revenues, fmt }) {
  if (type === 'gross') {
    const total = revenues.reduce((s, r) => s + (r.total_revenue || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {revenues.map(r => (
            <div key={r.id} className="flex justify-between items-center p-2 border-b">
              <div>
                <p className="font-medium text-sm">{r.driver_name}</p>
                <p className="text-xs text-gray-500">{r.week_start_date}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{fmt(r.total_revenue)}</p>
                <p className="text-xs text-gray-500">Uber: {fmt(r.uber_revenue)} | Bolt: {fmt(r.bolt_revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'upi') {
    const total = revenues.reduce((s, r) => s + (r.upi_4_percent || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-violet-50 rounded-lg">
          <p className="text-sm font-semibold">Total UPI: {total.toFixed(0)}</p>
        </div>
        <div className="space-y-2">
          {revenues.filter(r => r.upi_4_percent > 0).map(r => (
            <div key={r.id} className="flex justify-between items-center p-2 border-b">
              <div>
                <p className="font-medium text-sm">{r.driver_name}</p>
                <p className="text-xs text-gray-500">{r.week_start_date}</p>
              </div>
              <p className="font-medium">{r.upi_4_percent.toFixed(0)} UPI</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'net') {
    const total = revenues.reduce((s, r) => s + (r.net_driver_payout || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-indigo-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {revenues.map(r => (
            <div key={r.id} className="flex justify-between items-center p-2 border-b">
              <div>
                <p className="font-medium text-sm">{r.driver_name}</p>
                <p className="text-xs text-gray-500">{r.week_start_date}</p>
              </div>
              <p className="font-bold text-indigo-700">{fmt(r.net_driver_payout)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function RevenueEditForm({ revenue, onSave, onCancel }) {
  const [form, setForm] = React.useState({ ...revenue });
  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: parseFloat(v) || 0 }));
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const totalRev = (form.uber_revenue || 0) + (form.bolt_revenue || 0) + (form.other_revenue || 0);
    const upi = totalRev * 0.04;
    const iva = (form.uber_revenue + form.bolt_revenue) * 0.06;
    const totalDeductions = (form.rent_due || 0) + (form.loan_due || 0) + (form.insurance || 0) + (form.other_deductions || 0) + upi + iva;
    const netPayout = totalRev - totalDeductions;
    
    onSave({ 
      ...form, 
      total_revenue: totalRev,
      upi_4_percent: upi,
      iva_6_percent: iva,
      net_driver_payout: netPayout
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Uber', 'uber_revenue'], 
          ['Bolt', 'bolt_revenue'], 
          ['Outros', 'other_revenue'],
          ['Aluguer', 'rent_due'], 
          ['Empréstimo', 'loan_due'], 
          ['Seguros', 'insurance'],
          ['Outras deduções', 'other_deductions'],
        ].map(([label, key]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input type="number" step="0.01" value={form[key] || 0} onChange={(e) => handleChange(key, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
      </div>
    </form>
  );
}

function NewRevenueForm({ drivers, onSubmit, isLoading, onCancel }) {
  const [form, setForm] = React.useState({
    driver_id: '',
    city_id: '',
    week_start_date: '',
    week_end_date: '',
    uber_revenue: 0,
    bolt_revenue: 0,
    other_revenue: 0,
  });

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.driver_id || !form.week_start_date) return;

    console.log('Drivers list:', drivers);
    console.log('Selected driver_id:', form.driver_id, 'Type:', typeof form.driver_id);
    
    const driver = drivers.find(d => String(d.id) === String(form.driver_id));
    if (!driver) {
      console.error('Driver not found. Available IDs:', drivers.map(d => d.id));
      return;
    }

    if (!driver.city_id) {
      console.error('Driver does not have city_id:', driver);
      return;
    }

    const payload = {
      driver_id: form.driver_id,
      city_id: driver.city_id,
      week_start_date: form.week_start_date,
      week_end_date: form.week_end_date || form.week_start_date,
      uber_revenue: parseFloat(form.uber_revenue) || 0,
      bolt_revenue: parseFloat(form.bolt_revenue) || 0,
      other_revenue: parseFloat(form.other_revenue) || 0,
    };

    console.log('Selected Driver:', driver);
    console.log('Payload enviado:', payload);
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Motorista *</Label>
        <Select value={form.driver_id} onValueChange={(v) => {
          const selectedDriver = drivers.find(d => d.id === v);
          console.log('Selected Driver:', selectedDriver);
          handleChange('driver_id', v);
        }}>
          <SelectTrigger><SelectValue placeholder="Escolher motorista..." /></SelectTrigger>
          <SelectContent>
            {drivers.map(d => (
              <SelectItem key={d.id} value={String(d.id)}>{d.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Data inicio *</Label><Input type="date" value={form.week_start_date} onChange={(e) => handleChange('week_start_date', e.target.value)} required /></div>
        <div className="space-y-1.5"><Label className="text-xs">Data fim</Label><Input type="date" value={form.week_end_date} onChange={(e) => handleChange('week_end_date', e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Uber (€)</Label><Input type="number" step="0.01" value={form.uber_revenue} onChange={(e) => handleChange('uber_revenue', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Bolt (€)</Label><Input type="number" step="0.01" value={form.bolt_revenue} onChange={(e) => handleChange('bolt_revenue', e.target.value)} /></div>
      </div>

      <div className="space-y-1.5"><Label className="text-xs">Outros (€)</Label><Input type="number" step="0.01" value={form.other_revenue} onChange={(e) => handleChange('other_revenue', e.target.value)} /></div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={isLoading || !form.driver_id} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
          {isLoading ? 'A criar...' : 'Criar pagamento'}
        </Button>
      </div>
    </form>
  );
}