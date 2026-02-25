import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  inactive: 'bg-gray-50 text-gray-600 border-gray-200',
  evaluation: 'bg-blue-50 text-blue-700 border-blue-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-orange-50 text-orange-700 border-orange-200',
  requested: 'bg-violet-50 text-violet-700 border-violet-200',
  new: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-gray-50 text-gray-600 border-gray-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  disputed: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-50 text-gray-600 border-gray-200',
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  maintenance: 'bg-orange-50 text-orange-700 border-orange-200',
  achieved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS = {
  active: 'Actif',
  pending: 'En attente',
  inactive: 'Inactif',
  evaluation: 'Évaluation',
  suspended: 'Suspendu',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  expired: 'Expiré',
  requested: 'Demandé',
  new: 'Nouveau',
  reviewing: 'En cours',
  draft: 'Brouillon',
  processing: 'En traitement',
  paid: 'Payé',
  disputed: 'Contesté',
  completed: 'Terminé',
  cancelled: 'Annulé',
  available: 'Disponible',
  assigned: 'Attribué',
  maintenance: 'Maintenance',
  achieved: 'Atteint',
  failed: 'Échoué',
};

export default function StatusBadge({ status, className }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] font-medium border px-2 py-0.5",
        STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 border-gray-200',
        className
      )}
    >
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}