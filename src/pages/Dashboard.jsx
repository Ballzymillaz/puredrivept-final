import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatCard from '../components/dashboard/StatCard';
import StatusBadge from '../components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Car, CreditCard, TrendingUp, Coins, AlertTriangle, UserPlus, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

export default function Dashboard({ currentUser }) {
  const [detailsDialog, setDetailsDialog] = useState(null);
  
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['payments-recent'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start', 50),
  });
  const { data: documents = [] } = useQuery({
    queryKey: ['docs-expiring'],
    queryFn: () => base44.entities.Document.list('-expiry_date', 100),
  });
  const { data: applications = [] } = useQuery({
    queryKey: ['apps-new'],
    queryFn: () => base44.entities.Application.filter({ status: 'new' }),
  });

  const activeDriversList = drivers.filter(d => d.status === 'active');
  const activeDrivers = activeDriversList.length;
  const assignedVehiclesList = vehicles.filter(v => v.status === 'assigned');
  const assignedVehicles = assignedVehiclesList.length;

  const totalRevenue = payments.reduce((s, p) => s + (p.total_gross || 0), 0);
  const totalNet = payments.reduce((s, p) => s + (p.net_amount || 0), 0);

  const today = new Date();
  const expiringDocs = documents.filter(d => {
    if (!d.expiry_date || d.status === 'expired') return false;
    const diff = differenceInDays(new Date(d.expiry_date), today);
    return diff >= 0 && diff <= 15;
  });

  // Revenue by contract type
  const contractData = ['slot_standard', 'slot_premium', 'slot_black', 'location'].map(type => {
    const driversOfType = drivers.filter(d => d.contract_type === type);
    return {
      name: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: driversOfType.length,
    };
  }).filter(d => d.count > 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="cursor-pointer" onClick={() => setDetailsDialog('drivers')}>
          <StatCard title="Motoristas ativos" value={activeDrivers} subtitle={`${drivers.length} total`} icon={Users} color="indigo" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('vehicles')}>
          <StatCard title="Veículos atribuídos" value={assignedVehicles} subtitle={`${vehicles.length} total`} icon={Car} color="blue" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('revenue')}>
          <StatCard title="Receita bruta" value={`€${totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`} subtitle="Períodos recentes" icon={TrendingUp} color="green" />
        </div>
        <div className="cursor-pointer" onClick={() => setDetailsDialog('applications')}>
          <StatCard title="Candidaturas" value={applications.length} subtitle="Em espera" icon={UserPlus} color="amber" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contract distribution */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Repartição dos contratos</CardTitle>
          </CardHeader>
          <CardContent>
            {contractData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={contractData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count" paddingAngle={3}>
                    {contractData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v} motoristas`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">Aucune donnée</div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {contractData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Expiring documents */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Documentos a vencer em breve ({expiringDocs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringDocs.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Nenhum documento próximo do vencimento</div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {expiringDocs.slice(0, 10).map(doc => {
                  const days = differenceInDays(new Date(doc.expiry_date), today);
                  const urgency = days <= 3 ? 'text-red-600 bg-red-50' : days <= 7 ? 'text-orange-600 bg-orange-50' : 'text-amber-600 bg-amber-50';
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{doc.owner_name}</p>
                          <p className="text-xs text-gray-500">{doc.document_type?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${urgency}`}>
                        {days === 0 ? 'Hoje' : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === 'drivers' && 'Motoristas ativos'}
              {detailsDialog === 'vehicles' && 'Veículos atribuídos'}
              {detailsDialog === 'revenue' && 'Receita bruta'}
              {detailsDialog === 'applications' && 'Candidaturas'}
            </DialogTitle>
          </DialogHeader>
          <DashboardDetailsContent 
            type={detailsDialog} 
            drivers={activeDriversList}
            vehicles={assignedVehiclesList}
            payments={payments}
            applications={applications}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DashboardDetailsContent({ type, drivers, vehicles, payments, applications }) {
  if (type === 'drivers') {
    return (
      <div className="space-y-2">
        {drivers.length === 0 ? (
          <p className="text-center py-4 text-gray-400">Nenhum motorista ativo</p>
        ) : (
          drivers.map(d => (
            <div key={d.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium">{d.full_name}</p>
                <p className="text-sm text-gray-500">{d.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{d.phone}</p>
                <p className="text-xs text-gray-500">{d.contract_type?.replace('_', ' ')}</p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (type === 'vehicles') {
    return (
      <div className="space-y-2">
        {vehicles.length === 0 ? (
          <p className="text-center py-4 text-gray-400">Nenhum veículo atribuído</p>
        ) : (
          vehicles.map(v => (
            <div key={v.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium">{v.brand} {v.model}</p>
                <p className="text-sm text-gray-500">{v.license_plate}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{v.assigned_driver_name || 'N/A'}</p>
                <p className="text-xs text-gray-500">{v.year || ''}</p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (type === 'revenue') {
    const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
    const total = payments.reduce((s, p) => s + (p.total_gross || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="flex justify-between p-2 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium text-sm">{p.driver_name}</p>
                <p className="text-xs text-gray-500">{p.period_label}</p>
              </div>
              <p className="font-medium">{fmt(p.total_gross)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'applications') {
    return (
      <div className="space-y-2">
        {applications.length === 0 ? (
          <p className="text-center py-4 text-gray-400">Nenhuma candidatura pendente</p>
        ) : (
          applications.map(a => (
            <div key={a.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
              <div>
                <p className="font-medium">{a.full_name}</p>
                <p className="text-sm text-gray-500">{a.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{a.phone}</p>
                <p className="text-xs text-gray-500 capitalize">{a.applicant_type?.replace('_', ' ')}</p>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return null;
}