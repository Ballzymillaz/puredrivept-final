import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { contract_id } = await req.json();

    const contract = await base44.asServiceRole.entities.Contract.get(contract_id);
    if (!contract) return Response.json({ error: 'Contrato não encontrado' }, { status: 404 });

    const driver = await base44.asServiceRole.entities.Driver.get(contract.driver_id);
    if (!driver?.email) return Response.json({ error: 'Email do motorista não encontrado' }, { status: 400 });

    const signLink = `${req.headers.get('origin') || 'https://puredrivept.base44.app'}/Contracts?sign=${contract_id}`;

    const emailBody = `
Olá ${driver.full_name},

O seu contrato com a PureDrivePT está pronto para assinatura.

📋 Detalhes do contrato:
- Tipo: ${contract.contract_type?.replace('_', ' ')}
- Veículo: ${contract.vehicle_info || 'A definir'}
- Data de início: ${contract.start_date || 'A definir'}
- Valor semanal: €${contract.slot_fee || contract.weekly_rental_price || 0}

Para assinar o contrato, clique no link abaixo:
${signLink}

${contract.contract_file_url ? `Ver contrato em PDF: ${contract.contract_file_url}` : ''}

Atenciosamente,
Equipa PureDrivePT
    `.trim();

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: driver.email,
      subject: '📋 Contrato PureDrivePT — Assinatura necessária',
      body: emailBody,
      from_name: 'PureDrivePT',
    });

    // Update contract status
    await base44.asServiceRole.entities.Contract.update(contract_id, {
      status: 'active',
      notes: (contract.notes || '') + `\nEmail de assinatura enviado em ${new Date().toLocaleDateString('pt-PT')} para ${driver.email}`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});