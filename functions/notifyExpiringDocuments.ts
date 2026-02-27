import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await base44.asServiceRole.entities.Document.list();
    const drivers = await base44.asServiceRole.entities.Driver.list();
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const users = await base44.asServiceRole.entities.User.list();
    const now = new Date();

    const expiring = documents.filter(doc => {
      if (!doc.expiry_date || doc.status === 'expired') return false;
      const expDate = new Date(doc.expiry_date);
      const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 30;
    });

    const expired = documents.filter(doc => {
      if (!doc.expiry_date) return false;
      const expDate = new Date(doc.expiry_date);
      return expDate < now && doc.status !== 'expired';
    });

    // Mark expired docs and create notifications
    for (const doc of expired) {
      await base44.asServiceRole.entities.Document.update(doc.id, { status: 'expired' });
      
      // Notify admin
      const adminUsers = users.filter(u => u.role === 'admin');
      for (const admin of adminUsers) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          user_email: admin.email,
          title: '❌ Documento expirado',
          message: `${doc.owner_name} - ${doc.document_type}`,
          type: 'document_expiring',
          related_entity_type: 'document',
          related_entity_id: doc.id,
          email_sent: false,
        });
      }
    }

    // Create notifications for expiring docs
    for (const doc of expiring) {
      const daysLeft = Math.ceil((new Date(doc.expiry_date) - now) / (1000 * 60 * 60 * 24));
      if (doc.owner_type === 'driver') {
        const driver = drivers.find(d => d.id === doc.owner_id);
        if (driver) {
          const driverUser = users.find(u => u.email === driver.email);
          if (driverUser) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: driverUser.id,
              user_email: driver.email,
              title: '⚠️ Documento a expirar',
              message: `${doc.document_type} expira em ${daysLeft} dias (${doc.expiry_date})`,
              type: 'document_expiring',
              related_entity_type: 'document',
              related_entity_id: doc.id,
              email_sent: false,
            });
          }
        }
      }

      // Notify admin
      const adminUsers = users.filter(u => u.role === 'admin');
      for (const admin of adminUsers) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: admin.id,
          user_email: admin.email,
          title: '⚠️ Documento a expirar',
          message: `${doc.owner_name} - ${doc.document_type} (${daysLeft} dias)`,
          type: 'document_expiring',
          related_entity_type: 'document',
          related_entity_id: doc.id,
          email_sent: false,
        });
      }
    }

    // Send emails for new notifications
    const newNotifs = await base44.asServiceRole.entities.Notification.filter({ email_sent: false });
    for (const notif of newNotifs.filter(n => n.type === 'document_expiring')) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: notif.user_email,
        subject: notif.title,
        body: notif.message,
      });
      await base44.asServiceRole.entities.Notification.update(notif.id, { email_sent: true });
    }

    return Response.json({
      success: true,
      expired: expired.length,
      expiring: expiring.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});