import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await base44.asServiceRole.entities.Document.list();
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

    // Mark expired docs
    for (const doc of expired) {
      await base44.asServiceRole.entities.Document.update(doc.id, { status: 'expired' });
    }

    // Notify admins if any expiring/expired
    if (expiring.length > 0 || expired.length > 0) {
      const lines = [];
      if (expired.length > 0) {
        lines.push(`<b>${expired.length} documento(s) expirado(s):</b>`);
        expired.slice(0, 5).forEach(d => lines.push(`- ${d.owner_name}: ${d.document_type} (${d.expiry_date})`));
      }
      if (expiring.length > 0) {
        lines.push(`<b>${expiring.length} documento(s) a expirar nos próximos 30 dias:</b>`);
        expiring.slice(0, 5).forEach(d => {
          const days = Math.ceil((new Date(d.expiry_date) - now) / (1000 * 60 * 60 * 24));
          lines.push(`- ${d.owner_name}: ${d.document_type} (${days} dias)`);
        });
      }

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'admin@puredrivept.com',
        subject: `⚠️ PureDrivePT - Documentos a expirar (${new Date().toLocaleDateString('pt-PT')})`,
        body: lines.join('\n'),
      });
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