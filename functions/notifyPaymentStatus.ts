import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();

  const { event, data, old_data } = body;

  // Only trigger on update events where status changed
  if (event?.type !== 'update' || !data || !old_data) {
    return Response.json({ ok: true });
  }

  const newStatus = data.status;
  const oldStatus = old_data.status;

  if (newStatus === oldStatus) return Response.json({ ok: true });

  const driverName = data.driver_name || 'Motorista';
  const period = data.period_label || '';

  let title = '';
  let message = '';
  let type = 'payment';

  if (newStatus === 'approved') {
    title = `Pagamento aprovado — ${driverName}`;
    message = `O pagamento da semana ${period} de ${driverName} foi aprovado e aguarda processamento.`;
  } else if (newStatus === 'paid') {
    title = `Pagamento processado — ${driverName}`;
    message = `O pagamento da semana ${period} de ${driverName} foi marcado como pago.`;
  } else if (newStatus === 'submitted') {
    title = `Pagamento submetido — ${driverName}`;
    message = `Um novo pagamento da semana ${period} de ${driverName} foi submetido para aprovação.`;
  } else {
    return Response.json({ ok: true });
  }

  await base44.asServiceRole.entities.Notification.create({
    title,
    message,
    type,
    recipient_scope: 'fleet_manager',
    read_by: [],
  });

  return Response.json({ ok: true });
});