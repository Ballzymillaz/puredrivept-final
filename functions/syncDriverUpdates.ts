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

    const driverId = event.entity_id;
    const driver = data;

    // Update contracts
    const contracts = await base44.asServiceRole.entities.Contract.filter({ driver_id: driverId });
    for (const contract of contracts) {
      await base44.asServiceRole.entities.Contract.update(contract.id, {
        driver_name: driver.full_name
      });
    }

    // Update payments
    const payments = await base44.asServiceRole.entities.WeeklyPayment.filter({ driver_id: driverId });
    for (const payment of payments) {
      await base44.asServiceRole.entities.WeeklyPayment.update(payment.id, {
        driver_name: driver.full_name
      });
    }

// Update fleet manager's total_drivers count
    if (driver.fleet_manager_id) {
      const drivers = await base44.asServiceRole.entities.Driver.filter({ fleet_manager_id: driver.fleet_manager_id });
      await base44.asServiceRole.entities.FleetManager.update(driver.fleet_manager_id, {
        total_drivers: drivers.length
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});