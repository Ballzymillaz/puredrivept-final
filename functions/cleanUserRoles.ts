import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const users = await base44.asServiceRole.entities.User.list(null, 1000);
    
    let cleaned = 0;
    const updates = [];

    for (const u of users) {
      if (!u.role) continue;
      
      const roles = u.role.split(',').map(r => r.trim()).filter(r => r && r !== 'user');
      
      if (roles.length === 0) {
        // Remove role entirely if only 'user' existed
        updates.push(
          base44.asServiceRole.entities.User.update(u.id, { role: '' })
            .then(() => { cleaned++; })
            .catch(() => {})
        );
      } else if (roles.length !== u.role.split(',').length) {
        // Update if 'user' was removed
        const newRole = roles.join(',');
        updates.push(
          base44.asServiceRole.entities.User.update(u.id, { role: newRole })
            .then(() => { cleaned++; })
            .catch(() => {})
        );
      }
    }

    await Promise.all(updates);
    
    return Response.json({ 
      success: true, 
      message: `Removed 'user' role from ${cleaned} user(s)`,
      cleaned 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});