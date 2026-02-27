import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pageName } = await req.json();

    // Admins always have access
    if (user.role === 'admin') {
      return Response.json({ hasAccess: true });
    }

    // Get permissions using service role to avoid 401 errors
    const perms = await base44.asServiceRole.entities.RolePermission.filter({
      role: user.role,
      page: pageName
    });

    // If any permission with access_level='none', deny access
    const denied = perms.some(p => p.access_level === 'none');
    
    return Response.json({ hasAccess: !denied });
  } catch (error) {
    console.error('Error checking access:', error);
    // Default: allow access if service check fails
    return Response.json({ hasAccess: true });
  }
});