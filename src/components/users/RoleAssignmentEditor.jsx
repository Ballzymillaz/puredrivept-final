import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Edit2, Trash2 } from 'lucide-react';

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Administrador', color: 'bg-red-100 text-red-700' },
  { value: 'fleet_manager', label: 'Gestor de Frota', color: 'bg-blue-100 text-blue-700' },
  { value: 'driver', label: 'Motorista', color: 'bg-indigo-100 text-indigo-700' }
];

export default function RoleAssignmentEditor({ user, onSuccess }) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState(
    user?.role ? user.role.split(',').map(r => r.trim()) : []
  );
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (roles) => {
      const roleString = roles.join(',');
      return base44.entities.User.update(user.id, {
        role: roleString || 'user'
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowDialog(false);
      onSuccess?.();
    },
    onError: (error) => {
      alert('Erro ao atualizar roles: ' + error.message);
    }
  });

  const handleToggleRole = (roleValue) => {
    setSelectedRoles(prev =>
      prev.includes(roleValue)
        ? prev.filter(r => r !== roleValue)
        : [...prev, roleValue]
    );
  };

  const currentRoles = user?.role ? user.role.split(',').map(r => r.trim()) : [];

  const handleSave = () => {
    updateMutation.mutate(selectedRoles);
  };

  const handleRemoveRole = (roleToRemove) => {
    const newRoles = currentRoles.filter(r => r !== roleToRemove);
    updateMutation.mutate(newRoles);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {currentRoles.length > 0 ? (
          currentRoles.map(role => {
            const config = AVAILABLE_ROLES.find(r => r.value === role);
            return (
              <div key={role} className="flex items-center gap-1">
                <Badge className={config?.color || 'bg-gray-100 text-gray-700'}>
                  {config?.label || role}
                </Badge>
                <button
                  onClick={() => handleRemoveRole(role)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Remover role"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        ) : (
          <span className="text-xs text-gray-500">Sem roles</span>
        )}
        <button
          onClick={() => setShowDialog(true)}
          className="p-1 hover:bg-gray-100 rounded text-gray-600"
          title="Editar roles"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir/Remover Roles - {user?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Nota:</strong> Um utilizador pode ter múltiplos roles. Selecione os roles que deseja atribuir.
              </p>
            </div>

            <div className="space-y-2">
              {AVAILABLE_ROLES.map(role => (
                <label
                  key={role.value}
                  className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => handleToggleRole(role.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{role.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {role.value === 'admin' && 'Acesso completo ao sistema'}
                      {role.value === 'fleet_manager' && 'Gestão de frota e motoristas'}
                      {role.value === 'driver' && 'Acesso como motorista'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || JSON.stringify(selectedRoles.sort()) === JSON.stringify(currentRoles.sort())}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {updateMutation.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}