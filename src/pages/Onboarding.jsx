import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import OnboardingSteps from '../components/onboarding/OnboardingSteps';
import DocumentsStep from '../components/onboarding/DocumentsStep';
import BackgroundCheckStep from '../components/onboarding/BackgroundCheckStep';
import VehicleAssignmentStep from '../components/onboarding/VehicleAssignmentStep';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, ClipboardList, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STEP_LABELS = {
  documents: 'Documentos',
  background_check: 'Antecedentes',
  vehicle_assignment: 'Veículo',
  completed: 'Concluído',
};

const STATUS_COLORS = {
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

export default function Onboarding({ currentUser }) {
  const qc = useQueryClient();
  const isAdmin = currentUser?.role?.includes('admin') || currentUser?.role?.includes('fleet_manager');
  const isDriver = currentUser?.role?.includes('driver');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ driver_name: '', driver_email: '', driver_id: '' });
  const [creating, setCreating] = useState(false);

  const { data: onboardings = [], isLoading } = useQuery({
    queryKey: ['onboardings'],
    queryFn: () => base44.entities.DriverOnboarding.list('-created_date'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['invited-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  // Driver sees only their own onboarding
  const visibleOnboardings = isDriver
    ? onboardings.filter(o => o.driver_email === currentUser?.email)
    : onboardings.filter(o =>
        !search ||
        o.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.driver_email?.toLowerCase().includes(search.toLowerCase())
      );

  const handleCreate = async () => {
    setCreating(true);
    const record = await base44.entities.DriverOnboarding.create({
      ...newForm,
      current_step: 'documents',
      status: 'in_progress',
      documents_status: 'pending',
      background_check_status: 'pending',
      vehicle_assignment_status: 'pending',
    });
    
    // Send welcome email to driver
    await base44.integrations.Core.SendEmail({
      to: newForm.driver_email,
      from_name: 'PureDrivePT',
      subject: '[PureDrivePT] Bem-vindo ao processo de Onboarding',
      body: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9"><div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)"><div style="background:#4f46e5;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px"><h1 style="color:white;margin:0;font-size:20px">PureDrive<sup style="font-size:11px">PT</sup></h1></div><p style="color:#374151;font-size:16px">Olá <strong>${newForm.driver_name}</strong>,</p><p style="color:#374151;font-size:15px;line-height:1.6">Bem-vindo ao processo de onboarding da PureDrivePT! Iniciámos o seu processo de integração com sucesso.</p><div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:24px 0"><p style="margin:0;color:#374151;font-size:14px"><strong>Próximos passos:</strong></p><ol style="color:#6b7280;margin:8px 0 0 20px"><li>Submeter os documentos obrigatórios</li><li>Aguardar verificação de antecedentes</li><li>Receber atribuição de veículo</li></ol></div><p style="color:#6b7280;font-size:14px">Aceda à plataforma PureDrivePT para começar o seu onboarding.</p><p style="color:#9ca3af;font-size:12px;margin-top:24px">Esta é uma mensagem automática — não responda a este email.</p></div></body></html>`,
    });
    
    await base44.entities.Notification.create({
      title: `🆕 Novo onboarding iniciado — ${newForm.driver_name}`,
      message: `Foi iniciado o processo de onboarding para o motorista ${newForm.driver_name}.`,
      type: 'info',
      category: 'driver_performance',
      recipient_role: 'admin',
      related_entity: record.id,
    });
    
    setCreating(false);
    setShowNew(false);
    setNewForm({ driver_name: '', driver_email: '', driver_id: '' });
    qc.invalidateQueries({ queryKey: ['onboardings'] });
  };

  const handleDriverSelect = (driverId) => {
    const d = drivers.find(dr => dr.id === driverId);
    if (d) setNewForm({ driver_id: d.id, driver_name: d.full_name, driver_email: d.email });
  };

  const handleUpdate = () => {
    qc.invalidateQueries({ queryKey: ['onboardings'] });
    if (selected) {
      // Refresh selected
      base44.entities.DriverOnboarding.filter({ id: selected.id }).then(res => {
        if (res.length > 0) setSelected(res[0]);
      });
    }
  };

  const stats = {
    total: onboardings.length,
    inProgress: onboardings.filter(o => o.status === 'in_progress').length,
    blocked: onboardings.filter(o => o.status === 'blocked').length,
    completed: onboardings.filter(o => o.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding de Motoristas"
        subtitle={`${stats.inProgress} em curso · ${stats.completed} concluídos`}
        actionLabel={isAdmin ? "Iniciar Onboarding" : null}
        onAction={() => setShowNew(true)}
        actionIcon={Plus}
      >
        {isAdmin && (
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-full text-blue-700">
              <Clock className="w-3 h-3" />{stats.inProgress} em curso
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-full text-red-700">
              <AlertTriangle className="w-3 h-3" />{stats.blocked} bloqueados
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />{stats.completed} concluídos
            </span>
          </div>
        )}
      </PageHeader>

      {isAdmin && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar motorista..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">A carregar...</div>
      ) : visibleOnboardings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum processo de onboarding encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {isAdmin && users.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Utilizadores convidados (sem onboarding)</h3>
              <div className="space-y-2">
                {users.filter(u => !onboardings.some(ob => ob.driver_email === u.email)).map(user => (
                  <div key={user.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                        {user.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => {
                        setNewForm({ driver_name: user.full_name, driver_email: user.email, driver_id: '' });
                        setShowNew(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      Iniciar onboarding
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3">
          {visibleOnboardings.map(ob => (
            <div
              key={ob.id}
              onClick={() => setSelected(ob)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                  {ob.driver_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{ob.driver_name}</p>
                  <p className="text-xs text-gray-400">{ob.driver_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 hidden sm:block">
                  Etapa: <span className="font-medium text-gray-700">{STEP_LABELS[ob.current_step]}</span>
                </span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[ob.status] || 'bg-gray-100 text-gray-500'}`}>
                  {ob.status === 'in_progress' ? 'Em curso' : ob.status === 'blocked' ? 'Bloqueado' : 'Concluído'}
                </span>
                {ob.created_date && (
                  <span className="text-xs text-gray-400 hidden md:block">
                    {format(new Date(ob.created_date), 'dd/MM/yyyy')}
                  </span>
                )}
              </div>
            </div>
          ))}
          </div>
          </div>
          )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-500" />
                  Onboarding — {selected.driver_name}
                </DialogTitle>
              </DialogHeader>
              <OnboardingSteps currentStep={selected.current_step} status={selected.status} />

              {selected.current_step === 'documents' && (
                <DocumentsStep onboarding={selected} isAdmin={isAdmin} onUpdate={handleUpdate} />
              )}
              {selected.current_step === 'background_check' && (
                <BackgroundCheckStep onboarding={selected} isAdmin={isAdmin} onUpdate={handleUpdate} />
              )}
              {selected.current_step === 'vehicle_assignment' && (
                <VehicleAssignmentStep onboarding={selected} isAdmin={isAdmin} onUpdate={handleUpdate} />
              )}
              {selected.current_step === 'completed' && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="font-semibold text-gray-800 text-lg">Onboarding Concluído!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Veículo: {selected.assigned_vehicle_info || '—'}
                  </p>
                  {selected.completed_date && (
                    <p className="text-xs text-gray-400 mt-1">
                      Concluído em {format(new Date(selected.completed_date), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Onboarding Dialog */}
      {isAdmin && (
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Iniciar novo onboarding</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-500">Selecionar motorista existente</Label>
                <Select onValueChange={handleDriverSelect}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.full_name} — {d.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">ou inserir manualmente</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Nome *</Label>
                <Input className="mt-1" value={newForm.driver_name} onChange={e => setNewForm(p => ({ ...p, driver_name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Email *</Label>
                <Input className="mt-1" type="email" value={newForm.driver_email} onChange={e => setNewForm(p => ({ ...p, driver_email: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleCreate}
                  disabled={creating || !newForm.driver_name || !newForm.driver_email}
                >
                  {creating ? 'A criar...' : 'Iniciar onboarding'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}