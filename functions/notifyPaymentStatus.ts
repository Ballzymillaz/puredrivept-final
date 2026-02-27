import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const { paymentId, status } = await req.json();
    const base44 = createClientFromRequest(req);

    const payment = await base44.asServiceRole.entities.WeeklyPayment.get(paymentId);
    const drivers = await base44.asServiceRole.entities.Driver.list();
    const users = await base44.asServiceRole.entities.User.list();

    const driver = drivers.find(d => d.id === payment.driver_id);
    const driverUser = users.find(u => u.email === driver.email);

    if (!driverUser) {
      return Response.json({ error: 'Driver user not found' }, { status: 404 });
    }

    const title = status === 'paid' 
      ? '✅ Pagamento confirmado'
      : status === 'approved'
      ? '📋 Pagamento aprovado'
      : '⏳ Pagamento pendente';

    const amount = payment.net_amount || 0;
    const message = status === 'paid'
      ? `Pagamento da semana ${payment.period_label} - €${amount.toFixed(2)} transferido`
      : `Pagamento da semana ${payment.period_label} - €${amount.toFixed(2)}`;

    // Create notification for driver
    await base44.asServiceRole.entities.Notification.create({
      user_id: driverUser.id,
      user_email: driver.email,
      title,
      message,
      type: status === 'paid' ? 'payment_confirmed' : 'payment_pending',
      related_entity_type: 'payment',
      related_entity_id: paymentId,
      email_sent: false,
    });

    // Notify admins
    const adminUsers = users.filter(u => u.role === 'admin');
    for (const admin of adminUsers) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: admin.id,
        user_email: admin.email,
        title: `${status === 'paid' ? '✅' : '📋'} Pagamento ${status} - ${driver.full_name}`,
        message: `Semana ${payment.period_label} - €${amount.toFixed(2)}`,
        type: 'payment_confirmed',
        related_entity_type: 'payment',
        related_entity_id: paymentId,
        email_sent: false,
      });
    }

    // Send emails
    const newNotifs = await base44.asServiceRole.entities.Notification.filter({ email_sent: false, related_entity_id: paymentId });
    for (const notif of newNotifs) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: notif.user_email,
        subject: notif.title,
        body: notif.message,
      });
      await base44.asServiceRole.entities.Notification.update(notif.id, { email_sent: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});