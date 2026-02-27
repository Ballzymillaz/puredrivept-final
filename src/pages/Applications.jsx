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
import { format } from 'date-fns';

const TYPE_LABELS = { driver: 'Chauffeur', fleet_manager: 'Gestionnaire', commercial: 'Commercial' };

export default function Applications() {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const qc = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, application }) => {
      await base44.entities.Application.update(id, data);

      // When approving, create the corresponding entity record
      if (data.status === 'approved' && application) {
        const entityData = {
          full_name: application.full_name,
          email: application.email,
          phone: application.phone,
          nif: application.nif || '',
          status: 'pending',
          referred_by: application.referral_code || '',
        };

        // Map applicant_type to platform role
        const roleMap = { driver: 'driver', fleet_manager: 'fleet_manager', commercial: 'commercial' };
        const role = roleMap[application.applicant_type] || 'user';

        if (application.applicant_type === 'driver') {
          await base44.entities.Driver.create({ ...entityData, vehicle_deposit: 0, vehicle_deposit_paid: false, upi_balance: 0 });
        } else if (application.applicant_type === 'fleet_manager') {
          await base44.entities.FleetManager.create({ ...entityData, total_drivers: 0, total_earnings: 0 });
        } else if (application.applicant_type === 'commercial') {
          await base44.entities.Commercial.create({ ...entityData, total_drivers: 0, total_earnings: 0 });
        }

        // Update User role if user account exists with this email
        try {
          const users = await base44.entities.User.list();
          const matchedUser = users.find(u => u.email === application.email);
          if (matchedUser) {
            await base44.entities.User.update(matchedUser.id, { role });
          }
        } catch (_) {}

        // Send approval email
        try {
          await base44.integrations.Core.SendEmail({
            to: application.email,
            subject: 'Candidatura aprovada - PureDrive PT',
            body: `Olá ${application.full_name},\n\nA sua candidatura foi aprovada! A nossa equipa entrará em contacto em breve para os próximos passos.\n\nAtenciosamente,\nEquipa PureDrive PT`,
          });
        } catch (_) {}
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['drivers'] }); qc.invalidateQueries({ queryKey: ['fleetManagers'] }); qc.invalidateQueries({ queryKey: ['commercials'] }); setSelected(null); },
  });

  const filtered = statusFilter === 'all' ? applications : applications.filter(a => a.status === statusFilter);

  const columns = [
    { header: 'Candidat', render: (r) => (<div><p className="text-sm font-medium">{r.full_name}</p><p className="text-xs text-gray-500">{r.email}</p></div>) },
    { header: 'Type', render: (r) => <span className="text-sm">{TYPE_LABELS[r.applicant_type] || r.applicant_type}</span> },
    { header: 'Téléphone', accessor: 'phone' },
    { header: 'Parrainage', render: (r) => r.referral_code ? <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{r.referral_code}</span> : '—' },
    { header: 'Date', render: (r) => <span className="text-xs text-gray-500">{format(new Date(r.created_date), 'dd/MM/yyyy')}</span> },
    { header: 'Statut', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Candidatures" subtitle={`${applications.length} candidatures`}>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="new">Nouvelles</SelectItem>
            <SelectItem value="reviewing">En cours</SelectItem>
            <SelectItem value="approved">Approuvées</SelectItem>
            <SelectItem value="rejected">Rejetées</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelected} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Candidature de {selected?.full_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500 text-xs">Email</span><p>{selected.email}</p></div>
                <div><span className="text-gray-500 text-xs">Téléphone</span><p>{selected.phone}</p></div>
                <div><span className="text-gray-500 text-xs">Type</span><p>{TYPE_LABELS[selected.applicant_type]}</p></div>
                <div><span className="text-gray-500 text-xs">NIF</span><p>{selected.nif || '—'}</p></div>
              </div>
              {selected.message && <div className="bg-gray-50 p-3 rounded-lg text-sm">{selected.message}</div>}
              {selected.status === 'new' || selected.status === 'reviewing' ? (
                <div className="flex gap-3 pt-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'approved' }, application: selected })}>
                    {updateMutation.isPending ? 'A processar...' : 'Approuver'}
                  </Button>
                  <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'rejected' }, application: selected })}>Rejeter</Button>
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