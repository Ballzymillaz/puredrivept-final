import React from 'react';
import { Check, FileText, Shield, Car, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'documents', label: 'Documentos', icon: FileText },
  { key: 'background_check', label: 'Antecedentes', icon: Shield },
  { key: 'vehicle_assignment', label: 'Veículo', icon: Car },
  { key: 'completed', label: 'Concluído', icon: Trophy },
];

const ORDER = ['documents', 'background_check', 'vehicle_assignment', 'completed'];

export default function OnboardingSteps({ currentStep, status }) {
  const currentIdx = ORDER.indexOf(currentStep);

  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = idx < currentIdx || currentStep === 'completed';
        const active = idx === currentIdx;
        const isLast = idx === STEPS.length - 1;

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                done ? 'bg-emerald-500 border-emerald-500 text-white' :
                active && status === 'blocked' ? 'bg-red-100 border-red-400 text-red-600' :
                active ? 'bg-indigo-600 border-indigo-600 text-white' :
                'bg-white border-gray-200 text-gray-400'
              )}>
                {done ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={cn(
                'text-xs mt-1.5 font-medium text-center',
                active ? 'text-indigo-700' : done ? 'text-emerald-600' : 'text-gray-400'
              )}>{step.label}</span>
            </div>
            {!isLast && (
              <div className={cn('flex-1 h-0.5 mb-5 mx-1', done ? 'bg-emerald-400' : 'bg-gray-200')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}