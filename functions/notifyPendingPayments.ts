import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.role?.includes('admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get pending/overdue payments
    const payments = await base44.asServiceRole.entities.WeeklyPayment.filter({ 
      status: { $in: ['draft', 'processing'] }
    }, '-week_end', 100);

    const now = new Date();
    const notificationsCreated = [];

    for (const payment of payments) {
      // Check if payment is overdue (more than 3 days past week end)
      const weekEnd = new Date(payment.week_end);
      const daysSinceWeekEnd = Math.floor((now - weekEnd) / (1000 * 60 * 60 * 24));

      if (daysSinceWeekEnd > 3) {
        // Notify driver about overdue payment
        const driverNotif = await base44.asServiceRole.entities.Notification.create({
          title: 'Pagamento em atraso',
          message: `Seu pagamento da semana de ${payment.week_start} a ${payment.week_end} (€${payment.net_amount?.toFixed(2) || 0}) está pendente há ${daysSinceWeekEnd} dias.`,
          type: 'alert',
          category: 'payment',
          recipient_email: payment.driver_id,
          related_entity: payment.driver_id,
          sent_email: false,
        });

        // Notify fleet manager or admin about overdue payment
        const adminNotif = await base44.asServiceRole.entities.Notification.create({
          title: `Pagamento em atraso - ${payment.driver_name}`,
          message: `${payment.driver_name} tem um pagamento pendente há ${daysSinceWeekEnd} dias: €${payment.net_amount?.toFixed(2) || 0}`,
          type: 'alert',
          category: 'payment',
          recipient_role: 'admin,fleet_manager',
          recipient_email: 'all',
          related_entity: payment.driver_id,
          sent_email: false,
        });

        notificationsCreated.push(driverNotif.id);
      } else if (daysSinceWeekEnd > 0) {
        // Notify admin about pending payment
        const adminNotif = await base44.asServiceRole.entities.Notification.create({
          title: `Pagamento pendente - ${payment.driver_name}`,
          message: `${payment.driver_name} tem um pagamento pendente desde ${payment.week_end}: €${payment.net_amount?.toFixed(2) || 0}`,
          type: 'info',
          category: 'payment',
          recipient_role: 'admin',
          recipient_email: 'all',
          related_entity: payment.driver_id,
          sent_email: false,
        });

        notificationsCreated.push(adminNotif.id);
      }
    }

    return Response.json({ 
      success: true, 
      notificationsCreated: notificationsCreated.length,
      paymentsProcessed: payments.length 
    });
  } catch (error) {
    console.error('Error notifying pending payments:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});