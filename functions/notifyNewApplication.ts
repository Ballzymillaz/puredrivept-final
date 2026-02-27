import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { data } = await req.json();

    if (!data) {
      return Response.json({ error: 'No application data' }, { status: 400 });
    }

    // Get all admin users
    const users = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    
    const typeLabels = {
      driver: 'Motorista TVDE',
      fleet_manager: 'Gestor de frota',
      commercial: 'Comercial'
    };

    // Send email to all admins
    for (const admin of users) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `Nova candidatura: ${typeLabels[data.applicant_type] || data.applicant_type}`,
        body: `
          <h2>Nova candidatura recebida</h2>
          <p><strong>Nome:</strong> ${data.full_name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Telefone:</strong> ${data.phone}</p>
          <p><strong>Tipo:</strong> ${typeLabels[data.applicant_type] || data.applicant_type}</p>
          ${data.nif ? `<p><strong>NIF:</strong> ${data.nif}</p>` : ''}
          ${data.referral_code ? `<p><strong>Código de indicação:</strong> ${data.referral_code}</p>` : ''}
          ${data.message ? `<p><strong>Mensagem:</strong><br>${data.message}</p>` : ''}
          <br>
          <p><a href="https://pure-drive-pt.base44.app" style="background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; display: inline-block;">Ver candidatura</a></p>
        `
      });
    }

    return Response.json({ success: true, notified: users.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});