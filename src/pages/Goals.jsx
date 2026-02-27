import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Trophy } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const TYPE_LABELS = {
  weekly_revenue: 'Receita semanal',
  monthly_revenue: 'Receita mensal',
  trip_count: 'Número de viagens',
  passenger_rating: 'Avaliação passageiros',
};

export default function Goals() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_date'),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Goal.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Goal.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setEditing(null); setShowForm(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Goal.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowForm(false); setEditing(null); },
  });

  const [form, setForm] = useState(editing || { title: '', type: 'weekly_revenue', target_value: '', bonus_amount: '', driver_id: '', driver_name: '', is_global: false });

  React.useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ title: '', type: 'weekly_revenue', target_value: '', bonus_amount: '', driver_id: '', driver_name: '', is_global: false });
  }, [editing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, target_value: parseFloat(form.target_value), bonus_amount: parseFloat(form.bonus_amount) };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Objetivos" subtitle="Bónus por desempenho" actionLabel="Novo objetivo" onAction={() => setShowForm(true)} />

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum objetivo definido</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(goal => {
            const progress = goal.target_value > 0 ? Math.min(100, ((goal.current_value || 0) / goal.target_value) * 100) : 0;
            return (
              <Card key={goal.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setEditing(goal); setShowForm(true); }}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{goal.title}</p>
                      <p className="text-xs text-gray-500">{TYPE_LABELS[goal.type]}</p>
                    </div>
                    <StatusBadge status={goal.status} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{goal.current_value || 0} / {goal.target_value}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{goal.is_global ? 'Todos os motoristas' : goal.driver_name || 'Específico'}</span>
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Trophy className="w-3.5 h-3.5" />
                      <span className="text-sm font-bold">€{goal.bonus_amount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} objetivo</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Título</Label><Input value={form.title} onChange={(e) => setForm(f => ({...f, title: e.target.value}))} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({...f, type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Objetivo</Label><Input type="number" step="0.01" value={form.target_value} onChange={(e) => setForm(f => ({...f, target_value: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Bónus (€)</Label><Input type="number" step="0.01" value={form.bonus_amount} onChange={(e) => setForm(f => ({...f, bonus_amount: e.target.value}))} required /></div>
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Motorista</Label>
                <Select value={form.driver_id || 'all'} onValueChange={(v) => { 
                  if (v === 'all') {
                    setForm(f => ({...f, driver_id: '', driver_name: '', is_global: true}));
                  } else {
                    const d = drivers.find(dr => dr.id === v);
                    setForm(f => ({...f, driver_id: v, driver_name: d?.full_name || '', is_global: false}));
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os motoristas</SelectItem>
                    {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editing && (
                <div className="space-y-1.5 col-span-2"><Label className="text-xs">Estado</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(f => ({...f, status: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="achieved">Alcançado</SelectItem>
                      <SelectItem value="failed">Falhado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {editing && <Button type="button" variant="outline" className="flex-1 text-red-600" onClick={() => { if (confirm('Eliminar objetivo?')) deleteMutation.mutate(editing.id); }}>Eliminar</Button>}
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className={editing ? "flex-1 bg-indigo-600 hover:bg-indigo-700" : "w-full bg-indigo-600 hover:bg-indigo-700"}>{editing ? 'Atualizar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}