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

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-all'],
    queryFn: async () => {
      const allPayments = await base44.entities.WeeklyPayment.list('-week_start', 200);
      return allPayments.filter(p => p.status === 'paid');
    },
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const filteredPayments = driverFilter === 'all' 
    ? payments 
    : driverFilter === 'none'
    ? payments.filter(p => !p.driver_id)
    : payments.filter(p => p.driver_id === driverFilter);

  // 6% IVA obrigatorio estado (Receita Bruta Frota)
  const total6IVA = filteredPayments.reduce((s, p) => s + (p.iva_amount || 0), 0);

  // 23% IVA recuperável (Via Verde + MyPrio + Miio)
  const total23IVA = filteredPayments.reduce((s, p) => {
    const viaVerde = (p.via_verde_amount || 0) * 0.23;
    const myPrio = (p.myprio_amount || 0) * 0.23;
    const miio = (p.miio_amount || 0) * 0.23;
    return s + viaVerde + myPrio + miio;
  }, 0);

  const totalIVA = total6IVA + total23IVA;

  const fmt = (v) => `€${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <PageHeader title="IVA" subtitle="Gestão de IVA" />
      
      <div className="flex gap-3">
        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por motorista..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motoristas</SelectItem>
            <SelectItem value="none">Sem motorista</SelectItem>
            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="cursor-pointer" onClick={() => setDetailsDialog('6iva')}>
            <StatCard title="6% IVA Estado" value={fmt(total6IVA)} subtitle="Receita Bruta Frota" icon={TrendingUp} color="blue" />
          </div>
          <div className="mt-2 text-center text-xs text-gray-600 font-medium">
            Totalité des IVA collectés: {fmt(total6IVA)}
          </div>
        </div>
        <div>
          <div className="cursor-pointer" onClick={() => setDetailsDialog('23iva')}>
            <StatCard title="23% IVA (IVA recuperável)" value={fmt(total23IVA)} subtitle="Receitas Empresa" icon={Euro} color="green" />
          </div>
          <div className="mt-2 text-center text-xs text-gray-600 font-medium">
            Totalité des IVA collectés: {fmt(total23IVA)}
          </div>
        </div>
        <div>
          <div className="cursor-pointer" onClick={() => setDetailsDialog('total')}>
            <StatCard title="IVA Total" value={fmt(totalIVA)} icon={Euro} color="indigo" />
          </div>
          <div className="mt-2 text-center text-xs text-gray-600 font-medium">
            Totalité des IVA collectés: {fmt(totalIVA)}
          </div>
        </div>
      </div>

      <Card className="mt-6">
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3">Détails des IVA collectés</h3>
          <div className="space-y-2">
            {filteredPayments.length === 0 ? (
              <p className="text-center py-4 text-gray-400 text-sm">Aucun IVA collecté</p>
            ) : (
              filteredPayments.map(p => {
                const iva6 = p.iva_amount || 0;
                const iva23 = ((p.via_verde_amount || 0) + (p.myprio_amount || 0) + (p.miio_amount || 0)) * 0.23;
                const totalIVA = iva6 + iva23;
                if (totalIVA === 0) return null;
                return (
                  <div key={p.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-sm">{p.driver_name}</p>
                      <p className="text-xs text-gray-500">{p.period_label}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{fmt(totalIVA)}</p>
                      <p className="text-xs text-gray-500">6%: {fmt(iva6)} | 23%: {fmt(iva23)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <Dialog open={!!detailsDialog} onOpenChange={(open) => !open && setDetailsDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailsDialog === '6iva' && 'Detalhes: 6% IVA Estado'}
              {detailsDialog === '23iva' && 'Detalhes: 23% IVA Recuperável'}
              {detailsDialog === 'total' && 'Detalhes: IVA Total'}
            </DialogTitle>
          </DialogHeader>
          <IVADetailsContent type={detailsDialog} payments={filteredPayments} fmt={fmt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IVADetailsContent({ type, payments, fmt }) {
  if (type === '6iva') {
    const total = payments.reduce((s, p) => s + (p.iva_amount || 0), 0);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {payments.filter(p => p.iva_amount > 0).map(p => (
            <div key={p.id} className="flex justify-between items-center p-3 border-b">
              <div>
                <p className="font-medium">{p.driver_name}</p>
                <p className="text-sm text-gray-500">{p.period_label}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{fmt(p.iva_amount)}</p>
                <p className="text-sm text-gray-500">Bruto: {fmt(p.total_gross)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === '23iva') {
    const details = payments.map(p => ({
      ...p,
      viaVerdeIVA: (p.via_verde_amount || 0) * 0.23,
      myPrioIVA: (p.myprio_amount || 0) * 0.23,
      miioIVA: (p.miio_amount || 0) * 0.23,
      totalIVA: ((p.via_verde_amount || 0) + (p.myprio_amount || 0) + (p.miio_amount || 0)) * 0.23,
    })).filter(p => p.totalIVA > 0);
    
    const total = details.reduce((s, p) => s + p.totalIVA, 0);
    
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm font-semibold">Total: {fmt(total)}</p>
        </div>
        <div className="space-y-2">
          {details.map(p => (
            <div key={p.id} className="p-3 border-b">
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium">{p.driver_name}</p>
                <p className="font-bold text-green-600">{fmt(p.totalIVA)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                {p.viaVerdeIVA > 0 && <p>Via Verde: {fmt(p.viaVerdeIVA)}</p>}
                {p.myPrioIVA > 0 && <p>MyPRIO: {fmt(p.myPrioIVA)}</p>}
                {p.miioIVA > 0 && <p>Miio: {fmt(p.miioIVA)}</p>}
              </div>
              <p className="text-xs text-gray-500 mt-1">{p.period_label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'total') {
    const total6 = payments.reduce((s, p) => s + (p.iva_amount || 0), 0);
    const total23 = payments.reduce((s, p) => {
      return s + ((p.via_verde_amount || 0) + (p.myprio_amount || 0) + (p.miio_amount || 0)) * 0.23;
    }, 0);
    
    return (
      <div className="space-y-3">
        <div className="p-3 bg-indigo-50 rounded-lg">
          <p className="text-sm font-semibold">Total IVA: {fmt(total6 + total23)}</p>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">6% IVA Estado: {fmt(total6)}</p>
            <p className="text-xs text-gray-500 ml-2">Receita Bruta Frota - IVA obrigatório</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">23% IVA Recuperável: {fmt(total23)}</p>
            <p className="text-xs text-gray-500 ml-2">Receitas Empresa (Via Verde, MyPRIO, Miio)</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}