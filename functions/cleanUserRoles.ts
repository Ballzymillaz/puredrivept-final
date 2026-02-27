import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await base44.asServiceRole.entities.User.list();
    let updated = 0;

    for (const u of users) {
      if (!u.role) continue;
      const roles = u.role.split(',').map(r => r.trim()).filter(r => r && r !== 'user');
      const newRole = roles.join(',');
      if (newRole !== u.role) {
        await base44.asServiceRole.entities.User.update(u.id, { role: newRole });
        updated++;
      }
    }

    return Response.json({ success: true, updated, total: users.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});