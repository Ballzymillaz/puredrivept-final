import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, TrendingDown, Zap, Shield, BarChart3, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import StatCard from '../components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';

const fmt = (v) => `€${(v || 0).toFixed(2)}`;

export default function DriverFinancialDashboard() {
  const [user, setUser] = useState(null);
  const [driver, setDriver] = useState(null);
  const [monthFilter, setMonthFilter] = useState(new Date());

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
    enabled: !!user,
  });

  useEffect(() => {
    if (user && drivers.length > 0) {
      const found = drivers.find(d => d.email === user.email);
      setDriver(found || null);
    }
  }, [user, drivers]);

  const { data: payments = [] } = useQuery({
    queryKey: ['my-payments', driver?.id],
    queryFn: () => base44.entities.WeeklyPayment.filter({ driver_id: driver.id }, '-week_start', 52),
    enabled: !!driver?.id,
  });

  const { data: loans = [] } = useQuery({
    queryKey: ['my-loans', driver?.id],
    queryFn: () => base44.entities.Loan.filter({ driver_id: driver.id }),
    enabled: !!driver?.id,
  });

  const { data: vehiclePurchases = [] } = useQuery({
    queryKey: ['my-vehicle-purchases', driver?.id],
    queryFn: () => base44.entities.VehiclePurchase.filter({ driver_id: driver.id }),
    enabled: !!driver?.id,
  });

  const monthStart = startOfMonth(monthFilter);
  const monthEnd = endOfMonth(monthFilter);

  const monthPayments = useMemo(() => {
    return payments.filter(p => {
      const pDate = new Date(p.week_start);
      return pDate >= monthStart && pDate <= monthEnd && p.status === 'paid';
    });
  }, [payments, monthStart, monthEnd]);

  const stats = useMemo(() => {
    const allPaid = payments.filter(p => p.status === 'paid');
    return {
      totalGross: allPaid.reduce((s, p) => s + (p.total_gross || 0), 0),
      totalNet: allPaid.reduce((s, p) => s + (p.net_amount || 0), 0),
      totalDeductions: allPaid.reduce((s, p) => s + (p.total_deductions || 0), 0),
      totalUPI: allPaid.reduce((s, p) => s + (p.upi_earned || 0), 0),
      monthGross: monthPayments.reduce((s, p) => s + (p.total_gross || 0), 0),
      monthNet: monthPayments.reduce((s, p) => s + (p.net_amount || 0), 0),
      monthUPI: monthPayments.reduce((s, p) => s + (p.upi_earned || 0), 0),
      activeLoans: loans.filter(l => ['active', 'approved'].includes(l.status)).length,
      loanBalance: loans.filter(l => ['active', 'approved'].includes(l.status)).reduce((s, l) => s + (l.remaining_balance || 0), 0),
    };
  }, [payments, monthPayments, loans]);

  const pendingPayments = payments.filter(p => ['draft', 'approved', 'processing'].includes(p.status));

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    doc.setFontSize(16);
    doc.text(`Relatório Financeiro - ${driver?.full_name}`, 20, y);
    y += 15;

    doc.setFontSize(10);
    doc.text(`Período: ${format(monthStart, 'dd/MM/yyyy')} a ${format(monthEnd, 'dd/MM/yyyy')}`, 20, y);
    y += 10;

    // Summary
    doc.setFontSize(12);
    doc.text('Resumo do Mês', 20, y);
    y += 8;

    const summaryData = [
      ['Ganho Bruto', fmt(stats.monthGross)],
      ['Deduções', fmt(stats.monthNet - stats.monthGross)],
      ['Ganho Líquido', fmt(stats.monthNet)],
      ['UPI Ganho', fmt(stats.monthUPI)],
    ];

    doc.setFontSize(9);
    summaryData.forEach(([label, value]) => {
      doc.text(label, 20, y);
      doc.text(value, 150, y);
      y += 6;
    });

    y += 8;
    doc.setFontSize(12);
    doc.text('Histórico de Pagamentos', 20, y);
    y += 8;

    doc.setFontSize(8);
    monthPayments.forEach(p => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${p.period_label}`, 20, y);
      doc.text(fmt(p.net_amount), 150, y);
      y += 5;
    });

    doc.save(`relatorio-financeiro-${driver?.full_name?.replace(/\s+/g, '-').toLowerCase()}-${format(monthStart, 'MM-yyyy')}.pdf`);
  };

  if (!driver) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">A carregar...</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">{driver.full_name}</h1>
        <p className="text-indigo-200 text-sm mt-1">Dashboard Financeiro</p>
      </div>

      {/* Month Filter */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthFilter(new Date(monthFilter.getFullYear(), monthFilter.getMonth() - 1))}
        >
          ← Anterior
        </Button>
        <span className="font-medium text-sm min-w-[150px] text-center">
          {format(monthFilter, 'MMMM yyyy', { locale: { months: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'] } })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthFilter(new Date(monthFilter.getFullYear(), monthFilter.getMonth() + 1))}
        >
          Próximo →
        </Button>
        <div className="flex-1" />
        <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Bruto (Tudo)" value={fmt(stats.totalGross)} icon={TrendingUp} color="green" />
        <StatCard title="Total Líquido (Tudo)" value={fmt(stats.totalNet)} icon={Wallet} color="indigo" />
        <StatCard title="UPI Total" value={`${stats.totalUPI.toFixed(2)}`} icon={Zap} color="yellow" />
        <StatCard title="Caução" value={`€${driver.vehicle_deposit || 0}${driver.vehicle_deposit_paid ? ' ✓' : ''}`} icon={Shield} color="purple" />
      </div>

      {/* Month Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 mb-1">Ganho Líquido (Mês)</p>
            <p className="text-2xl font-bold text-indigo-700">{fmt(stats.monthNet)}</p>
            <p className="text-xs text-gray-400 mt-1">{monthPayments.length} semanas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 mb-1">Deduções (Mês)</p>
            <p className="text-2xl font-bold text-red-600">{fmt(stats.monthGross - stats.monthNet)}</p>
            <p className="text-xs text-gray-400 mt-1">Média: {fmt((stats.monthGross - stats.monthNet) / Math.max(1, monthPayments.length))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 mb-1">UPI (Mês)</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.monthUPI.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">Total carteira: {(driver.upi_balance || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments Alert */}
      {pendingPayments.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-900">⏳ Pagamentos Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendingPayments.slice(0, 3).map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2 border-b border-orange-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-orange-900">{p.period_label}</p>
                  <p className="text-xs text-orange-700">€{(p.net_amount || 0).toFixed(2)} · {p.status}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Loans */}
      {stats.activeLoans > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{stats.activeLoans} Empréstimo(s) Ativo(s)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loans.filter(l => ['active', 'approved'].includes(l.status)).map(l => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{l.amount ? `€${l.amount.toFixed(2)}` : '—'}</p>
                  <p className="text-xs text-gray-500">{l.duration_weeks || '?'} semanas · Saldo: {fmt(l.remaining_balance)}</p>
                </div>
                <Badge variant="outline">{l.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Histórico de Pagamentos
            </CardTitle>
            <span className="text-xs text-gray-400">{payments.length} total</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">Sem pagamentos.</p>
          ) : (
            <div className="divide-y max-h-96 overflow-y-auto">
              {payments.map(p => (
                <div key={p.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{p.period_label}</p>
                    <p className={`font-bold text-sm ${p.status === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                      {fmt(p.net_amount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span>Bruto: {fmt(p.total_gross)}</span>
                    <span>Deduções: {fmt(p.total_deductions)}</span>
                    {p.upi_earned > 0 && <span className="text-yellow-600">UPI: {p.upi_earned}</span>}
                    <Badge variant="outline" className="text-xs py-0">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deductions Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Deduções (Últimas 4 semanas)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.slice(0, 4).length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">Sem dados.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody className="divide-y">
                {payments.slice(0, 4).map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{p.period_label}</td>
                    <td className="px-4 py-2 text-right">{fmt(p.slot_fee)}</td>
                    <td className="px-4 py-2 text-right">{fmt(p.vehicle_rental)}</td>
                    <td className="px-4 py-2 text-right">{fmt(p.iva_amount)}</td>
                    <td className="px-4 py-2 text-right font-bold">{fmt(p.total_deductions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}