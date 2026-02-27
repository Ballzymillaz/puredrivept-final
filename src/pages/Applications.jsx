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

const TYPE_LABELS = { driver: 'Motorista', fleet_manager: 'Gestor de frota' };

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

        // Map applicant_type to platform role - NEVER use 'user' as fallback
        const roleMap = { driver: 'driver', fleet_manager: 'fleet_manager' };
        const role = roleMap[application.applicant_type];

        if (application.applicant_type === 'driver') {
          await base44.entities.Driver.create({ ...entityData, vehicle_deposit: 0, vehicle_deposit_paid: false, upi_balance: 0 });
        } else if (application.applicant_type === 'fleet_manager') {
          await base44.entities.FleetManager.create({ ...entityData, total_drivers: 0, total_earnings: 0 });
        }

        // Update User role for the applicant's email
        try {
          await base44.functions.invoke('updateApplicantRole', { 
            email: application.email, 
            role: role 
          });
        } catch (err) {
          console.error('Failed to update user role:', err);
        }

        // Send approval email and initiate driver onboarding if driver
        try {
          if (application.applicant_type === 'driver') {
            // Create driver onboarding record
            const driverRecord = await base44.entities.Driver.filter({ email: application.email });
            if (driverRecord.length > 0) {
              const driver = driverRecord[0];
              await base44.entities.DriverOnboarding.create({
                driver_id: driver.id,
                driver_name: driver.full_name,
                driver_email: driver.email,
                current_step: 'documents',
                status: 'in_progress',
                documents_status: 'pending',
                background_check_status: 'pending',
                vehicle_assignment_status: 'pending',
              });
            }
          }

          // Send approval email with next steps
          const emailBody = application.applicant_type === 'driver'
            ? `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9"><div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)"><div style="background:#4f46e5;border-radius:8px;padding:16px;text-align:center;margin-bottom:24px"><h1 style="color:white;margin:0;font-size:20px">PureDrive<sup style="font-size:11px">PT</sup></h1></div><p style="color:#374151;font-size:16px">Parabéns, <strong>${application.full_name}</strong>!</p><p style="color:#374151;font-size:15px;line-height:1.6">A sua candidatura foi <strong style="color:#10b981">APROVADA</strong> ✓</p><div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:24px 0"><p style="margin:0;color:#374151;font-size:14px"><strong>Próximos passos do seu onboarding:</strong></p><ol style="color:#6b7280;margin:8px 0 0 20px"><li>Submeter documentos obrigatórios (carta, CC, TVDE)</li><li>Aguardar verificação de antecedentes</li><li>Receber atribuição de veículo</li></ol></div><p style="color:#6b7280;font-size:14px">O seu processo de onboarding já iniciou. Aceda à plataforma PureDrivePT para prosseguir com os próximos passos.</p><div style="text-align:center;margin:24px 0"><a href="${window.location.origin}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Aceder à Plataforma</a></div><p style="color:#9ca3af;font-size:12px;margin-top:24px">Esta é uma mensagem automática — não responda a este email.</p></div></body></html>`
            : `Olá ${application.full_name},\n\nA sua candidatura foi aprovada! A nossa equipa entrará em contacto em breve para os próximos passos.\n\nAtenciosamente,\nEquipa PureDrive PT`;

          await base44.integrations.Core.SendEmail({
            to: application.email,
            subject: application.applicant_type === 'driver' ? '[PureDrivePT] Candidatura Aprovada - Inicie seu Onboarding' : 'Candidatura aprovada - PureDrive PT',
            body: emailBody,
          });
        } catch (err) {
          console.error('Error sending approval email or creating onboarding:', err);
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['drivers'] }); qc.invalidateQueries({ queryKey: ['fleetManagers'] }); qc.invalidateQueries({ queryKey: ['commercials'] }); setSelected(null); },
  });

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
      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelected} />

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Candidatura de {selected?.full_name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500 text-xs">Email</span><p>{selected.email}</p></div>
                <div><span className="text-gray-500 text-xs">Telefone</span><p>{selected.phone}</p></div>
                <div><span className="text-gray-500 text-xs">Tipo</span><p>{TYPE_LABELS[selected.applicant_type]}</p></div>
                <div><span className="text-gray-500 text-xs">NIF</span><p>{selected.nif || '—'}</p></div>
              </div>
              {selected.message && <div className="bg-gray-50 p-3 rounded-lg text-sm">{selected.message}</div>}
              {selected.status === 'new' || selected.status === 'reviewing' ? (
                <div className="flex gap-3 pt-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'approved' }, application: selected })}>
                    {updateMutation.isPending ? 'A processar...' : 'Aprovar'}
                  </Button>
                  <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'rejected' }, application: selected })}>Rejeitar</Button>
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