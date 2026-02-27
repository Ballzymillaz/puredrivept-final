import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Search } from 'lucide-react';
import { format } from 'date-fns';
import PaymentDetailCard from '../components/payments/PaymentDetailCard';

export default function PaymentHistory({ currentUser }) {
  const isDriver = currentUser?.role?.includes('driver');
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Fetch driver record
  const { data: driver } = useQuery({
    queryKey: ['driver-profile-payments'],
    queryFn: async () => {
      const drivers = await base44.entities.Driver.list();
      return drivers.find(d => d.email === currentUser?.email);
    },
    enabled: !!currentUser?.email && isDriver,
  });

  // Fetch payment history
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payment-history', driver?.id],
    queryFn: async () => {
      if (!driver?.id) return [];
      const history = await base44.entities.WeeklyPayment.filter({ driver_id: driver.id }) || [];
      return history.sort((a, b) => new Date(b.week_end) - new Date(a.week_end));
    },
    enabled: !!driver?.id,
  });

  if (!isDriver) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso apenas para motoristas</p>
      </div>
    );
  }

  const filtered = payments.filter(p =>
    !search || p.period_label?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalEarned: payments.reduce((sum, p) => sum + (p.net_amount || 0), 0),
    totalDeductions: payments.reduce((sum, p) => sum + (p.total_deductions || 0), 0),
    avgPayment: payments.length > 0 ? payments.reduce((sum, p) => sum + (p.net_amount || 0), 0) / payments.length : 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de Pagamentos"
        subtitle="Acompanhe todos os seus pagamentos semanais"
      >
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-full text-emerald-700">
            <TrendingUp className="w-3 h-3" />€{stats.totalEarned.toFixed(2)} Total
          </span>
          <span className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-full text-red-700">
            <TrendingDown className="w-3 h-3" />€{Math.abs(stats.totalDeductions).toFixed(2)} Deduções
          </span>
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full text-blue-700">
            <DollarSign className="w-3 h-3" />€{stats.avgPayment.toFixed(2)} Média
          </span>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600">Total Ganho</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">€{stats.totalEarned.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">{payments.length} semanas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600">Deduções Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">€{Math.abs(stats.totalDeductions).toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Taxas, impostos, etc</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-600">Pagamento Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">€{stats.avgPayment.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Por semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Pesquisar por semana ou período..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Payment List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pagamentos Semanais</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">A carregar...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Nenhum pagamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(payment => (
                <div
                  key={payment.id}
                  onClick={() => setSelectedPayment(payment)}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">
                      {payment.period_label}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(payment.week_start), 'dd/MM/yyyy')} - {format(new Date(payment.week_end), 'dd/MM/yyyy')}
                    </p>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          €{(payment.net_amount || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">Líquido</p>
                      </div>
                      <Badge className={`text-xs ${
                        payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        payment.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {payment.status === 'paid' ? '✓ Pago' :
                         payment.status === 'approved' ? '✓ Aprovado' :
                         'Pendente'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Detail Dialog */}
      {selectedPayment && (
        <Dialog open={!!selectedPayment} onOpenChange={(o) => { if (!o) setSelectedPayment(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedPayment.period_label}</DialogTitle>
            </DialogHeader>
            <PaymentDetailCard payment={selectedPayment} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}