import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all documents with expiry dates
    const documents = await base44.asServiceRole.entities.Document.list();
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiredAndExpiring = documents.filter(doc => {
      if (!doc.expiry_date) return false;
      const expiryDate = new Date(doc.expiry_date);
      return expiryDate <= thirtyDaysFromNow;
    });

    // Group by driver
    const notificationsByDriver = {};
    expiredAndExpiring.forEach(doc => {
      if (!notificationsByDriver[doc.driver_email]) {
        notificationsByDriver[doc.driver_email] = [];
      }
      notificationsByDriver[doc.driver_email].push(doc);
    });

    // Create notifications for each driver
    for (const [driverEmail, docs] of Object.entries(notificationsByDriver)) {
      const expiredCount = docs.filter(d => new Date(d.expiry_date) < now).length;
      const expiringCount = docs.filter(d => {
        const expiry = new Date(d.expiry_date);
        return expiry >= now && expiry <= thirtyDaysFromNow;
      }).length;

      if (expiredCount > 0) {
        await base44.asServiceRole.entities.Notification.create({
          title: '⚠️ Documentos expirados',
          message: `Você tem ${expiredCount} documento(s) expirado(s). Por favor, atualize-os imediatamente.`,
          type: 'alert',
          category: 'document_expiry',
          recipient_email: driverEmail,
          action_url: 'DocumentsHub',
          sent_email: false,
        });
      }

      if (expiringCount > 0) {
        await base44.asServiceRole.entities.Notification.create({
          title: '📋 Documentos vencendo em breve',
          message: `Você tem ${expiringCount} documento(s) vencendo nos próximos 30 dias. Considere atualizá-los agora.`,
          type: 'warning',
          category: 'document_expiry',
          recipient_email: driverEmail,
          action_url: 'DocumentsHub',
          sent_email: false,
        });
      }
    }

    return Response.json({
      success: true,
      notified: Object.keys(notificationsByDriver).length,
      documentsChecked: expiredAndExpiring.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});