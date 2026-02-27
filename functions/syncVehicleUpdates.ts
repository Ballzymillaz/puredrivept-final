import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Webhook/automation calls: verify via service role only
    if (!user && req.headers.get('Authorization') === undefined) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, data } = await req.json();

    if (!data || !event.entity_id) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const vehicleId = event.entity_id;
    const vehicle = data;
    const vehicleInfo = `${vehicle.brand} ${vehicle.model} - ${vehicle.license_plate}`;

    // Update contracts
    const contracts = await base44.asServiceRole.entities.Contract.filter({ vehicle_id: vehicleId });
    for (const contract of contracts) {
      await base44.asServiceRole.entities.Contract.update(contract.id, {
        vehicle_info: vehicleInfo
      });
    }

    // Update driver assignment
    if (vehicle.assigned_driver_id) {
      await base44.asServiceRole.entities.Driver.update(vehicle.assigned_driver_id, {
        assigned_vehicle_id: vehicleId,
        assigned_vehicle_plate: vehicle.license_plate
      });
    } else {
      // If vehicle was unassigned, find the previous driver and clear their assignment
      const drivers = await base44.asServiceRole.entities.Driver.filter({ assigned_vehicle_id: vehicleId });
      for (const driver of drivers) {
        await base44.asServiceRole.entities.Driver.update(driver.id, {
          assigned_vehicle_id: null,
          assigned_vehicle_plate: null
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});