import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Euro } from 'lucide-react';

export default function IVA() {
  const [driverFilter, setDriverFilter] = useState('all');
  const [detailsDialog, setDetailsDialog] = useState(null);

  const { data: revenues = [] } = useQuery({
    queryKey: ['weekly-revenues'],
    queryFn: async () => {
      const all = await base44.entities.WeeklyRevenues.list('-week_start_date', 200);
      return all.filter(r => r.status === 'paid');
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const filtered = driverFilter === 'all' 
    ? revenues 
    : revenues.filter(r => r.driver_id === driverFilter);

  // 6% IVA obrigatorio (receita bruta)
  const total6IVA = filtered.reduce((s, r) => s + (r.iva_6_percent || 0), 0);

  // Total 4% UPI (que é uma forma de IVA/contribuição)
  const totalUPI = filtered.reduce((s, r) => s + (r.upi_4_percent || 0), 0);

  const totalIVA = total6IVA + totalUPI;

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <PageHeader title="IVA e Contribuições" subtitle="Gestão de IVA e UPI" />
      
      <div className="flex gap-3">
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por motorista..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motoristas</SelectItem>
            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="cursor-pointer" onClick={() => setDetailsDialog('6iva')}>
            <StatCard title="6% IVA Receita" value={fmt(total6IVA)} subtitle="Obrigatório estado" icon={TrendingUp} color="blue" />
          </div>
        </div>
        <div>
          <div className="cursor-pointer" onClick={() => setDetailsDialog('upi')}>
            <StatCard title="4% Contribuição UPI" value={fmt(totalUPI)} subtitle="Geração UPI" icon={Euro} color="violet" />
          </div>
        </div>
        <div>
          <div className="cursor-pointer" onClick={() => setDetailsDialog('total')}>
            <StatCard title="Total Contribuições" value={fmt(totalIVA)} icon={Euro} color="indigo" />
          </div>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm font-semibold">Detalhe de Contribuições</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center py-4 text-gray-400 text-sm">Nenhuma receita processada</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filtered.map(r => {
                const iva6 = r.iva_6_percent || 0;
                const upi4 = r.upi_4_percent || 0;
                const totalContrib = iva6 + upi4;
                return (
                  <div key={r.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-sm">{r.driver_name}</p>
                      <p className="text-xs text-gray-500">{r.week_start_date} a {r.week_end_date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{fmt(totalContrib)}</p>
                      <p className="text-xs text-gray-500">6% IVA: {fmt(iva6)} | 4% UPI: {fmt(upi4)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === '6iva' && 'Detalhe: 6% IVA Receita'}
              {detailsDialog === 'upi' && 'Detalhe: 4% Contribuição UPI'}
              {detailsDialog === 'total' && 'Detalhe: Total Contribuições'}
            </DialogTitle>
          </DialogHeader>
          <IVADetailsContent type={detailsDialog} revenues={filtered} fmt={fmt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IVADetailsContent({ type, revenues, fmt }) {
  if (type === '6iva') {
    const total = revenues.reduce((s, r) => s + (r.iva_6_percent || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-semibold">Total 6% IVA: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {revenues.filter(r => r.iva_6_percent > 0).map(r => (
            <div key={r.id} className="flex justify-between items-center p-3 border-b">
              <div>
                <p className="font-medium">{r.driver_name}</p>
                <p className="text-sm text-gray-500">{r.week_start_date}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{fmt(r.iva_6_percent)}</p>
                <p className="text-sm text-gray-500">Receita: {fmt(r.total_revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'upi') {
    const total = revenues.reduce((s, r) => s + (r.upi_4_percent || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-violet-50 rounded-lg">
          <p className="text-sm font-semibold">Total UPI (4%): {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {revenues.filter(r => r.upi_4_percent > 0).map(r => (
            <div key={r.id} className="flex justify-between items-center p-3 border-b">
              <div>
                <p className="font-medium">{r.driver_name}</p>
                <p className="text-sm text-gray-500">{r.week_start_date}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{r.upi_4_percent.toFixed(0)} UPI</p>
                <p className="text-sm text-gray-500">Receita: {fmt(r.total_revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'total') {
    const iva6Total = revenues.reduce((s, r) => s + (r.iva_6_percent || 0), 0);
    const upiTotal = revenues.reduce((s, r) => s + (r.upi_4_percent || 0), 0);
    
    return (
      <div className="space-y-3">
        <div className="p-3 bg-indigo-50 rounded-lg">
          <p className="text-sm font-semibold">Total Contribuições: {fmt(iva6Total + upiTotal)}</p>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">6% IVA Receita: {fmt(iva6Total)}</p>
            <p className="text-xs text-gray-500 ml-2">Obrigatório a pagar ao estado</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">4% Contribuição UPI: {fmt(upiTotal)}</p>
            <p className="text-xs text-gray-500 ml-2">Gerado e acumulado nos drivers</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}