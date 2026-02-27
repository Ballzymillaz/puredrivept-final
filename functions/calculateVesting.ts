import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { driverId } = await req.json();
    
    if (!driverId) {
      return Response.json({ error: 'Missing driverId' }, { status: 400 });
    }

    // Fetch driver
    const drivers = await base44.entities.Drivers.filter({ id: driverId });
    if (!drivers || drivers.length === 0) {
      return Response.json({ error: 'Driver not found' }, { status: 404 });
    }

    const driver = drivers[0];
    const entryDate = new Date(driver.entry_date);
    const today = new Date();
    const monthsOfTenure = (today.getFullYear() - entryDate.getFullYear()) * 12 + (today.getMonth() - entryDate.getMonth());

    // Calculate vesting percentage based on tenure
    let vestingPercentage = 0;
    if (monthsOfTenure < 12) {
      vestingPercentage = 0; // Locked
    } else if (monthsOfTenure < 24) {
      vestingPercentage = 25;
    } else if (monthsOfTenure < 36) {
      vestingPercentage = 50;
    } else if (monthsOfTenure < 48) {
      vestingPercentage = 75;
    } else {
      vestingPercentage = 100;
    }

    // Update vesting record
    const vestings = await base44.entities.UPIVesting.filter({ driver_id: driverId });
    if (vestings && vestings.length > 0) {
      const vesting = vestings[0];
      await base44.entities.UPIVesting.update(vesting.id, {
        vesting_percentage: vestingPercentage,
        last_calculated_date: today.toISOString().split('T')[0],
      });
    }

    return Response.json({
      success: true,
      driverId,
      monthsOfTenure,
      vestingPercentage,
    });
  } catch (error) {
    console.error('Error calculating vesting:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});