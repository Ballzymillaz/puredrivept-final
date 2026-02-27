import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active contracts
    const contracts = await base44.asServiceRole.entities.Contract.filter({ 
      status: 'active'
    }, '-start_date', 500);

    const now = new Date();
    const notificationsCreated = [];

    for (const contract of contracts) {
      if (!contract.end_date) continue;

      const endDate = new Date(contract.end_date);
      const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

      // Alert if contract expires in less than 30 days
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 30) {
        // Notify driver
        const driverNotif = await base44.asServiceRole.entities.Notification.create({
          title: 'Contrato a vencer em breve',
          message: `O seu contrato ${contract.contract_type} com veículo ${contract.vehicle_info} expira em ${daysUntilExpiry} dias (${contract.end_date}).`,
          type: 'warning',
          category: 'general',
          recipient_email: contract.driver_id,
          related_entity: contract.id,
          sent_email: false,
        });

        // Notify fleet manager/admin
        const adminNotif = await base44.asServiceRole.entities.Notification.create({
          title: `Contrato de ${contract.driver_name} a vencer`,
          message: `O contrato de ${contract.driver_name} (${contract.contract_type}) expira em ${daysUntilExpiry} dias (${contract.end_date}). Ação necessária para renovação.`,
          type: 'warning',
          category: 'general',
          recipient_role: 'admin,fleet_manager',
          recipient_email: 'all',
          related_entity: contract.id,
          sent_email: false,
        });

        notificationsCreated.push(driverNotif.id);
      }
    }

    return Response.json({ 
      success: true, 
      notificationsCreated: notificationsCreated.length,
      contractsProcessed: contracts.length 
    });
  } catch (error) {
    console.error('Error notifying contract expiry:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});