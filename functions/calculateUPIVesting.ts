import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { driverId } = await req.json();
    
    if (!driverId) {
      return Response.json({ error: 'Missing driverId' }, { status: 400 });
    }

    // Fetch driver
    const drivers = await base44.asServiceRole.entities.Drivers.filter({ id: driverId });
    if (!drivers || drivers.length === 0) {
      return Response.json({ error: 'Driver not found' }, { status: 404 });
    }

    const driver = drivers[0];
    const entryDate = new Date(driver.entry_date);
    const today = new Date();
    const tenureMonths = (today.getFullYear() - entryDate.getFullYear()) * 12 + (today.getMonth() - entryDate.getMonth());

    // Calculate vesting percentage based on tenure
    let vestingPercentage = 0;
    if (tenureMonths < 12) {
      vestingPercentage = 0;
    } else if (tenureMonths < 24) {
      vestingPercentage = 0.25;
    } else if (tenureMonths < 36) {
      vestingPercentage = 0.50;
    } else if (tenureMonths < 48) {
      vestingPercentage = 0.75;
    } else {
      vestingPercentage = 1.00;
    }

    // Check if driver has exited early
    if (driver.exit_date && tenureMonths < 12) {
      const upiAccruals = await base44.asServiceRole.entities.UPIAccruals.filter({ driver_id: driverId });
      for (const accrual of upiAccruals) {
        await base44.asServiceRole.entities.UPIAccruals.delete(accrual.id);
      }
      
      return Response.json({
        success: true,
        driverId,
        tenureMonths,
        vestingPercentage: 0,
        upiVested: 0,
        upiLocked: 0,
        message: 'Driver exited early - all UPI accruals deleted'
      });
    }

    // Calculate total UPI
    const upiAccruals = await base44.asServiceRole.entities.UPIAccruals.filter({ driver_id: driverId });
    const totalUpi = upiAccruals.reduce((sum, a) => sum + (a.upi_total || 0), 0);
    
    const upiVested = totalUpi * vestingPercentage;
    const upiLocked = totalUpi - upiVested;

    // Update or create vesting record
    const vestings = await base44.asServiceRole.entities.UPIVesting.filter({ driver_id: driverId });
    
    const vestingData = {
      driver_id: driverId,
      driver_name: driver.full_name,
      upi_total_accumulated: totalUpi,
      vesting_percentage: vestingPercentage,
      entry_date: driver.entry_date,
      last_calculated_date: today.toISOString().split('T')[0]
    };

    if (vestings && vestings.length > 0) {
      await base44.asServiceRole.entities.UPIVesting.update(vestings[0].id, vestingData);
    } else {
      await base44.asServiceRole.entities.UPIVesting.create(vestingData);
    }

    return Response.json({
      success: true,
      driverId,
      tenureMonths,
      vestingPercentage,
      totalUpi: totalUpi.toFixed(2),
      upiVested: upiVested.toFixed(2),
      upiLocked: upiLocked.toFixed(2)
    });
  } catch (error) {
    console.error('Error calculating vesting:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});