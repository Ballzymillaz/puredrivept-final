import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    if (!data || !event.entity_id) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const driver = data;
    const oldDriver = old_data || {};

    // If vehicle was assigned to this driver
    if (driver.assigned_vehicle_id) {
      await base44.asServiceRole.entities.Vehicle.update(driver.assigned_vehicle_id, {
        assigned_driver_id: driver.id,
        assigned_driver_name: driver.full_name,
        status: 'alugado'
      });
    }

    // If vehicle was un-assigned (changed or removed)
    if (oldDriver.assigned_vehicle_id && oldDriver.assigned_vehicle_id !== driver.assigned_vehicle_id) {
      await base44.asServiceRole.entities.Vehicle.update(oldDriver.assigned_vehicle_id, {
        assigned_driver_id: null,
        assigned_driver_name: null,
        status: 'available'
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});