import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { subYears } from 'npm:date-fns@3.0.0';

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

    // Get last 12 months of revenue
    const today = new Date();
    const oneYearAgo = subYears(today, 1);

    const revenues = await base44.asServiceRole.entities.WeeklyRevenues.filter({ driver_id: driverId });
    
    // Filter revenues from last 12 months
    const lastYearRevenues = revenues.filter(r => {
      const weekStart = new Date(r.week_start_date);
      return weekStart >= oneYearAgo && weekStart <= today;
    });

    // Sum Uber + Bolt revenues (excluding other_revenue)
    const totalAnnualRevenue = lastYearRevenues.reduce((sum, r) => {
      return sum + ((r.uber_revenue || 0) + (r.bolt_revenue || 0));
    }, 0);

    return Response.json({
      success: true,
      driverId,
      driver_annual_revenue: totalAnnualRevenue.toFixed(2),
      weeksIncluded: lastYearRevenues.length
    });
  } catch (error) {
    console.error('Error calculating driver annual revenue:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});