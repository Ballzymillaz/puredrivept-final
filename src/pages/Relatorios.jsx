import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, TrendingUp, Wallet, Shield, Zap } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';

const CONTRACT_LABELS = {
  slot_standard: 'Slot Standard',
  slot_premium: 'Slot Premium',
  slot_black: 'Slot Black',
  location: 'Aluguer',
};

const fmt = (n) => `€${(n || 0).toFixed(2)}`;

export default function Relatorios() {
  const [filters, setFilters] = useState({
    driver_id: '',
    contract_type: '',
    date_from: '',
    date_to: '',
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list('-created_date'),
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.WeeklyPayment.list('-week_start'),
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (p.status !== 'paid') return false;
      if (filters.driver_id && p.driver_id !== filters.driver_id) return false;
      if (filters.contract_type) {
        const driver = drivers.find(d => d.id === p.driver_id);
        if (!driver || driver.contract_type !== filters.contract_type) return false;
      }
      if (filters.date_from && p.week_start < filters.date_from) return false;
      if (filters.date_to && p.week_end > filters.date_to) return false;
      return true;
    });
  }, [payments, filters, drivers]);

  const stats = useMemo(() => {
    const total = filteredPayments.length;
    const totalGross = filteredPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    const totalNet = filteredPayments.reduce((s, p) => s + (p.net_amount || 0), 0);
    const totalDeductions = filteredPayments.reduce((s, p) => s + (p.total_deductions || 0), 0);
    const totalUpi = filteredPayments.reduce((s, p) => s + (p.upi_earned || 0), 0);
    const avgUpi = total > 0 ? totalUpi / total : 0;

    // Get unique drivers in filtered payments
    const driverIds = [...new Set(filteredPayments.map(p => p.driver_id))];
    const driversData = driverIds.map(id => {
      const d = drivers.find(dr => dr.id === id);
      const dPayments = filteredPayments.filter(p => p.driver_id === id);
      return {
        id,
        name: dPayments[0]?.driver_name || '—',
        contract_type: d?.contract_type,
        vehicle_deposit: d?.vehicle_deposit || 0,
        vehicle_deposit_paid: d?.vehicle_deposit_paid || false,
        payments: dPayments,
        gross: dPayments.reduce((s, p) => s + (p.total_gross || 0), 0),
        net: dPayments.reduce((s, p) => s + (p.net_amount || 0), 0),
        deductions: dPayments.reduce((s, p) => s + (p.total_deductions || 0), 0),
        upi: dPayments.reduce((s, p) => s + (p.upi_earned || 0), 0),
      };
    });

    // Average gross per driver per week
    const uniqueDriverCount = driverIds.length;
    const avgGrossPerDriverPerWeek = uniqueDriverCount > 0 && total > 0
      ? totalGross / uniqueDriverCount / (total / (uniqueDriverCount || 1))
      : 0;
    // Better: total gross / nb drivers / nb weeks
    const totalWeeks = total > 0 && uniqueDriverCount > 0 ? Math.round(total / uniqueDriverCount) : 0;
    const avgGrossPerWeek = uniqueDriverCount > 0 && totalWeeks > 0 ? totalGross / uniqueDriverCount / totalWeeks : 0;

    return { total, totalGross, totalNet, totalDeductions, avgUpi, driversData, avgGrossPerDriverPerWeek: avgGrossPerWeek, uniqueDriverCount, totalWeeks };
  }, [filteredPayments, drivers]);

  const selectedDriver = drivers.find(d => d.id === filters.driver_id);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(67, 56, 202);
    doc.text('PureDrivePT - Relatório de Performance', pageW / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const subtitle = [
      selectedDriver ? `Motorista: ${selectedDriver.full_name}` : 'Todos os motoristas',
      filters.contract_type ? `Contrato: ${CONTRACT_LABELS[filters.contract_type]}` : '',
      filters.date_from ? `De: ${filters.date_from}` : '',
      filters.date_to ? `Até: ${filters.date_to}` : '',
    ].filter(Boolean).join('  |  ');
    doc.text(subtitle || 'Todos os dados', pageW / 2, y, { align: 'center' });
    y += 6;
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW / 2, y, { align: 'center' });
    y += 10;

    // Summary box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(10, y, pageW - 20, 28, 2, 2, 'FD');
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const col1 = 20, col2 = 70, col3 = 120, col4 = 160;
    doc.setFont(undefined, 'bold');
    doc.text('Total Bruto', col1, y);
    doc.text('Total Líquido', col2, y);
    doc.text('Total Deduções', col3, y);
    doc.text('Média UPI/sem', col4, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(67, 56, 202);
    doc.setFontSize(11);
    doc.text(`€${stats.totalGross.toFixed(2)}`, col1, y);
    doc.text(`€${stats.totalNet.toFixed(2)}`, col2, y);
    doc.text(`€${stats.totalDeductions.toFixed(2)}`, col3, y);
    doc.text(`€${stats.avgUpi.toFixed(2)}`, col4, y);
    y += 18;

    // Per driver section
    if (stats.driversData.length > 1) {
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.setFont(undefined, 'bold');
      doc.text('Resumo por Motorista', 10, y);
      y += 6;

      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text('Motorista', 10, y);
      doc.text('Contrato', 65, y);
      doc.text('Semanas', 100, y);
      doc.text('Bruto', 125, y);
      doc.text('Líquido', 155, y);
      doc.text('Caução', 185, y);
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(10, y, pageW - 10, y);
      y += 3;

      doc.setFont(undefined, 'normal');
      for (const d of stats.driversData) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setTextColor(30, 30, 30);
        doc.text(d.name.substring(0, 28), 10, y);
        doc.text(CONTRACT_LABELS[d.contract_type] || '—', 65, y);
        doc.text(String(d.payments.length), 105, y);
        doc.text(`€${d.gross.toFixed(2)}`, 120, y);
        doc.text(`€${d.net.toFixed(2)}`, 150, y);
        doc.setTextColor(d.vehicle_deposit_paid ? 22 : 220, d.vehicle_deposit_paid ? 163 : 100, d.vehicle_deposit_paid ? 74 : 0);
        doc.text(d.vehicle_deposit_paid ? 'Pago' : `€${d.vehicle_deposit}/500`, 183, y);
        doc.setTextColor(30, 30, 30);
        y += 6;
      }
      y += 4;
    }

    // Payment history
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Histórico de Pagamentos', 10, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Motorista', 10, y);
    doc.text('Período', 60, y);
    doc.text('Bruto', 100, y);
    doc.text('Deduções', 125, y);
    doc.text('Líquido', 155, y);
    doc.text('UPI', 185, y);
    y += 4;
    doc.line(10, y, pageW - 10, y);
    y += 3;

    doc.setFont(undefined, 'normal');
    for (const p of filteredPayments) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(30, 30, 30);
      doc.text(p.driver_name?.substring(0, 22) || '—', 10, y);
      doc.text(p.period_label?.substring(0, 18) || '—', 60, y);
      doc.text(`€${(p.total_gross || 0).toFixed(2)}`, 98, y);
      doc.text(`€${(p.total_deductions || 0).toFixed(2)}`, 123, y);
      doc.text(`€${(p.net_amount || 0).toFixed(2)}`, 153, y);
      doc.text(`€${(p.upi_earned || 0).toFixed(2)}`, 183, y);
      y += 5;
    }

    const fileName = `relatorio_${selectedDriver ? selectedDriver.full_name.replace(/ /g, '_') : 'geral'}_${format(new Date(), 'yyyyMMdd')}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Relatórios" subtitle="Performance detalhada dos motoristas" />

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Motorista</Label>
          <Select value={filters.driver_id} onValueChange={v => setFilter('driver_id', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo de contrato</Label>
          <Select value={filters.contract_type} onValueChange={v => setFilter('contract_type', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="slot_standard">Slot Standard</SelectItem>
              <SelectItem value="slot_premium">Slot Premium</SelectItem>
              <SelectItem value="slot_black">Slot Black</SelectItem>
              <SelectItem value="location">Aluguer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De (data)</Label>
          <Input type="date" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até (data)</Label>
          <Input type="date" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">Total Bruto</p>
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.totalGross)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.total} pagamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">Total Líquido</p>
              <Wallet className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-600">{fmt(stats.totalNet)}</p>
            <p className="text-xs text-gray-400 mt-1">Após deduções</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">Total Deduções</p>
              <FileText className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-500">{fmt(stats.totalDeductions)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.totalGross > 0 ? ((stats.totalDeductions / stats.totalGross) * 100).toFixed(1) : 0}% do bruto
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">Média UPI / semana</p>
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">{fmt(stats.avgUpi)}</p>
            <p className="text-xs text-gray-400 mt-1">Por pagamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">Média Bruto / motorista / semana</p>
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-indigo-700">{fmt(stats.avgGrossPerDriverPerWeek)}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.uniqueDriverCount} motoristas · {stats.totalWeeks} sem. méd.</p>
          </CardContent>
        </Card>
      </div>

      {/* Per driver table */}
      {stats.driversData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Resumo por Motorista</CardTitle>
            <Button onClick={exportPDF} size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-2">
              <Download className="w-3.5 h-3.5" /> Exportar PDF
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Motorista</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Contrato</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Semanas</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Bruto Total</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Deduções</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Líquido Total</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">UPI Ganho</th>
                    <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500">Caução</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.driversData.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{d.name}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{CONTRACT_LABELS[d.contract_type] || '—'}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{d.payments.length}</td>
                      <td className="py-3 px-4 text-right font-medium">{fmt(d.gross)}</td>
                      <td className="py-3 px-4 text-right text-red-500">{fmt(d.deductions)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600">{fmt(d.net)}</td>
                      <td className="py-3 px-4 text-right text-yellow-600">{fmt(d.upi)}</td>
                      <td className="py-3 px-4 text-center">
                        {d.vehicle_deposit_paid ? (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">Pago ✓</Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">€{d.vehicle_deposit}/500</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Histórico de Pagamentos ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center py-8 text-gray-400 text-sm">A carregar...</p>
          ) : filteredPayments.length === 0 ? (
            <p className="text-center py-8 text-gray-400 text-sm">Nenhum pagamento encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Motorista</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Período</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Bruto</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Deduções</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Líquido</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">UPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPayments.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-medium text-gray-900 text-xs">{p.driver_name}</td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">{p.period_label}</td>
                      <td className="py-2.5 px-4 text-right text-xs">{fmt(p.total_gross)}</td>
                      <td className="py-2.5 px-4 text-right text-xs text-red-500">{fmt(p.total_deductions)}</td>
                      <td className="py-2.5 px-4 text-right text-xs font-semibold text-green-600">{fmt(p.net_amount)}</td>
                      <td className="py-2.5 px-4 text-right text-xs text-yellow-600">{fmt(p.upi_earned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}