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

        // Send email to driver with renewal action
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: doc.driver_email,
          subject: '⛔ Documento Expirado - Ação Necessária',
          body: `
            <html>
              <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
                  <h2 style="color:#dc2626;margin-top:0">⛔ Documento Expirado</h2>
                  <p style="color:#374151;line-height:1.6">
                    O seu documento expirou em <strong>${expiryDate.toLocaleDateString('pt-PT')}</strong>. 
                    É necessária uma ação imediata para renovar o documento.
                  </p>
                  <div style="background:#fee2e2;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #dc2626">
                    <p style="margin:0;color:#7f1d1d;font-weight:bold">Tipo de Documento:</p>
                    <p style="margin:5px 0 0 0;color:#7f1d1d">${doc.doc_type}</p>
                  </div>
                  <p style="color:#6b7280;margin-bottom:24px">
                    Clique no botão abaixo para renovar o documento no seu painel de controlo.
                  </p>
                  <a href="https://pure-drive-pt.base44.app/pages/DriverDashboard" style="background:#dc2626;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold">
                    🔄 Renovar Documento
                  </a>
                  <p style="color:#9ca3af;font-size:12px;margin-top:24px">Bem-vindo à PureDrivePT!</p>
                </div>
              </body>
            </html>
          `,
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

        // Send email to driver with renewal button
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: doc.driver_email,
          subject: '⚠️ Documento a expirar em breve',
          body: `
            <html>
              <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
                  <h2 style="color:#ea580c;margin-top:0">⚠️ Documento a Expirar</h2>
                  <p style="color:#374151;line-height:1.6">
                    O seu documento expirará em <strong>${daysUntilExpiry} dias</strong> 
                    (${expiryDate.toLocaleDateString('pt-PT')}). Recomendamos renovar em breve para evitar problemas.
                  </p>
                  <div style="background:#fef3c7;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #ea580c">
                    <p style="margin:0;color:#92400e;font-weight:bold">Tipo de Documento:</p>
                    <p style="margin:5px 0 0 0;color:#92400e">${doc.doc_type}</p>
                  </div>
                  <p style="color:#6b7280;margin-bottom:24px">
                    Clique no botão abaixo para renovar o documento no seu painel de controlo.
                  </p>
                  <a href="https://pure-drive-pt.base44.app/pages/DriverDashboard" style="background:#4f46e5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold">
                    🔄 Renovar Documento
                  </a>
                  <p style="color:#9ca3af;font-size:12px;margin-top:24px">Bem-vindo à PureDrivePT!</p>
                </div>
              </body>
            </html>
          `,
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