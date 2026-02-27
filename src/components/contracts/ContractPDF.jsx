import { jsPDF } from 'jspdf';

export function generateContractPDF(contract, driver, vehicle) {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('pt-PT');
  const contractTypeLabels = {
    slot_standard: 'Slot Standard',
    slot_premium: 'Slot Premium',
    slot_black: 'Slot Black',
    location: 'Aluguer de Veículo',
  };

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PureDrivePT', 105, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Contrato de Prestação de Serviços', 105, 30, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Emitido em: ${today}`, 105, 38, { align: 'center' });

  // Divider
  doc.setLineWidth(0.5);
  doc.line(20, 42, 190, 42);

  // Parties
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PARTES', 20, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('EMPRESA: PureDrivePT Lda.', 20, 60);
  doc.text('MOTORISTA:', 20, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(driver?.full_name || contract.driver_name || '—', 55, 68);
  doc.setFont('helvetica', 'normal');
  doc.text(`Email: ${driver?.email || '—'}`, 20, 76);
  doc.text(`NIF: ${driver?.nif || '—'}`, 20, 84);
  doc.text(`Telefone: ${driver?.phone || '—'}`, 20, 92);

  // Divider
  doc.line(20, 98, 190, 98);

  // Vehicle
  if (vehicle || contract.vehicle_info) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VEÍCULO', 20, 108);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const vLabel = vehicle ? `${vehicle.brand} ${vehicle.model} - ${vehicle.license_plate}` : contract.vehicle_info;
    doc.text(`Veículo: ${vLabel}`, 20, 116);
    if (vehicle) {
      doc.text(`Combustível: ${vehicle.fuel_type || '—'}  |  Cor: ${vehicle.color || '—'}`, 20, 124);
      doc.text(`VIN: ${vehicle.vin || '—'}`, 20, 132);
    }
    doc.line(20, 138, 190, 138);
  }

  // Contract terms
  const yBase = vehicle ? 148 : 108;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CONDIÇÕES DO CONTRATO', 20, yBase);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Tipo de contrato: ${contractTypeLabels[contract.contract_type] || contract.contract_type}`, 20, yBase + 10);
  const weeklyFee = contract.slot_fee || contract.weekly_rental_price || 0;
  doc.text(`Valor semanal: €${weeklyFee}`, 20, yBase + 18);
  doc.text(`Data de início: ${contract.start_date || '—'}`, 20, yBase + 26);
  doc.text(`Data de fim: ${contract.end_date || 'Indefinido'}`, 20, yBase + 34);

  // Signature boxes
  const sigY = yBase + 60;
  doc.line(20, sigY, 190, sigY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ASSINATURAS', 20, sigY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.text('Empresa:', 20, sigY + 24);
  doc.line(20, sigY + 40, 85, sigY + 40);
  doc.text('PureDrivePT Lda.', 20, sigY + 46);
  doc.text(`Data: ${today}`, 20, sigY + 54);

  doc.text('Motorista:', 115, sigY + 24);
  doc.line(115, sigY + 40, 180, sigY + 40);
  doc.text(driver?.full_name || contract.driver_name || '—', 115, sigY + 46);
  doc.text(`Data: ___/___/______`, 115, sigY + 54);

  if (contract.notes) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Notas: ${contract.notes}`, 20, sigY + 70);
    doc.setTextColor(0);
  }

  return doc;
}