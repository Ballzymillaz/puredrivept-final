import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function generatePassword(length = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const input = await req.json();
    const { full_name, email, phone, fleet_name } = input;

    if (!full_name || !email || !phone) {
      return Response.json({ error: 'full_name, email, phone sont requis' }, { status: 400 });
    }

    // Vérifier email unique
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers && existingUsers.length > 0) {
      return Response.json({ error: 'Un utilisateur avec cet email existe déjà' }, { status: 409 });
    }

    const temporaryPassword = generatePassword(14);
    const finalFleetName = fleet_name || `Frota ${full_name}`;

    // Créer la Fleet en premier
    const newFleet = await base44.asServiceRole.entities.Fleet.create({
      name: finalFleetName,
      status: 'active',
    });

    // Créer le Fleet Manager lié à cette Fleet
    const newFleetManager = await base44.asServiceRole.entities.FleetManager.create({
      full_name,
      email,
      phone: phone || '',
      fleet_id: newFleet.id,
      status: 'active',
      referral_code: `FM-${Date.now().toString(36).toUpperCase()}`,
    });

    // Mettre à jour la Fleet avec le fleet_manager_id
    await base44.asServiceRole.entities.Fleet.update(newFleet.id, {
      fleet_manager_id: newFleetManager.id,
    });

    // Créer le User système
    const newUser = await base44.asServiceRole.entities.User.create({
      email,
      full_name,
      role: 'fleet_manager',
      linked_entity_id: newFleetManager.id,
      is_active: true,
      must_change_password: true,
      password: temporaryPassword,
    });

    // Mettre à jour fleet_manager.user_id
    await base44.asServiceRole.entities.FleetManager.update(newFleetManager.id, {
      user_id: newUser.id,
    });

    return Response.json({
      success: true,
      fleet_id: newFleet.id,
      fleet_name: finalFleetName,
      fleet_manager_id: newFleetManager.id,
      user_id: newUser.id,
      email,
      temporary_password: temporaryPassword,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});