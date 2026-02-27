import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, Plus, Edit, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function ReportScheduler({ currentUser }) {
  const qc = useQueryClient();
  const isAdmin = currentUser?.role?.includes('admin');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    frequency: 'weekly',
    day_of_week: 1,
    day_of_month: 1,
    time_of_day: '08:00',
    delivery_channels: ['email'],
    email_recipients: '',
    is_active: true,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['report-schedules'],
    queryFn: () => base44.entities.ReportSchedule.list('-created_date'),
    enabled: isAdmin,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['report-schedule-logs'],
    queryFn: () => base44.entities.ReportScheduleLog.list('-created_date', 50),
    enabled: isAdmin,
  });

  const createScheduleMutation = useMutation({
    mutationFn: (data) => base44.entities.ReportSchedule.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-schedules'] });
      resetForm();
      setShowNewDialog(false);
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: (data) => base44.entities.ReportSchedule.update(editingSchedule.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-schedules'] });
      resetForm();
      setEditingSchedule(null);
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => base44.entities.ReportSchedule.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-schedules'] });
    },
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: (schedule) =>
      base44.entities.ReportSchedule.update(schedule.id, { is_active: !schedule.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-schedules'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      frequency: 'weekly',
      day_of_week: 1,
      day_of_month: 1,
      time_of_day: '08:00',
      delivery_channels: ['email'],
      email_recipients: '',
      is_active: true,
    });
    setEditingSchedule(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email_recipients) {
      alert('Nome e emails de destino são obrigatórios');
      return;
    }

    const data = {
      ...formData,
      email_recipients: formData.email_recipients,
      report_config: {
        type: 'fleet_performance',
        period: 'custom',
        metrics: ['drivers', 'vehicles', 'revenue', 'expenses'],
      },
    };

    if (editingSchedule) {
      await updateScheduleMutation.mutate(data);
    } else {
      await createScheduleMutation.mutate(data);
    }
  };

  const handleEdit = (schedule) => {
    setFormData({
      name: schedule.name || '',
      frequency: schedule.frequency || 'weekly',
      day_of_week: schedule.day_of_week || 1,
      day_of_month: schedule.day_of_month || 1,
      time_of_day: schedule.time_of_day || '08:00',
      delivery_channels: schedule.delivery_channels || ['email'],
      email_recipients: schedule.email_recipients || '',
      is_active: schedule.is_active !== false,
    });
    setEditingSchedule(schedule);
  };

  const recentLogs = useMemo(() => {
    return logs.slice(0, 5);
  }, [logs]);

  if (!isAdmin) {
    return <div className="text-center py-12 text-gray-500">Acesso restrito a administradores</div>;
  }

  const FREQUENCY_LABELS = {
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
  };

  const DAY_LABELS = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendamento de Relatórios"
        subtitle="Configure relatórios recorrentes automáticos"
        actionLabel="Novo Relatório"
        onAction={() => {
          resetForm();
          setShowNewDialog(true);
        }}
      />

      {/* Schedules List */}
      <div className="grid gap-3">
        {schedules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Nenhum relatório agendado. Clique em "Novo Relatório" para começar.
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{schedule.name}</h3>
                      <Badge className={`${schedule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'} border-0`}>
                        {schedule.is_active ? '✓ Ativo' : '○ Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {FREQUENCY_LABELS[schedule.frequency]} à {schedule.time_of_day}
                      {schedule.frequency === 'weekly' && ` - ${DAY_LABELS[schedule.day_of_week]}`}
                      {schedule.frequency === 'monthly' && ` - Dia ${schedule.day_of_month}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      Destinatários: {schedule.email_recipients}
                    </p>
                    {schedule.last_run_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Última execução: {format(parseISO(schedule.last_run_at), 'dd/MM/yyyy HH:mm')}
                        <span className={`ml-2 font-semibold ${schedule.last_run_status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          ({schedule.last_run_status})
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleScheduleMutation.mutate(schedule)}
                    >
                      {schedule.is_active ? 'Pausar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(schedule)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Execution Logs */}
      {recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Últimas Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex items-center gap-3 flex-1">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{log.schedule_name}</p>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(log.created_date), 'dd/MM/yyyy HH:mm')}
                        {log.rows_exported && ` · ${log.rows_exported} registros`}
                      </p>
                    </div>
                  </div>
                  {log.error_message && (
                    <span className="text-xs text-red-600">{log.error_message}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New/Edit Dialog */}
      <Dialog open={showNewDialog || !!editingSchedule} onOpenChange={(open) => {
        if (!open) {
          resetForm();
          setShowNewDialog(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Editar Relatório' : 'Novo Relatório Agendado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Nome do Relatório</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Performance Mensal"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Frequência</Label>
              <Select value={formData.frequency} onValueChange={(v) => setFormData(f => ({ ...f, frequency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.frequency === 'weekly' && (
              <div className="space-y-1">
                <Label className="text-xs">Dia da Semana</Label>
                <Select value={formData.day_of_week.toString()} onValueChange={(v) => setFormData(f => ({ ...f, day_of_week: parseInt(v) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.frequency === 'monthly' && (
              <div className="space-y-1">
                <Label className="text-xs">Dia do Mês</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.day_of_month}
                  onChange={(e) => setFormData(f => ({ ...f, day_of_month: parseInt(e.target.value) }))}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Hora do Dia</Label>
              <Input
                type="time"
                value={formData.time_of_day}
                onChange={(e) => setFormData(f => ({ ...f, time_of_day: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Emails de Destino (separados por vírgula)</Label>
              <Input
                value={formData.email_recipients}
                onChange={(e) => setFormData(f => ({ ...f, email_recipients: e.target.value }))}
                placeholder="admin@example.com, manager@example.com"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowNewDialog(false);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {editingSchedule ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}