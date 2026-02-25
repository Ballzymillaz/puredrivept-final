import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function PageHeader({ title, subtitle, actionLabel, onAction, actionIcon: ActionIcon = Plus, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {actionLabel && (
          <Button onClick={onAction} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <ActionIcon className="w-4 h-4" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}