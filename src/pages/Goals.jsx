import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Target, Trophy, CheckCircle2, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const TYPE_LABELS = {
  weekly_revenue: 'Receita semanal',
  monthly_revenue: 'Receita mensal',
  trip_count: 'Número de viagens',
  passenger_rating: 'Avaliação passageiros',
  activity_days: '30 dias atividade contínua',
  zero_incidents: '0 incidentes',
};

const TYPE_UNIT = {
  weekly_revenue: '€',
  monthly_revenue: '€',
  trip_count: 'viagens',
  passenger_rating: '★',
  activity_days: 'dias',
  zero_incidents: 'incidentes',
};

export default function Goals({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [historyDialog, setHistoryDialog] = useState(false);
  const qc = useQueryClient();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.hasRole?.('admin');
  const isFleetManager = currentUser?.role === 'fleet_manager' || currentUser?.hasRole?.('fleet_manager');
  const isDriver = currentUser?.role === 'driver' || currentUser?.hasRole?.('driver');

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_date'),
  });
  const { data: allDrivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });
  const { data: weeklyPayments = [] } = useQuery({
    queryKey: ['weekly-payments'],
    queryFn: () => base44.entities.WeeklyPayment.list('-created_date', 500),
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

  const [form, setForm] = useState({ title: '', type: 'weekly_revenue', target_value: '', bonus_amount: '', driver_id: '', driver_name: '', is_global: true, period_start: '', period_end: '' });
  React.useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ title: '', type: 'weekly_revenue', target_value: '', bonus_amount: '', driver_id: '', driver_name: '', is_global: true, period_start: '', period_end: '' });
  }, [editing]);

  // Find my driver/fleet records
  const myDriverRecord = useMemo(() => isDriver ? allDrivers.find(d => d.email === currentUser?.email) : null, [allDrivers, currentUser, isDriver]);
  const myFleetManager = useMemo(() => isFleetManager ? fleetManagers.find(fm => fm.email === currentUser?.email || fm.user_id === currentUser?.id) : null, [fleetManagers, currentUser, isFleetManager]);
  const myDriverIds = useMemo(() => {
    if (!isFleetManager || !myFleetManager) return [];
    return allDrivers.filter(d => d.fleet_manager_id === myFleetManager.id).map(d => d.id);
  }, [allDrivers, myFleetManager, isFleetManager]);

  // Filter goals by role
  const visibleGoals = useMemo(() => {
    if (isAdmin) return goals;
    if (isFleetManager) return goals.filter(g => g.is_global || myDriverIds.includes(g.driver_id));
    if (isDriver && myDriverRecord) return goals.filter(g => g.is_global || g.driver_id === myDriverRecord.id);
    return [];
  }, [goals, isAdmin, isFleetManager, isDriver, myDriverRecord, myDriverIds]);

  // Bonus history from weekly payments
  const bonusHistory = useMemo(() => {
    let payments = weeklyPayments.filter(p => (p.goal_bonus || 0) > 0);
    if (isDriver && myDriverRecord) payments = payments.filter(p => p.driver_id === myDriverRecord.id);
    if (isFleetManager) payments = payments.filter(p => myDriverIds.includes(p.driver_id));
    return payments;
  }, [weeklyPayments, isDriver, isFleetManager, myDriverRecord, myDriverIds]);

  const drivers = useMemo(() => {
    if (isAdmin) return allDrivers;
    if (isFleetManager) return allDrivers.filter(d => myDriverIds.includes(d.id));
    return [];
  }, [allDrivers, isAdmin, isFleetManager, myDriverIds]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, target_value: parseFloat(form.target_value), bonus_amount: parseFloat(form.bonus_amount) };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const achievedGoals = visibleGoals.filter(g => g.status === 'achieved');
  const activeGoals = visibleGoals.filter(g => g.status === 'active');
  const totalBonusEarned = bonusHistory.reduce((s, p) => s + (p.goal_bonus || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Objetivos" 
        subtitle={isDriver ? "Os seus bónus de desempenho" : "Bónus por desempenho"} 
        actionLabel={isAdmin ? "Novo objetivo" : undefined}
        onAction={isAdmin ? () => setShowForm(true) : undefined}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Objetivos ativos</p>
          <p className="text-2xl font-bold text-indigo-600">{activeGoals.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Alcançados</p>
          <p className="text-2xl font-bold text-emerald-600">{achievedGoals.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setHistoryDialog(true)}>
          <p className="text-xs text-gray-500 mb-1">Total bónus ganhos</p>
          <p className="text-2xl font-bold text-amber-600">{fmt(totalBonusEarned)}</p>
        </div>
      </div>

      {/* Active goals */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">A carregar...</div>
      ) : visibleGoals.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum objetivo definido</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleGoals.map(goal => {
            const progress = goal.target_value > 0 ? Math.min(100, ((goal.current_value || 0) / goal.target_value) * 100) : 0;
            const isAchieved = goal.status === 'achieved' || progress >= 100;
            const unit = TYPE_UNIT[goal.type] || '';
            return (
              <Card 
                key={goal.id} 
                className={`border-0 shadow-sm hover:shadow-md transition-shadow ${isAdmin ? 'cursor-pointer' : ''} ${isAchieved ? 'ring-1 ring-emerald-300' : ''}`} 
                onClick={isAdmin ? () => { setEditing(goal); setShowForm(true); } : undefined}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{goal.title}</p>
                      <p className="text-xs text-gray-500">{TYPE_LABELS[goal.type]}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAchieved && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      <StatusBadge status={goal.status} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>{goal.current_value || 0}{unit} / {goal.target_value}{unit}</span>
                      <span className="font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className={`h-2 ${isAchieved ? '[&>div]:bg-emerald-500' : ''}`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{goal.is_global ? 'Todos os motoristas' : goal.driver_name || 'Específico'}</span>
                    <div className="flex items-center gap-1 text-amber-600">
                      <Trophy className="w-3.5 h-3.5" />
                      <span className="text-sm font-bold">{fmt(goal.bonus_amount)}</span>
                    </div>
                  </div>
                  {goal.period_start && goal.period_end && (
                    <p className="text-[10px] text-gray-400">{goal.period_start} → {goal.period_end}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bonus history dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4" /> Histórico de bónus ganhos</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {bonusHistory.length === 0 ? (
              <p className="text-center py-8 text-gray-400">Nenhum bónus registado</p>
            ) : bonusHistory.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="font-medium text-sm">{p.driver_name}</p>
                  <p className="text-xs text-gray-500">{p.period_label || `${p.week_start} → ${p.week_end}`}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">{fmt(p.goal_bonus)}</p>
                  <Badge variant="outline" className={p.status === 'paid' ? 'text-emerald-700 border-emerald-300' : 'text-amber-700 border-amber-300'}>
                    {p.status === 'paid' ? 'Pago' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit dialog — admin only */}
      {isAdmin && (
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
                <div className="space-y-1.5"><Label className="text-xs">Valor alvo</Label><Input type="number" step="0.01" value={form.target_value} onChange={(e) => setForm(f => ({...f, target_value: e.target.value}))} required /></div>
                <div className="space-y-1.5"><Label className="text-xs">Bónus (€)</Label><Input type="number" step="0.01" value={form.bonus_amount} onChange={(e) => setForm(f => ({...f, bonus_amount: e.target.value}))} required /></div>
                <div className="space-y-1.5 col-span-2"><Label className="text-xs">Motorista</Label>
                  <Select value={form.driver_id || 'all'} onValueChange={(v) => {
                    if (v === 'all') setForm(f => ({...f, driver_id: '', driver_name: '', is_global: true}));
                    else { const d = drivers.find(dr => dr.id === v); setForm(f => ({...f, driver_id: v, driver_name: d?.full_name || '', is_global: false})); }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os motoristas</SelectItem>
                      {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Início do período</Label><Input type="date" value={form.period_start || ''} onChange={(e) => setForm(f => ({...f, period_start: e.target.value}))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Fim do período</Label><Input type="date" value={form.period_end || ''} onChange={(e) => setForm(f => ({...f, period_end: e.target.value}))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Valor atual</Label><Input type="number" step="0.01" value={form.current_value || 0} onChange={(e) => setForm(f => ({...f, current_value: parseFloat(e.target.value)}))} /></div>
                {editing && (
                  <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
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
      )}
    </div>
  );
}