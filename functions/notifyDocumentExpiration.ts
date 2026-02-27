import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all documents with expiry dates
    const allDocs = await base44.asServiceRole.entities.Document.list('-created_date');
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const notifications = [];

    for (const doc of allDocs) {
      if (!doc.expiry_date) continue;

      const expiryDate = new Date(doc.expiry_date);
      const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

      // Check if document is expired
      if (daysUntilExpiry < 0) {
        // Create notification for driver
        await base44.asServiceRole.entities.Notification.create({
          title: '⛔ Documento Expirado',
          message: `O seu documento expirou em ${expiryDate.toLocaleDateString('pt-PT')}. Ação imediata necessária.`,
          type: 'alert',
          category: 'document_expiry',
          recipient_email: doc.driver_email,
          related_entity: doc.id,
          action_url: '/pages/DriverDashboard',
          sent_email: false,
        });

        // Create notification for admin with link to management page
        await base44.asServiceRole.entities.Notification.create({
          title: '⛔ Documento Expirado — ' + doc.driver_email,
          message: `Documento expirado em ${expiryDate.toLocaleDateString('pt-PT')}. Motorista precisa renovar. [Ver detalhes]`,
          type: 'alert',
          category: 'document_expiry',
          recipient_role: 'admin',
          related_entity: doc.id,
          action_url: '/pages/DocumentManagement',
          sent_email: false,
        });

        notifications.push({ doc_id: doc.id, driver_email: doc.driver_email, status: 'expired' });
      }
      // Check if expiring soon (within 30 days)
      else if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        // Create notification for driver with renewal link
        await base44.asServiceRole.entities.Notification.create({
          title: '⚠️ Documento a expirar em breve',
          message: `Seu documento expirará em ${daysUntilExpiry} dias (${expiryDate.toLocaleDateString('pt-PT')}). [Renovar agora]`,
          type: 'warning',
          category: 'document_expiry',
          recipient_email: doc.driver_email,
          related_entity: doc.id,
          action_url: '/pages/DriverDashboard',
          sent_email: false,
        });

        // Create notification for admin with link to management page
        await base44.asServiceRole.entities.Notification.create({
          title: '⚠️ Documento a expirar — ' + doc.driver_email,
          message: `Documento expira em ${daysUntilExpiry} dias (${expiryDate.toLocaleDateString('pt-PT')}). [Ver detalhes]`,
          type: 'warning',
          category: 'document_expiry',
          recipient_role: 'admin',
          related_entity: doc.id,
          action_url: '/pages/DocumentManagement',
          sent_email: false,
        });

        notifications.push({ doc_id: doc.id, driver_email: doc.driver_email, status: 'expiring_soon', days_left: daysUntilExpiry });
      }
    }

    return Response.json({
      success: true,
      notifications_created: notifications.length,
      details: notifications,
    });
  } catch (error) {
    console.error('Error in notifyDocumentExpiration:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});