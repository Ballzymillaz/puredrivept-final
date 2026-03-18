import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'fleet_manager' && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Fleet Manager or Admin only' }, { status: 403 });
    }

    const input = await req.json();
    const { full_name, email, phone, contract_type, iban } = input;

    if (!full_name || !email || !phone) {
      return Response.json({ error: 'full_name, email, phone sont requis' }, { status: 400 });
    }

    // Récupérer le fleet_manager depuis la base (ne jamais accepter fleet_id du front)
    let fleetManagerRecord = null;
    let fleetId = null;

    if (user.role === 'fleet_manager') {
      const managers = await base44.asServiceRole.entities.FleetManager.filter({ email: user.email });
      if (!managers || managers.length === 0) {
        return Response.json({ error: 'Fleet Manager introuvable pour cet utilisateur' }, { status: 404 });
      }
      fleetManagerRecord = managers[0];
      // Trouver la fleet associée
      const fleets = await base44.asServiceRole.entities.Fleet.filter({ fleet_manager_id: fleetManagerRecord.id });
      if (fleets && fleets.length > 0) {
        fleetId = fleets[0].id;
      }
    } else if (user.role === 'admin' && input.fleet_manager_id) {
      fleetManagerRecord = await base44.asServiceRole.entities.FleetManager.get(input.fleet_manager_id);
      if (fleetManagerRecord) {
        const fleets = await base44.asServiceRole.entities.Fleet.filter({ fleet_manager_id: fleetManagerRecord.id });
        if (fleets && fleets.length > 0) fleetId = fleets[0].id;
      }
    }

    // Vérifier email unique dans users
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers && existingUsers.length > 0) {
      return Response.json({ error: 'Un utilisateur avec cet email existe déjà' }, { status: 409 });
    }

    const temporaryPassword = generatePassword(14);

    // Créer le Driver en premier
    const driverData = {
      full_name,
      email,
      phone,
      status: 'active',
      ...(contract_type && { contract_type }),
      ...(iban && { iban }),
      ...(fleetManagerRecord && {
        fleet_manager_id: fleetManagerRecord.id,
        fleet_manager_name: fleetManagerRecord.full_name,
      }),
      ...(fleetId && { fleet_id: fleetId }),
    };

    const newDriver = await base44.asServiceRole.entities.Driver.create(driverData);

    // Créer le User système
    const newUser = await base44.asServiceRole.entities.User.create({
      email,
      full_name,
      role: 'driver',
      linked_entity_id: newDriver.id,
      is_active: true,
      must_change_password: true,
      password: temporaryPassword,
    });

    // Mettre à jour driver.user_id
    await base44.asServiceRole.entities.Driver.update(newDriver.id, { user_id: newUser.id });

    return Response.json({
      success: true,
      driver_id: newDriver.id,
      user_id: newUser.id,
      email,
      temporary_password: temporaryPassword,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});