import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can update user roles
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email || !role) {
      return Response.json({ error: 'Email and role are required' }, { status: 400 });
    }

    // Find user by email and update role
    const users = await base44.asServiceRole.entities.User.filter({ email });
    
    if (users.length === 0) {
      return Response.json({ error: 'User not found', email }, { status: 404 });
    }

    const userId = users[0].id;
    await base44.asServiceRole.entities.User.update(userId, { role });

    return Response.json({ success: true, userId, email, role });
  } catch (error) {
    console.error('Error updating applicant role:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});