import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { revenueId } = await req.json();
    
    if (!revenueId) {
      return Response.json({ error: 'Missing revenueId' }, { status: 400 });
    }

    // Fetch revenue record
    const revenue = await base44.entities.WeeklyRevenues.filter({ id: revenueId });
    if (!revenue || revenue.length === 0) {
      return Response.json({ error: 'Revenue not found' }, { status: 404 });
    }

    const rev = revenue[0];

    // Auto-calculate fields
    const totalRevenue = (rev.uber_revenue || 0) + (rev.bolt_revenue || 0) + (rev.other_revenue || 0);
    const upi4Percent = totalRevenue * 0.04;
    const iva6Percent = (rev.uber_revenue + rev.bolt_revenue) * 0.06;

    // Fetch vehicle for rent
    let rentDue = 0;
    if (rev.vehicle_id) {
      const vehicles = await base44.entities.Vehicles.filter({ id: rev.vehicle_id });
      if (vehicles && vehicles.length > 0) {
        rentDue = vehicles[0].weekly_rent || 0;
      }
    }

    // Calculate net payout
    const totalDeductions = (rev.loan_due || 0) + (rev.insurance || 0) + (rev.other_deductions || 0) + upi4Percent + rentDue + iva6Percent;
    const netPayout = totalRevenue - totalDeductions;

    // Update revenue
    const updatedData = {
      total_revenue: totalRevenue,
      upi_4_percent: upi4Percent,
      iva_6_percent: iva6Percent,
      rent_due: rentDue,
      net_driver_payout: netPayout,
    };

    await base44.entities.WeeklyRevenues.update(revenueId, updatedData);

    return Response.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('Error calculating weekly revenue:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});