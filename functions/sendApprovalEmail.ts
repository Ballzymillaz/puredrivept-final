import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { data } = await req.json();

    if (!data || !data.email || data.status !== 'approved') {
      return Response.json({ success: false });
    }

    const typeLabels = {
      driver: 'Motorista TVDE',
      fleet_manager: 'Gestor de frota',
      commercial: 'Comercial'
    };

    // Send approval email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: data.email,
      subject: 'Candidatura aprovada - PureDrive PT',
      body: `
        <h2>Parabéns! A sua candidatura foi aprovada</h2>
        <p>Olá ${data.full_name},</p>
        <p>Temos o prazer de informar que a sua candidatura como <strong>${typeLabels[data.applicant_type] || data.applicant_type}</strong> foi aprovada!</p>
        <p>A nossa equipa entrará em contacto consigo em breve para os próximos passos.</p>
        <br>
        <p>Bem-vindo à família PureDrive PT!</p>
        <p>Atenciosamente,<br>Equipa PureDrive PT</p>
      `
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});