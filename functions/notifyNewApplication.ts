import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const { applicationId } = await req.json();
    const base44 = createClientFromRequest(req);

    const app = await base44.asServiceRole.entities.Application.get(applicationId);
    const users = await base44.asServiceRole.entities.User.list();
    const adminUsers = users.filter(u => u.role === 'admin');

    const typeLabel = {
      driver: 'Motorista',
      fleet_manager: 'Gestor de Frota',
      commercial: 'Comercial',
    }[app.applicant_type] || app.applicant_type;

    // Notify admins
    for (const admin of adminUsers) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: admin.id,
        user_email: admin.email,
        title: '📝 Nova candidatura',
        message: `${app.full_name} candidatou-se como ${typeLabel}`,
        type: 'application_new',
        related_entity_type: 'application',
        related_entity_id: applicationId,
        email_sent: false,
      });
    }

    // Send emails
    const newNotifs = await base44.asServiceRole.entities.Notification.filter({ email_sent: false, related_entity_id: applicationId });
    for (const notif of newNotifs) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: notif.user_email,
        subject: notif.title,
        body: `${app.full_name} (${app.email}) candidatou-se como ${typeLabel}.\n\nMensagem: ${app.message || 'N/A'}`,
      });
      await base44.asServiceRole.entities.Notification.update(notif.id, { email_sent: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});