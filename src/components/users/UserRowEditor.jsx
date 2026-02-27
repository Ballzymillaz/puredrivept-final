import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Check, X, Edit2 } from 'lucide-react';

const ALL_ROLES = [
  { value: 'admin', label: 'Admin', color: 'bg-red-100 text-red-700' },
  { value: 'fleet_manager', label: 'Gestor frota', color: 'bg-blue-100 text-blue-700' },
  { value: 'commercial', label: 'Comercial', color: 'bg-green-100 text-green-700' },
  { value: 'driver', label: 'Motorista', color: 'bg-indigo-100 text-indigo-700' },
];

export default function UserRowEditor({ user }) {
  const [editing, setEditing] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState(user.role ? user.role.split(',').map(r => r.trim()) : []);
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditing(false);
    },
  });

  const toggleRole = (role) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSave = () => {
    updateMutation.mutate({ id: user.id, role: selectedRoles.join(',') });
  };

  const handleCancel = () => {
    setSelectedRoles(user.role ? user.role.split(',').map(r => r.trim()) : []);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {ALL_ROLES.map(role => (
          <button
            key={role.value}
            onClick={() => toggleRole(role.value)}
            className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              selectedRoles.includes(role.value)
                ? role.color
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {role.label}
          </button>
        ))}
        <div className="flex gap-1 ml-2">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="p-1.5 hover:bg-green-100 rounded text-green-600"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={updateMutation.isPending}
            className="p-1.5 hover:bg-red-100 rounded text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const roles = user.role ? user.role.split(',').map(r => r.trim()).filter(Boolean) : [];
  
  return (
    <div className="flex items-center gap-2 group">
      <div className="flex flex-wrap gap-1">
        {roles.length === 0 ? (
          <Badge className="text-xs bg-gray-100 text-gray-500 border-0">Sem role</Badge>
        ) : (
          roles.map(r => {
            const cfg = ALL_ROLES.find(ar => ar.value === r);
            return <Badge key={r} className={`text-xs border-0 ${cfg?.color || 'bg-gray-100 text-gray-500'}`}>{cfg?.label || r}</Badge>;
          })
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 rounded"
      >
        <Edit2 className="w-3.5 h-3.5 text-gray-600" />
      </button>
    </div>
  );
}