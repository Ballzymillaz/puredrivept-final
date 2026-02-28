import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useSimulation } from '@/components/shared/SimulationContext';

export default function SimulationBanner() {
  const { simulation, setSimulation } = useSimulation();
  if (!simulation) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-50 sticky top-16">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          ⚠️ Mode simulation actif — vue {simulation.role === 'driver' ? 'Motorista' : 'Fleet Manager'}
          {simulation.targetName ? ` (${simulation.targetName})` : ''} — aucune action réelle
        </span>
      </div>
      <button onClick={() => setSimulation(null)} className="ml-4 p-1 hover:bg-amber-600 rounded flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}