import React from 'react';
import { Clock, Zap } from 'lucide-react';
import { differenceInDays } from 'date-fns';

const ESTIMATED_DAYS_PER_STEP = {
  documents: 2,
  background_check: 5,
  vehicle_assignment: 3,
  completed: 0,
};

export default function OnboardingProgressTracker({ onboarding, createdDate }) {
  const steps = ['documents', 'background_check', 'vehicle_assignment', 'completed'];
  const currentIndex = steps.indexOf(onboarding.current_step);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  // Calculate elapsed and estimated days
  const elapsedDays = createdDate ? differenceInDays(new Date(), new Date(createdDate)) : 0;
  const estimatedTotalDays = Object.values(ESTIMATED_DAYS_PER_STEP).reduce((a, b) => a + b, 0);
  const estimatedDaysRemaining = Math.max(0, estimatedTotalDays - elapsedDays);

  const STEP_LABELS = {
    documents: 'Documentos',
    background_check: 'Antecedentes',
    vehicle_assignment: 'Veículo',
    completed: 'Concluído',
  };

  const STEP_DESCRIPTIONS = {
    documents: 'Envio e validação de documentos',
    background_check: 'Verificação de antecedentes',
    vehicle_assignment: 'Atribuição de veículo',
    completed: 'Onboarding finalizado',
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Progresso Geral</span>
          <span className="text-sm font-bold text-indigo-600">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-sm">
          <div
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps Timeline */}
      <div className="grid grid-cols-4 gap-3">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIndex || (idx === currentIndex && onboarding.status === 'completed');
          const isCurrent = idx === currentIndex;

          return (
            <div key={step} className="text-center">
              <div
                className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center font-bold text-sm transition-all mb-2 ${
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                    : isCurrent
                    ? 'bg-indigo-600 text-white shadow-md scale-110'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {idx + 1}
              </div>
              <p className="text-xs font-semibold text-gray-900">{STEP_LABELS[step]}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{STEP_DESCRIPTIONS[step]}</p>
            </div>
          );
        })}
      </div>

      {/* Time Estimate */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <div>
            <p className="text-xs text-blue-700 font-semibold">Tempo Decorrido</p>
            <p className="text-sm font-bold text-blue-900">{elapsedDays} dias</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600" />
          <div>
            <p className="text-xs text-amber-700 font-semibold">Tempo Estimado Restante</p>
            <p className="text-sm font-bold text-amber-900">{estimatedDaysRemaining} dias</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {onboarding.status === 'blocked' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700 font-semibold">⚠️ Onboarding Bloqueado</p>
          {onboarding.admin_notes && <p className="text-xs text-red-600 mt-1">{onboarding.admin_notes}</p>}
        </div>
      )}

      {onboarding.status === 'completed' && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-xs text-emerald-700 font-semibold">✓ Onboarding Concluído</p>
          <p className="text-xs text-emerald-600 mt-1">Veículo: {onboarding.assigned_vehicle_info}</p>
        </div>
      )}
    </div>
  );
}