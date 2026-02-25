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
  weekly_revenue: 'CA hebdomadaire',
  monthly_revenue: 'CA mensuel',
  trip_count: 'Nombre de trajets',
  passenger_rating: 'Note passagers',
};

export default function Goals() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Goal.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowForm(false); },
  });

  const [form, setForm] = useState({ title: '', type: 'weekly_revenue', target_value: '', bonus_amount: '', driver_name: '', is_global: false });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      target_value: parseFloat(form.target_value),
      bonus_amount: parseFloat(form.bonus_amount),
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Objectifs" subtitle="Bonus par performance" actionLabel="Nouvel objectif" onAction={() => setShowForm(true)} />

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun objectif défini</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(goal => {
            const progress = goal.target_value > 0 ? Math.min(100, ((goal.current_value || 0) / goal.target_value) * 100) : 0;
            return (
              <Card key={goal.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
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
                    <span className="text-xs text-gray-500">{goal.is_global ? 'Tous les chauffeurs' : goal.driver_name || 'Spécifique'}</span>
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvel objectif</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs">Titre</Label><Input value={form.title} onChange={(e) => setForm(f => ({...f, title: e.target.value}))} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({...f, type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Objectif</Label><Input type="number" step="0.01" value={form.target_value} onChange={(e) => setForm(f => ({...f, target_value: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Bonus (€)</Label><Input type="number" step="0.01" value={form.bonus_amount} onChange={(e) => setForm(f => ({...f, bonus_amount: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Chauffeur (vide = global)</Label><Input value={form.driver_name} onChange={(e) => setForm(f => ({...f, driver_name: e.target.value, is_global: !e.target.value}))} /></div>
            </div>
            <Button type="submit" disabled={createMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">Créer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}