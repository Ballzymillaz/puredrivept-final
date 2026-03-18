import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADMIN: all drivers
    if (user.role === 'admin') {
      const drivers = await base44.asServiceRole.entities.Driver.list();
      return Response.json({ drivers });
    }

    // FLEET MANAGER: drivers from their fleets
    if (user.role === 'fleet_manager') {
      const fleets = await base44.asServiceRole.entities.Fleet.filter({ fleet_manager_id: user.id });
      const fleetIds = fleets.map(f => f.id);
      
      if (fleetIds.length === 0) {
        return Response.json({ drivers: [] });
      }

      const drivers = await base44.asServiceRole.entities.Driver.filter({ fleet_id: { $in: fleetIds } });
      return Response.json({ drivers });
    }

    // DRIVER: forbidden
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});