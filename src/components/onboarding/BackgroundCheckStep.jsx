import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Shield, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function BackgroundCheckStep({ onboarding, isAdmin, onUpdate }) {
  const [notes, setNotes] = useState(onboarding.background_check_notes || '');
  const [saving, setSaving] = useState(false);

  const bgStatus = onboarding.background_check_status || 'pending';

  const handleApprove = async () => {
    setSaving(true);
    await base44.entities.DriverOnboarding.update(onboarding.id, {
      background_check_status: 'approved',
      background_check_notes: notes,
      background_check_date: new Date().toISOString().split('T')[0],
      current_step: 'vehicle_assignment',
    });
    await base44.functions.invoke('onboardingNotify', {
      onboardingId: onboarding.id,
      step: 'background_approved',
      driverName: onboarding.driver_name,
      driverEmail: onboarding.driver_email,
      notes,
    });
    setSaving(false);
    onUpdate();
  };

  const handleReject = async () => {
    if (!notes.trim()) { alert('Por favor, adicione uma nota com o motivo.'); return; }
    setSaving(true);
    await base44.entities.DriverOnboarding.update(onboarding.id, {
      background_check_status: 'rejected',
      background_check_notes: notes,
      background_check_date: new Date().toISOString().split('T')[0],
      status: 'blocked',
    });
    await base44.functions.invoke('onboardingNotify', {
      onboardingId: onboarding.id,
      step: 'background_rejected',
      driverName: onboarding.driver_name,
      driverEmail: onboarding.driver_email,
      notes,
    });
    setSaving(false);
    onUpdate();
  };

  const handleStartCheck = async () => {
    setSaving(true);
    await base44.entities.DriverOnboarding.update(onboarding.id, { background_check_status: 'in_progress' });
    setSaving(false);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Verificação de Antecedentes</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          bgStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
          bgStatus === 'rejected' ? 'bg-red-100 text-red-700' :
          bgStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {bgStatus === 'approved' ? 'Aprovado' : bgStatus === 'rejected' ? 'Reprovado' : bgStatus === 'in_progress' ? 'Em curso' : 'Pendente'}
        </span>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Verificação de registo criminal</p>
            <p className="text-xs text-blue-600 mt-1">
              Esta etapa inclui verificação do registo criminal, historial de condução e validação de identidade.
            </p>
            {onboarding.background_check_date && (
              <p className="text-xs text-blue-500 mt-1">Data: {format(new Date(onboarding.background_check_date), 'dd/MM/yyyy')}</p>
            )}
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          {bgStatus === 'pending' && 'A sua verificação de antecedentes ainda não foi iniciada. A equipa irá contactá-lo em breve.'}
          {bgStatus === 'in_progress' && 'A sua verificação de antecedentes está em curso. Irá ser notificado quando concluída.'}
          {bgStatus === 'approved' && '✅ A sua verificação foi aprovada com sucesso!'}
          {bgStatus === 'rejected' && `❌ A sua verificação não foi aprovada. ${onboarding.background_check_notes || ''}`}
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500">Notas internas</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Adicionar notas sobre a verificação..."
              className="mt-1 h-24 text-sm"
              disabled={bgStatus === 'approved' || bgStatus === 'rejected'}
            />
          </div>

          {bgStatus === 'pending' && (
            <Button onClick={handleStartCheck} disabled={saving} variant="outline" className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Iniciar verificação
            </Button>
          )}

          {(bgStatus === 'pending' || bgStatus === 'in_progress') && (
            <div className="flex gap-2">
              <Button onClick={handleApprove} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                ✅ Aprovar
              </Button>
              <Button onClick={handleReject} disabled={saving} variant="destructive" className="flex-1">
                ❌ Reprovar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}