import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.role?.includes('admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { targetUserId, targetEmail, targetName, newRoles } = await req.json();
    const roles = Array.isArray(newRoles) ? newRoles : [];

    // Handle fleet_manager
    if (roles.includes('fleet_manager')) {
      const existing = await base44.asServiceRole.entities.FleetManager.filter({ email: targetEmail });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.FleetManager.create({
          full_name: targetName || targetEmail,
          email: targetEmail,
          status: 'active',
          user_id: targetUserId,
        });
      } else {
        await base44.asServiceRole.entities.FleetManager.update(existing[0].id, { user_id: targetUserId, status: 'active' });
      }
    }

// Handle driver
    if (roles.includes('driver')) {
      const existing = await base44.asServiceRole.entities.Driver.filter({ email: targetEmail });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.Driver.create({
          full_name: targetName || targetEmail,
          email: targetEmail,
          status: 'pending',
        });
      } else {
        await base44.asServiceRole.entities.Driver.update(existing[0].id, { user_id: targetUserId });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});