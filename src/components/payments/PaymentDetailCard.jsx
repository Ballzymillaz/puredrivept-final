import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const PaymentDetailCard = ({ payment }) => {
  const sections = [
    {
      title: 'Receita Bruta',
      items: [
        { label: 'Uber', value: payment.uber_gross || 0 },
        { label: 'Bolt', value: payment.bolt_gross || 0 },
        { label: 'Outras Plataformas', value: payment.other_platform_gross || 0 },
      ],
      highlight: true,
      total: payment.total_gross || 0,
    },
    {
      title: 'Taxas de Plataforma',
      items: [
        { label: 'Taxa Uber', value: -(payment.platform_fee_uber || 0) },
        { label: 'Taxa Bolt', value: -(payment.platform_fee_bolt || 0) },
      ],
      total: -(payment.total_platform_fees || 0),
    },
    {
      title: 'Deduções',
      items: [
        { label: 'Comissão Empresa', value: -(payment.commission_amount || 0) },
        { label: 'Taxa Slot Semanal', value: -(payment.slot_fee || 0) },
        { label: 'Aluguer Veículo', value: -(payment.vehicle_rental || 0) },
        { label: 'Via Verde (Portagens)', value: -(payment.via_verde_amount || 0) },
        { label: 'MyPRIO (Combustível)', value: -(payment.myprio_amount || 0) },
        { label: 'Miio (Carregamento)', value: -(payment.miio_amount || 0) },
        { label: 'Prestação Empréstimo', value: -(payment.loan_installment || 0) },
        { label: 'Prestação Compra Veículo', value: -(payment.vehicle_purchase_installment || 0) },
        { label: 'Outros Descontos', value: -(payment.other_deductions || 0), desc: payment.other_deductions_label },
      ],
      total: -(payment.total_deductions || 0),
    },
    {
      title: 'Créditos & Bónus',
      items: [
        { label: 'Reembolsos Aprovados', value: payment.reimbursement_credit || 0 },
        { label: 'Bónus de Desempenho', value: payment.goal_bonus || 0 },
        { label: 'Outros Créditos', value: payment.other_credits || 0, desc: payment.other_credits_label },
      ],
      total: payment.total_credits || 0,
    },
    {
      title: 'Impostos',
      items: [
        { label: `IVA (${(payment.iva_rate || 0).toFixed(1)}%)`, value: -(payment.iva_amount || 0) },
        { label: `IRS - Retenção (${(payment.irs_retention_rate || 0).toFixed(1)}%)`, value: -(payment.irs_retention || 0) },
      ],
      total: -((payment.iva_amount || 0) + (payment.irs_retention || 0)),
    },
    {
      title: 'UPI - Moeda Interna',
      items: [
        { label: 'UPI Ganho (4%)', value: payment.upi_earned || 0 },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Period Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Período</p>
          <p className="font-semibold text-sm mt-1">
            {format(new Date(payment.week_start), 'dd/MM/yyyy')} - {format(new Date(payment.week_end), 'dd/MM/yyyy')}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Status</p>
          <div className="mt-1">
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

      {/* Breakdown Sections */}
      {sections.map((section, idx) => (
        <Card key={idx} className={section.highlight ? 'border-indigo-200 bg-indigo-50' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {section.items.map((item, itemIdx) => (
              <div key={itemIdx} className="flex justify-between text-sm">
                <div>
                  <span className="text-gray-700">{item.label}</span>
                  {item.desc && <p className="text-xs text-gray-500">{item.desc}</p>}
                </div>
                <span className={`font-medium ${item.value < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  €{Math.abs(item.value).toFixed(2)}
                </span>
              </div>
            ))}
            
            {section.total !== undefined && (
              <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                <span className="text-gray-900">{section.title}</span>
                <span className={section.total < 0 ? 'text-red-600' : 'text-emerald-600'}>
                  €{Math.abs(section.total).toFixed(2)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Final Amount */}
      <Card className="border-emerald-300 bg-emerald-50">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <p className="font-semibold text-lg text-gray-900">Valor Líquido a Receber</p>
            <p className="text-3xl font-bold text-emerald-600">
              €{(payment.net_amount || 0).toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {payment.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{payment.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentDetailCard;