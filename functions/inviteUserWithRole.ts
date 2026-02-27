import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can invite users
    if (!user || !user.role?.includes('admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email || !role) {
      return Response.json({ error: 'Email and role are required' }, { status: 400 });
    }

    // Valid roles - never 'user'
    const VALID_ROLES = ['admin', 'driver', 'fleet_manager'];
    if (!VALID_ROLES.includes(role)) {
      return Response.json({ 
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers.length > 0) {
      // User exists, update role
      const userId = existingUsers[0].id;
      await base44.asServiceRole.entities.User.update(userId, { role });
      return Response.json({ 
        success: true, 
        message: 'User role updated',
        email, 
        role,
        userId 
      });
    }

    // Invite new user with the specified role
    try {
      await base44.users.inviteUser(email, role);
      return Response.json({ 
        success: true, 
        message: `Invitation sent to ${email} with role: ${role}`,
        email, 
        role 
      });
    } catch (inviteError) {
      console.error('Invite error:', inviteError);
      return Response.json({ 
        error: `Failed to invite user: ${inviteError.message}` 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in inviteUserWithRole:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});