import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const { vehicleId, oldStatus, newStatus } = await req.json();
    const base44 = createClientFromRequest(req);

    const vehicle = await base44.asServiceRole.entities.Vehicle.get(vehicleId);
    const drivers = await base44.asServiceRole.entities.Driver.list();
    const users = await base44.asServiceRole.entities.User.list();

    const statusLabels = {
      available: 'Disponível',
      assigned: 'Atribuído',
      alugado: 'Alugado',
      maintenance: 'Manutenção',
      inactive: 'Inativo',
    };

    const title = `🚗 ${vehicle.brand} ${vehicle.model} - ${statusLabels[newStatus]}`;
    const message = `Status alterado de ${statusLabels[oldStatus]} para ${statusLabels[newStatus]}`;

    // Notify assigned driver
    if (vehicle.assigned_driver_id) {
      const driver = drivers.find(d => d.id === vehicle.assigned_driver_id);
      const driverUser = users.find(u => u.email === driver.email);
      
      if (driverUser) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: driverUser.id,
          user_email: driver.email,
          title,
          message: `O seu veículo ${statusLabels[newStatus] === 'Manutenção' ? 'está em manutenção' : 'tem novo status'}`,
          type: 'vehicle_status',
          related_entity_type: 'vehicle',
          related_entity_id: vehicleId,
          email_sent: false,
        });
      }
    }

    // Notify admins
    const adminUsers = users.filter(u => u.role === 'admin');
    for (const admin of adminUsers) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: admin.id,
        user_email: admin.email,
        title,
        message,
        type: 'vehicle_status',
        related_entity_type: 'vehicle',
        related_entity_id: vehicleId,
        email_sent: false,
      });
    }

    // Send emails
    const newNotifs = await base44.asServiceRole.entities.Notification.filter({ email_sent: false, related_entity_id: vehicleId });
    for (const notif of newNotifs) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: notif.user_email,
        subject: title,
        body: message,
      });
      await base44.asServiceRole.entities.Notification.update(notif.id, { email_sent: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});