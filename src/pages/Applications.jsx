import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const TYPE_LABELS = { driver: 'Motorista', fleet_manager: 'Gestor de frota', commercial: 'Comercial' };

export default function Applications({ currentUser }) {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalRole, setApprovalRole] = useState('');
  const [fleetManagerId, setFleetManagerId] = useState('');
  const qc = useQueryClient();

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-medium">Acesso restrito</p>
        <p className="text-sm">Esta página é apenas para administradores.</p>
      </div>
    );
  }

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list('-created_date'),
  });

  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleet-managers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, application, role, fmId }) => {
      await base44.entities.Application.update(id, data);

      if (data.status === 'approved' && application) {
        const entityData = {
          full_name: application.full_name,
          email: application.email,
          phone: application.phone,
          nif: application.nif || '',
          status: 'active',
          referred_by: application.referral_code || '',
        };

        let linkedEntityId = null;
        const finalRole = role || application.applicant_type;

        if (finalRole === 'driver') {
          // Check if a driver record already exists for this email
          let driverRecord = drivers.find(d => d.email === application.email);
          if (!driverRecord) {
            // Find affiliated fleet manager
            let fmRecord = null;
            if (fmId) fmRecord = fleetManagers.find(fm => fm.id === fmId);
            const driverPayload = {
              ...entityData,
              vehicle_deposit: 500,
              vehicle_deposit_paid: false,
              upi_balance: 0,
              ...(fmRecord && { fleet_manager_id: fmRecord.id, fleet_manager_name: fmRecord.full_name }),
            };
            driverRecord = await base44.entities.Driver.create(driverPayload);
          }
          linkedEntityId = driverRecord.id;
        } else if (finalRole === 'fleet_manager') {
          let fmRecord = fleetManagers.find(fm => fm.email === application.email);
          if (!fmRecord) {
            fmRecord = await base44.entities.FleetManager.create({
              ...entityData,
              total_drivers: 0,
              total_earnings: 0,
              referral_code: `FM-${Date.now().toString(36).toUpperCase()}`,
            });
          }
          linkedEntityId = fmRecord.id;
        }

        // Find existing user and update role + linked_entity_id (remove 'user' role)
        try {
          const users = await base44.entities.User.list();
          const matchedUser = users.find(u => u.email === application.email);
          if (matchedUser) {
            await base44.entities.User.update(matchedUser.id, {
              role: finalRole,
              ...(linkedEntityId && { linked_entity_id: linkedEntityId }),
            });
          }
        } catch (_) {}

        // Send approval email
        try {
          await base44.integrations.Core.SendEmail({
            to: application.email,
            subject: 'Candidatura aprovada - PureDrive PT',
            body: `Olá ${application.full_name},\n\nA sua candidatura foi aprovada! Pode agora aceder à plataforma com o seu email e palavra-passe.\n\nAtenciosamente,\nEquipa PureDrive PT`,
          });
        } catch (_) {}
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
      qc.invalidateQueries({ queryKey: ['fleet-managers'] });
      setSelected(null);
      setApprovalRole('');
      setFleetManagerId('');
    },
  });

  const handleApprove = () => {
    updateMutation.mutate({
      id: selected.id,
      data: { status: 'approved' },
      application: selected,
      role: approvalRole || selected.applicant_type,
      fmId: fleetManagerId,
    });
  };

  const handleReject = () => {
    updateMutation.mutate({ id: selected.id, data: { status: 'rejected' }, application: selected });
  };

  const filtered = statusFilter === 'all' ? applications : applications.filter(a => a.status === statusFilter);

  const columns = [
    { header: 'Candidato', render: (r) => (<div><p className="text-sm font-medium">{r.full_name}</p><p className="text-xs text-gray-500">{r.email}</p></div>) },
    { header: 'Tipo', render: (r) => <span className="text-sm">{TYPE_LABELS[r.applicant_type] || r.applicant_type}</span> },
    { header: 'Telefone', accessor: 'phone' },
    { header: 'Referência', render: (r) => r.referral_code ? <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{r.referral_code}</span> : '—' },
    { header: 'Data', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_date), 'dd/MM/yyyy')}</span> },
    { header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Candidaturas" subtitle={`${applications.length} candidaturas`}>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="new">Novas</SelectItem>
            <SelectItem value="reviewing">Em análise</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={(r) => { setSelected(r); setApprovalRole(r.applicant_type); setFleetManagerId(''); }} />

      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setApprovalRole(''); setFleetManagerId(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Candidatura de {selected?.full_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500 text-xs">Email</span><p>{selected.email}</p></div>
                <div><span className="text-gray-500 text-xs">Telefone</span><p>{selected.phone}</p></div>
                <div><span className="text-gray-500 text-xs">Tipo solicitado</span><p>{TYPE_LABELS[selected.applicant_type]}</p></div>
                <div><span className="text-gray-500 text-xs">NIF</span><p>{selected.nif || '—'}</p></div>
              </div>
              {selected.message && <div className="bg-gray-50 p-3 rounded-lg text-sm">{selected.message}</div>}

              {(selected.status === 'new' || selected.status === 'reviewing') ? (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Papel a atribuir *</Label>
                    <Select value={approvalRole} onValueChange={setApprovalRole}>
                      <SelectTrigger><SelectValue placeholder="Escolher papel..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="driver">Motorista</SelectItem>
                        <SelectItem value="fleet_manager">Gestor de frota</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {approvalRole === 'driver' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Afiliar a gestor de frota (opcional)</Label>
                      <Select value={fleetManagerId} onValueChange={setFleetManagerId}>
                        <SelectTrigger><SelectValue placeholder="Nenhum gestor..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Nenhum</SelectItem>
                          {fleetManagers.map(fm => (
                            <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={updateMutation.isPending || !approvalRole}
                      onClick={handleApprove}
                    >
                      {updateMutation.isPending ? 'A processar...' : 'Aprovar'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={updateMutation.isPending}
                      onClick={handleReject}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ) : (
                <StatusBadge status={selected.status} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}