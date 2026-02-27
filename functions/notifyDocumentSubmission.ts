import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { driver_id, driver_name, driver_email, doc_type, doc_status } = await req.json();

    if (!driver_id || !driver_name || !doc_type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create notification for admins about new document submission
    const adminNotif = await base44.asServiceRole.entities.Notification.create({
      title: `Novo documento submetido - ${driver_name}`,
      message: `${driver_name} (${driver_email}) submeteu um documento: ${doc_type}. Estado: ${doc_status || 'pendente'}`,
      type: 'info',
      category: 'document_expiry',
      recipient_role: 'admin',
      recipient_email: 'all',
      related_entity: driver_id,
      action_url: `Documents?filter=driver_${driver_id}`,
      sent_email: false,
    });

    // Notify driver if document was rejected
    if (doc_status === 'rejected') {
      const driverNotif = await base44.asServiceRole.entities.Notification.create({
        title: 'Documento rejeitado',
        message: `O seu documento ${doc_type} foi rejeitado. Por favor, submeta novamente com as correções necessárias.`,
        type: 'alert',
        category: 'document_expiry',
        recipient_email: driver_email,
        related_entity: driver_id,
        sent_email: false,
      });
    }

    return Response.json({ success: true, notifId: adminNotif.id });
  } catch (error) {
    console.error('Error notifying document submission:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});