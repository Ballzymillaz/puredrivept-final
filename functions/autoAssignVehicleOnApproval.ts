import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || !event.entity_id) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const onboardingId = event.entity_id;
    const onboarding = data;

    // Check if both documents_status and background_check_status are approved
    if (onboarding.documents_status !== 'approved' || onboarding.background_check_status !== 'approved') {
      return Response.json({ success: true, message: 'Not ready for vehicle assignment' });
    }

    // Check if vehicle already assigned
    if (onboarding.vehicle_assignment_status === 'assigned' || onboarding.assigned_vehicle_id) {
      return Response.json({ success: true, message: 'Vehicle already assigned' });
    }

    // Get available vehicles (status = 'available' or 'alugado')
    const vehicles = await base44.asServiceRole.entities.Vehicle.filter({ status: 'available' });

    if (vehicles.length === 0) {
      // Notify admin that no vehicles are available
      await base44.asServiceRole.entities.Notification.create({
        title: `⚠️ Sem veículos disponíveis — ${onboarding.driver_name}`,
        message: `O motorista ${onboarding.driver_name} completou a verificação de documentos e antecedentes, mas não há veículos disponíveis para atribuição.`,
        type: 'alert',
        category: 'vehicle',
        recipient_role: 'admin',
        related_entity: onboardingId,
        sent_email: false,
      });

      return Response.json({
        success: true,
        message: 'No vehicles available',
        assigned: false,
      });
    }

    // Assign the first available vehicle
    const vehicle = vehicles[0];

    // Update vehicle
    await base44.asServiceRole.entities.Vehicle.update(vehicle.id, {
      assigned_driver_id: onboarding.driver_id,
      assigned_driver_name: onboarding.driver_name,
      status: 'assigned',
    });

    // Update onboarding
    const vehicleInfo = `${vehicle.brand} ${vehicle.model} - ${vehicle.license_plate}`;
    await base44.asServiceRole.entities.DriverOnboarding.update(onboardingId, {
      assigned_vehicle_id: vehicle.id,
      assigned_vehicle_info: vehicleInfo,
      vehicle_assignment_status: 'assigned',
      current_step: 'completed',
      status: 'completed',
      completed_date: new Date().toISOString().split('T')[0],
    });

    // Update driver
    if (onboarding.driver_id) {
      await base44.asServiceRole.entities.Driver.update(onboarding.driver_id, {
        assigned_vehicle_id: vehicle.id,
        assigned_vehicle_plate: vehicle.license_plate,
        status: 'active',
      });
    }

    // Notify admin
    await base44.asServiceRole.entities.Notification.create({
      title: `🚗 Veículo atribuído automaticamente — ${onboarding.driver_name}`,
      message: `O motorista ${onboarding.driver_name} foi automaticamente atribuído ao veículo ${vehicleInfo}.`,
      type: 'success',
      category: 'vehicle',
      recipient_role: 'admin',
      related_entity: onboardingId,
      sent_email: false,
    });

    // Notify driver
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: onboarding.driver_email,
      subject: '🚗 Veículo Atribuído — Onboarding Completo',
      body: `
        <html>
          <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
              <h2 style="color:#4f46e5">Parabéns, ${onboarding.driver_name}!</h2>
              <p style="color:#374151;line-height:1.6">
                O seu onboarding foi concluído com sucesso! Fomos-lhe automaticamente atribuído um veículo:
              </p>
              <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #4f46e5">
                <p style="margin:0;color:#374151;font-weight:bold">${vehicleInfo}</p>
              </div>
              <p style="color:#6b7280">Pode agora começar as suas atividades. Aceda à plataforma para mais detalhes.</p>
              <p style="color:#9ca3af;font-size:12px;margin-top:24px">Bem-vindo à PureDrivePT!</p>
            </div>
          </body>
        </html>
      `,
    });

    return Response.json({
      success: true,
      assigned: true,
      vehicleId: vehicle.id,
      vehicleInfo,
    });
  } catch (error) {
    console.error('Error in autoAssignVehicle:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});