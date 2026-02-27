import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.role?.includes('admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { driver_id, vehicle_id } = await req.json();

    // Get driver
    const driver = await base44.asServiceRole.entities.Driver.get(driver_id);
    if (!driver) return Response.json({ error: 'Motorista não encontrado' }, { status: 404 });

    let vehicleToAssign = null;

    if (vehicle_id) {
      // Specific vehicle requested
      vehicleToAssign = await base44.asServiceRole.entities.Vehicle.get(vehicle_id);
    } else {
      // Auto-select: find available vehicle, prefer hybrid/electric for premium contracts
      const available = await base44.asServiceRole.entities.Vehicle.filter({ status: 'available' });
      if (available.length === 0) {
        return Response.json({ error: 'Nenhum veículo disponível' }, { status: 400 });
      }

      // Preference logic: slot_black/slot_premium → prefer hybrid/electric
      const preferred = ['slot_black', 'slot_premium'].includes(driver.contract_type)
        ? available.filter(v => ['hybrid', 'electric'].includes(v.fuel_type))
        : [];

      vehicleToAssign = preferred.length > 0 ? preferred[0] : available[0];
    }

    if (!vehicleToAssign) return Response.json({ error: 'Veículo não encontrado' }, { status: 404 });

    // Update driver
    await base44.asServiceRole.entities.Driver.update(driver_id, {
      assigned_vehicle_id: vehicleToAssign.id,
      assigned_vehicle_plate: vehicleToAssign.license_plate,
    });

    // Update vehicle
    await base44.asServiceRole.entities.Vehicle.update(vehicleToAssign.id, {
      assigned_driver_id: driver_id,
      assigned_driver_name: driver.full_name,
      status: 'assigned',
    });

    // Notify admin
    await base44.asServiceRole.entities.Notification.create({
      title: '🚗 Veículo atribuído automaticamente',
      message: `O veículo ${vehicleToAssign.brand} ${vehicleToAssign.model} (${vehicleToAssign.license_plate}) foi atribuído a ${driver.full_name}. Lembrete: emitir e assinar o contrato.`,
      type: 'warning',
      category: 'vehicle',
      recipient_role: 'admin',
      related_entity: driver_id,
      is_read: false,
      read_by: [],
    });

    // Notify driver (if email matches)
    if (driver.email) {
      await base44.asServiceRole.entities.Notification.create({
        title: '🚗 Veículo atribuído',
        message: `Olá ${driver.full_name}, o veículo ${vehicleToAssign.brand} ${vehicleToAssign.model} (${vehicleToAssign.license_plate}) foi atribuído a si. Um contrato será enviado em breve.`,
        type: 'info',
        category: 'vehicle',
        recipient_email: driver.email,
        related_entity: driver_id,
        is_read: false,
        read_by: [],
      });
    }

    return Response.json({ success: true, vehicle: vehicleToAssign });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});