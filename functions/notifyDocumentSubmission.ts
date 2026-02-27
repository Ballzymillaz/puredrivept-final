import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const { driverId, driverName, docType } = await req.json();
    const base44 = createClientFromRequest(req);
    
    const users = await base44.asServiceRole.entities.User.list();
    const adminUsers = users.filter(u => u.role === 'admin');

    // Create notifications for admins
    for (const admin of adminUsers) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: admin.id,
        user_email: admin.email,
        title: '📄 Novo documento',
        message: `${driverName} enviou ${docType} para aprovação`,
        type: 'document_approved',
        email_sent: false,
      });

      // Send email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `📄 Novo documento enviado - ${driverName} (${docType})`,
        body: `O motorista ${driverName} submeteu um novo documento para aprovação.\n\nTipo: ${docType}`,
      });
    }

    return Response.json({ success: true, notified: adminUsers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});