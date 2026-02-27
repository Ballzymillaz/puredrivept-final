import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { weeklyRevenueId } = await req.json();
    
    if (!weeklyRevenueId) {
      return Response.json({ error: 'Missing weeklyRevenueId' }, { status: 400 });
    }

    // Fetch weekly revenue
    const revenues = await base44.entities.WeeklyRevenues.filter({ id: weeklyRevenueId });
    if (!revenues || revenues.length === 0) {
      return Response.json({ error: 'Revenue not found' }, { status: 404 });
    }

    const rev = revenues[0];

    // Only create accrual if revenue is validated
    if (rev.status !== 'validated') {
      return Response.json({ error: 'Revenue must be validated first' }, { status: 400 });
    }

    const upiDriver = rev.upi_4_percent || 0;
    const upiCompanyMatch = upiDriver; // Company matches driver contribution
    const upiTotal = upiDriver + upiCompanyMatch;

    // Create UPI accrual
    const accrual = await base44.entities.UPIAccruals.create({
      driver_id: rev.driver_id,
      driver_name: rev.driver_name,
      weekly_revenue_id: weeklyRevenueId,
      week_start_date: rev.week_start_date,
      upi_driver: upiDriver,
      upi_company_match: upiCompanyMatch,
      upi_total: upiTotal,
    });

    // Update UPI vesting total
    const vestings = await base44.entities.UPIVesting.filter({ driver_id: rev.driver_id });
    if (vestings && vestings.length > 0) {
      const vesting = vestings[0];
      const newTotal = (vesting.upi_total_accumulated || 0) + upiTotal;
      await base44.entities.UPIVesting.update(vesting.id, {
        upi_total_accumulated: newTotal,
      });
    } else {
      // Create new vesting record if doesn't exist
      const drivers = await base44.entities.Drivers.filter({ id: rev.driver_id });
      if (drivers && drivers.length > 0) {
        const driver = drivers[0];
        await base44.entities.UPIVesting.create({
          driver_id: rev.driver_id,
          driver_name: driver.full_name,
          upi_total_accumulated: upiTotal,
          entry_date: driver.entry_date,
        });
      }
    }

    // Create ledger entry
    await base44.entities.Ledger.create({
      date: new Date().toISOString().split('T')[0],
      city_id: rev.city_id,
      driver_id: rev.driver_id,
      type: 'upi',
      amount: upiTotal,
      description: `UPI accrual - Week ${rev.week_start_date}`,
      reference_id: weeklyRevenueId,
    });

    return Response.json({ success: true, accrual });
  } catch (error) {
    console.error('Error creating UPI accrual:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});