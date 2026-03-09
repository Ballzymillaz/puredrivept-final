import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function fmt(v) {
  return `€${(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function ExportPaymentPDF({ payment }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const primaryColor = [99, 102, 241]; // indigo
    const darkGray = [30, 30, 30];
    const gray = [120, 120, 120];

    // Header bar
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PureDrive PT', 15, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Recibo de Pagamento Semanal', 15, 22);

    // Driver info
    doc.setTextColor(...darkGray);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(payment.driver_name || '—', 15, 44);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.text(`Período: ${payment.period_label || `${payment.week_start} → ${payment.week_end}`}`, 15, 51);
    doc.text(`Estado: ${payment.status?.toUpperCase() || '—'}`, 15, 57);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-PT')}`, 15, 63);

    // Line
    doc.setDrawColor(220, 220, 220);
    doc.line(15, 68, 195, 68);

    // Earnings section
    let y = 76;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RECEITAS', 15, y);
    y += 6;

    const earnings = [
      ['Uber (bruto)', payment.uber_gross],
      ['Bolt (bruto)', payment.bolt_gross],
      ['Outras plataformas', payment.other_platform_gross],
    ].filter(([, v]) => v > 0);

    earnings.forEach(([label, value]) => {
      doc.setTextColor(...darkGray);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(label, 20, y);
      doc.text(fmt(value), 150, y, { align: 'right' });
      y += 6;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 150, 100);
    doc.text('Total Bruto', 20, y);
    doc.text(fmt(payment.total_gross), 150, y, { align: 'right' });
    y += 10;

    // Deductions
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DEDUÇÕES', 15, y);
    y += 6;

    const deductions = [
      ['Taxa slot', payment.slot_fee],
      ['Aluguer veículo', payment.vehicle_rental],
      ['Via Verde', payment.via_verde_amount],
      ['MyPRIO', payment.myprio_amount],
      ['Miio', payment.miio_amount],
      ['Empréstimo', payment.loan_installment],
      ['Compra veículo', payment.vehicle_purchase_installment],
      ['6% IVA (obrigatorio estado)', payment.iva_amount],
      ['Caução', payment.irs_retention],
      ['Comissão', payment.commission_amount],
    ].filter(([, v]) => v > 0);

    deductions.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...darkGray);
      doc.text(label, 20, y);
      doc.setTextColor(200, 50, 50);
      doc.text(`- ${fmt(value)}`, 150, y, { align: 'right' });
      y += 6;
    });

    if (payment.reimbursement_credit > 0 || payment.goal_bonus > 0) {
      y += 2;
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('CRÉDITOS', 15, y);
      y += 6;
      [['Reembolsos', payment.reimbursement_credit], ['Bónus objetivo', payment.goal_bonus]].filter(([, v]) => v > 0).forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...darkGray);
        doc.text(label, 20, y);
        doc.setTextColor(20, 150, 100);
        doc.text(`+ ${fmt(value)}`, 150, y, { align: 'right' });
        y += 6;
      });
    }

    // Net total box
    y += 4;
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(15, y, 180, 16, 3, 3, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('LÍQUIDO A PAGAR', 22, y + 10);
    doc.text(fmt(payment.net_amount), 188, y + 10, { align: 'right' });

    // UPI
    if (payment.upi_earned > 0) {
      y += 24;
      doc.setTextColor(...gray);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`UPI ganhos esta semana: ${payment.upi_earned} UPI`, 15, y);
    }

    // Footer
    doc.setDrawColor(220, 220, 220);
    doc.line(15, 275, 195, 275);
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.text('PureDrive PT — Gestão de Frota TVDE | Documento gerado automaticamente', 105, 280, { align: 'center' });

    doc.save(`Pagamento_${payment.driver_name?.replace(/\s/g, '_')}_${payment.period_label || payment.week_start}.pdf`);
    setLoading(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-1.5 text-xs">
      <FileDown className="w-3.5 h-3.5" />
      {loading ? 'A gerar...' : 'PDF'}
    </Button>
  );
}

export function ExportLoanPDF({ loan }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const primaryColor = [99, 102, 241];
    const darkGray = [30, 30, 30];
    const gray = [120, 120, 120];

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PureDrive PT', 15, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Contrato de Empréstimo / Adiantamento', 15, 22);

    // Borrower
    doc.setTextColor(...darkGray);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(loan.driver_name || '—', 15, 44);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...gray);
    doc.text(`Data pedido: ${loan.request_date ? new Date(loan.request_date).toLocaleDateString('pt-PT') : '—'}`, 15, 51);
    doc.text(`Estado: ${loan.status?.toUpperCase() || '—'}`, 15, 57);
    if (loan.approval_date) doc.text(`Aprovado em: ${new Date(loan.approval_date).toLocaleDateString('pt-PT')}`, 15, 63);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-PT')}`, 15, 69);

    doc.setDrawColor(220, 220, 220);
    doc.line(15, 74, 195, 74);

    // Loan details
    let y = 82;
    const rows = [
      ['Montante do empréstimo', fmt(loan.amount)],
      ['Taxa de juro semanal', `${loan.interest_rate_weekly || 1}%`],
      ['Duração', `${loan.duration_weeks} semanas`],
      ['Total a reembolsar (c/ juros)', fmt(loan.total_with_interest)],
      ['Prestação semanal', fmt(loan.weekly_installment)],
      ['Já pago', fmt(loan.paid_amount)],
      ['Saldo restante', fmt(loan.remaining_balance)],
    ];

    rows.forEach(([label, value], i) => {
      const isLast = i === rows.length - 1;
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 255);
        doc.rect(15, y - 4, 180, 8, 'F');
      }
      doc.setFont('helvetica', isLast ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.setTextColor(isLast ? ...primaryColor : ...darkGray);
      doc.text(label, 20, y);
      doc.text(value, 188, y, { align: 'right' });
      y += 10;
    });

    // Status box
    y += 6;
    const statusColors = { active: [16, 185, 129], completed: [16, 185, 129], requested: [245, 158, 11], rejected: [239, 68, 68] };
    const sc = statusColors[loan.status] || primaryColor;
    doc.setFillColor(...sc);
    doc.setFillColor(sc[0], sc[1], sc[2]);
    doc.roundedRect(15, y, 60, 12, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(loan.status?.toUpperCase() || '—', 45, y + 8, { align: 'center' });

    if (loan.notes) {
      y += 22;
      doc.setTextColor(...gray);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(`Notas: ${loan.notes}`, 15, y, { maxWidth: 180 });
    }

    // Footer
    doc.setDrawColor(220, 220, 220);
    doc.line(15, 275, 195, 275);
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.text('PureDrive PT — Gestão de Frota TVDE | Documento gerado automaticamente', 105, 280, { align: 'center' });

    doc.save(`Emprestimo_${loan.driver_name?.replace(/\s/g, '_')}_${loan.request_date || 'nd'}.pdf`);
    setLoading(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-1.5 text-xs">
      <FileDown className="w-3.5 h-3.5" />
      {loading ? 'A gerar...' : 'PDF'}
    </Button>
  );
}