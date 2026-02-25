import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import StatCard from '../components/dashboard/StatCard';
import StatusBadge from '../components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Car, CreditCard, TrendingUp, Coins, AlertTriangle, UserPlus, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

export default function Dashboard({ currentUser }) {
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

  const activeDrivers = drivers.filter(d => d.status === 'active').length;
  const assignedVehicles = vehicles.filter(v => v.status === 'assigned').length;

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
        <StatCard title="Chauffeurs actifs" value={activeDrivers} subtitle={`${drivers.length} total`} icon={Users} color="indigo" />
        <StatCard title="Véhicules attribués" value={assignedVehicles} subtitle={`${vehicles.length} total`} icon={Car} color="blue" />
        <StatCard title="Revenu brut" value={`€${totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`} subtitle="Périodes récentes" icon={TrendingUp} color="green" />
        <StatCard title="Candidatures" value={applications.length} subtitle="En attente" icon={UserPlus} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contract distribution */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Répartition des contrats</CardTitle>
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
                  <Tooltip formatter={(v) => `${v} chauffeurs`} />
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
              Documents à échéance proche ({expiringDocs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringDocs.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Aucun document proche de l'échéance</div>
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
                        {days === 0 ? "Aujourd'hui" : `${days}j`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}