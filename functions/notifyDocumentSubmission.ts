import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const { driverId, driverName, docType } = await req.json();
    const base44 = createClientFromRequest(req);
    
    // Get admins
    const admins = await base44.asServiceRole.entities.User.list();
    const adminEmails = admins.filter(u => u.role === 'admin').map(u => u.email);

    // Send email to admins
    for (const email of adminEmails) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `📄 Novo documento enviado - ${driverName} (${docType})`,
        body: `O motorista ${driverName} submeteu um novo documento para aprovação.\n\nTipo: ${docType}\n\nAcesse a página de Documentos para revisar.`,
      });
    }

    return Response.json({ success: true, notified: adminEmails.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});