import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { subWeeks, startOfMonth } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const fourWeeksAgo = subWeeks(now, 4);
    const eightWeeksAgo = subWeeks(now, 8);
    const monthStart = startOfMonth(now);

    // Fetch only what's needed — smaller payloads
    const [drivers, vehicles, payments] = await Promise.all([
      base44.asServiceRole.entities.Driver.list('-created_date', 100),
      base44.asServiceRole.entities.Vehicle.list('-created_date', 100),
      base44.asServiceRole.entities.WeeklyPayment.list('-week_start', 100),
    ]);

    // BLOCK 1: Performance 4 Weeks
    const last4WeeksPayments = payments.filter(p =>
      p.status === 'paid' && new Date(p.week_start) >= fourWeeksAgo
    );
    const prev4WeeksPayments = payments.filter(p =>
      p.status === 'paid' &&
      new Date(p.week_start) >= eightWeeksAgo &&
      new Date(p.week_start) < fourWeeksAgo
    );

    const fleetRevenueLast4 = last4WeeksPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    const fleetRevenueP4 = prev4WeeksPayments.reduce((s, p) => s + (p.total_gross || 0), 0);
    const avgFleetRevenue = last4WeeksPayments.length > 0 ? fleetRevenueLast4 / last4WeeksPayments.length : 0;
    const avgFleetRevenueP4 = prev4WeeksPayments.length > 0 ? fleetRevenueP4 / prev4WeeksPayments.length : 0;
    const fleetVariation = avgFleetRevenueP4 > 0 ? ((avgFleetRevenue - avgFleetRevenueP4) / avgFleetRevenueP4) * 100 : 0;

    // Avg per driver last 4 weeks
    const driverRevenueMap = {};
    last4WeeksPayments.forEach(p => {
      if (!driverRevenueMap[p.driver_id]) {
        driverRevenueMap[p.driver_id] = { total: 0, weeks: 0, name: p.driver_name };
      }
      driverRevenueMap[p.driver_id].total += p.total_gross || 0;
      driverRevenueMap[p.driver_id].weeks += 1;
    });

    const driverRevenues = Object.values(driverRevenueMap).map(d => ({
      ...d,
      avg: d.total / Math.max(d.weeks, 1),
    }));

    const avgPerDriver = driverRevenues.length > 0
      ? driverRevenues.reduce((s, d) => s + d.avg, 0) / driverRevenues.length
      : 0;

    const activeDrivers = drivers.filter(d => d.status === 'active').length;
    const activeVehicles = vehicles.filter(v => v.status === 'assigned').length;
    const occupancyRate = activeVehicles > 0 ? (activeDrivers / activeVehicles) * 100 : 0;

    // BLOCK 2: Ranking Consistency (Top 5)
    const rankingData = driverRevenues
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map((d, i) => ({
        rank: i + 1,
        name: d.name,
        avg: d.avg,
        badge: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '',
      }));

    // BLOCK 3: UPI System
    const totalUPIAccumulated = drivers.reduce((s, d) => s + (d.upi_balance || 0), 0);
    const driversWithUPI = drivers.filter(d => d.upi_balance > 0).length;

    // BLOCK 4: Structural Growth
    const newVehiclesThisMonth = vehicles.filter(v => new Date(v.created_date) >= monthStart).length;
    const newDriversThisMonth = drivers.filter(d => new Date(d.created_date) >= monthStart).length;
    const totalWeeksProcessed = payments.filter(p => p.status === 'paid').length;

    return Response.json({
      performance4weeks: {
        fleetAvg: Math.round(avgFleetRevenue * 100) / 100,
        driverAvg: Math.round(avgPerDriver * 100) / 100,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        variation: Math.round(fleetVariation * 100) / 100,
        variationPositive: fleetVariation >= 0,
      },
      rankingConsistency: rankingData,
      upiSystem: {
        totalAccumulated: Math.round(totalUPIAccumulated * 100) / 100,
        lastPrice: 0,
        driversActive: driversWithUPI,
        growth: 0,
        growthPositive: true,
      },
      structuralGrowth: {
        activeVehicles: activeVehicles,
        newVehiclesMonth: newVehiclesThisMonth,
        newDriversMonth: newDriversThisMonth,
        totalWeeksProcessed: totalWeeksProcessed,
      },
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});