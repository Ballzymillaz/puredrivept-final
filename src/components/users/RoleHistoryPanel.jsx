import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { History } from 'lucide-react';

const ROLE_PERMISSIONS = {
  admin: [
    'Acesso total ao sistema',
    'Gestão de utilizadores',
    'Gestão de motoristas e veículos',
    'Pagamentos e finanças',
    'Relatórios avançados',
    'Configurações do sistema'
  ],
  fleet_manager: [
    'Gestão de motoristas (própria frota)',
    'Gestão de veículos (própria frota)',
    'Visualizar pagamentos',
    'Relatórios da frota',
    'Mensagens',
  ],
  driver: [
    'Visualizar perfil',
    'Gestão de documentos',
    'Visualizar pagamentos',
    'Solicitar empréstimos/reembolsos',
    'Enviar mensagens'
  ]
};

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  fleet_manager: 'bg-blue-100 text-blue-700',
  driver: 'bg-indigo-100 text-indigo-700'
};

export default function RoleHistoryPanel({ user }) {
  const userRoles = user?.role ? user.role.split(',').map(r => r.trim()) : [];

  return (
    <div className="space-y-4">
      {/* Current Roles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>Roles Atuais</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {userRoles.length > 0 ? (
              userRoles.map(role => (
                <Badge key={role} className={`${ROLE_COLORS[role] || 'bg-gray-100 text-gray-700'}`}>
                  {role === 'fleet_manager' ? 'Gestor de Frota' : role === 'driver' ? 'Motorista' : 'Administrador'}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-gray-500">Nenhum role atribuído</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permissions by Role */}
      {userRoles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Permissões Associadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {userRoles.map(role => (
              <div key={role} className="border-l-2 border-indigo-300 pl-3">
                <p className="text-xs font-semibold text-gray-700 mb-1 capitalize">
                  {role === 'fleet_manager' ? 'Gestor de Frota' : role === 'driver' ? 'Motorista' : 'Administrador'}
                </p>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  {ROLE_PERMISSIONS[role]?.map((perm, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-indigo-500 mt-0.5">•</span>
                      <span>{perm}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Member Since */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          <p className="text-gray-600">
            <strong>Membro desde:</strong> {user?.created_date ? format(new Date(user.created_date), 'dd/MM/yyyy HH:mm') : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}