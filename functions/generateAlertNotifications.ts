import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);
  const todayStr = today.toISOString().split('T')[0];
  const in30Str = in30Days.toISOString().split('T')[0];

  let created = 0;

  // ── 1. Documents expiring in 30 days ───────────────────────────────────
  const docs = await base44.asServiceRole.entities.Document.list('-expiry_date', 500);
  const expiringDocs = docs.filter(d =>
    d.expiry_date && d.expiry_date >= todayStr && d.expiry_date <= in30Str &&
    d.status !== 'expired'
  );

  for (const doc of expiringDocs) {
    const daysLeft = Math.ceil((new Date(doc.expiry_date) - today) / (1000 * 60 * 60 * 24));
    // Avoid duplicate: check if already notified recently
    const existing = await base44.asServiceRole.entities.Notification.filter({
      type: 'document',
      recipient_scope: 'all',
    }, '-created_date', 50);

    const alreadyExists = existing.some(n =>
      n.title?.includes(doc.owner_name) &&
      n.message?.includes(doc.document_type) &&
      n.created_date && (today - new Date(n.created_date)) < 7 * 24 * 60 * 60 * 1000
    );

    if (!alreadyExists) {
      await base44.asServiceRole.entities.Notification.create({
        title: `Documento a expirar — ${doc.owner_name}`,
        message: `${doc.document_type.replace(/_/g, ' ')} expira em ${daysLeft} dia(s) (${doc.expiry_date}). Renove com urgência.`,
        type: 'document',
        recipient_scope: 'all',
        read_by: [],
      });
      created++;
    }
  }

  // ── 2. Drivers without a vehicle assigned (fleet problem alert) ─────────
  const drivers = await base44.asServiceRole.entities.Driver.filter({ status: 'active' }, null, 200);
  const noVehicle = drivers.filter(d => !d.assigned_vehicle_id);
  if (noVehicle.length > 0) {
    const existing = await base44.asServiceRole.entities.Notification.filter({
      type: 'system',
    }, '-created_date', 20);
    const alreadyExists = existing.some(n =>
      n.title?.includes('sem veículo') &&
      n.created_date && (today - new Date(n.created_date)) < 24 * 60 * 60 * 1000
    );
    if (!alreadyExists) {
      await base44.asServiceRole.entities.Notification.create({
        title: `${noVehicle.length} motorista(s) ativo(s) sem veículo`,
        message: `Os seguintes motoristas estão ativos mas sem veículo atribuído: ${noVehicle.slice(0, 5).map(d => d.full_name).join(', ')}${noVehicle.length > 5 ? ` e mais ${noVehicle.length - 5}` : ''}.`,
        type: 'system',
        recipient_scope: 'fleet_manager',
        read_by: [],
      });
      created++;
    }
  }

  return Response.json({ success: true, notificationsCreated: created });
});