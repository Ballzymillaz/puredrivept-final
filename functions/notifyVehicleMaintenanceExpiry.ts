import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all vehicles with inspection or insurance dates
    const allVehicles = await base44.asServiceRole.entities.Vehicle.list();
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const notifications = [];

    for (const vehicle of allVehicles) {
      // Get assigned driver info
      const driver = vehicle.assigned_driver_id 
        ? (await base44.asServiceRole.entities.Driver.filter({ id: vehicle.assigned_driver_id }))?.[0] 
        : null;

      // Check insurance expiry
      if (vehicle.insurance_expiry) {
        const expiryDate = new Date(vehicle.insurance_expiry);
        const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          // Expired insurance
          if (driver) {
            await base44.asServiceRole.entities.Notification.create({
              title: '⛔ Seguro do Veículo Expirado',
              message: `O seguro do veículo ${vehicle.brand} ${vehicle.model} (${vehicle.license_plate}) expirou. Contacte o gestor para renovação.`,
              type: 'alert',
              category: 'vehicle',
              recipient_email: driver.email,
              related_entity: vehicle.id,
              sent_email: false,
            });
          }

          await base44.asServiceRole.entities.Notification.create({
            title: `⛔ Seguro Expirado — ${vehicle.license_plate}`,
            message: `Seguro do veículo expirou em ${expiryDate.toLocaleDateString('pt-PT')}. Ação imediata necessária.`,
            type: 'alert',
            category: 'vehicle',
            recipient_role: 'admin',
            related_entity: vehicle.id,
            sent_email: false,
          });

          notifications.push({ vehicle_id: vehicle.id, plate: vehicle.license_plate, type: 'insurance_expired' });
        } else if (daysUntilExpiry <= 30) {
          // Insurance expiring soon
          if (driver) {
            await base44.asServiceRole.entities.Notification.create({
              title: '⚠️ Seguro do Veículo a Expirar',
              message: `O seguro do veículo ${vehicle.brand} ${vehicle.model} expirará em ${daysUntilExpiry} dias (${expiryDate.toLocaleDateString('pt-PT')}).`,
              type: 'warning',
              category: 'vehicle',
              recipient_email: driver.email,
              related_entity: vehicle.id,
              sent_email: false,
            });
          }

          await base44.asServiceRole.entities.Notification.create({
            title: `⚠️ Seguro a Expirar — ${vehicle.license_plate}`,
            message: `Seguro expira em ${daysUntilExpiry} dias (${expiryDate.toLocaleDateString('pt-PT')}).`,
            type: 'warning',
            category: 'vehicle',
            recipient_role: 'admin',
            related_entity: vehicle.id,
            sent_email: false,
          });

          notifications.push({ vehicle_id: vehicle.id, plate: vehicle.license_plate, type: 'insurance_expiring_soon', days_left: daysUntilExpiry });
        }
      }

      // Check inspection expiry
      if (vehicle.inspection_expiry) {
        const expiryDate = new Date(vehicle.inspection_expiry);
        const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          // Expired inspection
          if (driver) {
            await base44.asServiceRole.entities.Notification.create({
              title: '⛔ Inspeção do Veículo Expirada',
              message: `A inspeção do veículo ${vehicle.brand} ${vehicle.model} (${vehicle.license_plate}) expirou. O veículo não pode ser utilizado.`,
              type: 'alert',
              category: 'vehicle',
              recipient_email: driver.email,
              related_entity: vehicle.id,
              sent_email: false,
            });
          }

          await base44.asServiceRole.entities.Notification.create({
            title: `⛔ Inspeção Expirada — ${vehicle.license_plate}`,
            message: `Inspeção do veículo expirou em ${expiryDate.toLocaleDateString('pt-PT')}. Veículo inativo.`,
            type: 'alert',
            category: 'vehicle',
            recipient_role: 'admin',
            related_entity: vehicle.id,
            sent_email: false,
          });

          // Auto-set vehicle to maintenance status
          await base44.asServiceRole.entities.Vehicle.update(vehicle.id, { status: 'maintenance' });

          notifications.push({ vehicle_id: vehicle.id, plate: vehicle.license_plate, type: 'inspection_expired' });
        } else if (daysUntilExpiry <= 30) {
          // Inspection expiring soon
          if (driver) {
            await base44.asServiceRole.entities.Notification.create({
              title: '⚠️ Inspeção do Veículo a Vencer',
              message: `A inspeção do veículo ${vehicle.brand} ${vehicle.model} vencerá em ${daysUntilExpiry} dias (${expiryDate.toLocaleDateString('pt-PT')}).`,
              type: 'warning',
              category: 'vehicle',
              recipient_email: driver.email,
              related_entity: vehicle.id,
              sent_email: false,
            });
          }

          await base44.asServiceRole.entities.Notification.create({
            title: `⚠️ Inspeção a Vencer — ${vehicle.license_plate}`,
            message: `Inspeção vence em ${daysUntilExpiry} dias (${expiryDate.toLocaleDateString('pt-PT')}).`,
            type: 'warning',
            category: 'vehicle',
            recipient_role: 'admin',
            related_entity: vehicle.id,
            sent_email: false,
          });

          notifications.push({ vehicle_id: vehicle.id, plate: vehicle.license_plate, type: 'inspection_expiring_soon', days_left: daysUntilExpiry });
        }
      }
    }

    return Response.json({
      success: true,
      notifications_created: notifications.length,
      details: notifications,
    });
  } catch (error) {
    console.error('Error in notifyVehicleMaintenanceExpiry:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});