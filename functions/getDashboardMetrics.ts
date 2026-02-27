import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current date and calculate 4-week window
    const today = new Date();
    const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    const eightWeeksAgo = new Date(today.getTime() - 56 * 24 * 60 * 60 * 1000);

    // Fetch all necessary data
    const [payments, drivers, vehicles, upiTransactions] = await Promise.all([
      base44.asServiceRole.entities.WeeklyPayment.list('-week_start', 200),
      base44.asServiceRole.entities.Driver.list(),
      base44.asServiceRole.entities.Vehicle.list(),
      base44.asServiceRole.entities.UPITransaction.list('-created_date', 500),
    ]);

    // === BLOC 1: Performance 4 Semaines ===
    const paymentsLast4Weeks = payments.filter(p => {
      const paymentDate = new Date(p.week_start);
      return paymentDate >= fourWeeksAgo && paymentDate <= today;
    });

    const paymentsLast4to8Weeks = payments.filter(p => {
      const paymentDate = new Date(p.week_start);
      return paymentDate >= eightWeeksAgo && paymentDate < fourWeeksAgo;
    });

    const totalGrossLast4 = paymentsLast4Weeks.reduce((s, p) => s + (p.total_gross || 0), 0);
    const totalGrossLast4to8 = paymentsLast4to8Weeks.reduce((s, p) => s + (p.total_gross || 0), 0);

    const avgFleetRevenue4Weeks = paymentsLast4Weeks.length > 0 
      ? totalGrossLast4 / 4 
      : 0;

    const avgFleetRevenueLastPeriod = paymentsLast4to8Weeks.length > 0
      ? totalGrossLast4to8 / 4
      : 0;

    const revenueVariation = avgFleetRevenueLastPeriod > 0
      ? ((avgFleetRevenue4Weeks - avgFleetRevenueLastPeriod) / avgFleetRevenueLastPeriod) * 100
      : 0;

    // Driver count with payments in last 4 weeks
    const activeDriversLast4 = new Set(paymentsLast4Weeks.map(p => p.driver_id)).size;
    const avgRevenuePerDriver = activeDriversLast4 > 0
      ? totalGrossLast4 / activeDriversLast4
      : 0;

    // Average occupancy (drivers with payments / total active drivers)
    const activeDrivers = drivers.filter(d => d.status === 'active');
    const occupancyRate = activeDrivers.length > 0
      ? (activeDriversLast4 / activeDrivers.length) * 100
      : 0;

    // === BLOC 2: Ranking de Consistência ===
    const driverRevenueMap = {};
    paymentsLast4Weeks.forEach(p => {
      if (!driverRevenueMap[p.driver_id]) {
        driverRevenueMap[p.driver_id] = {
          name: p.driver_name,
          totalRevenue: 0,
          weekCount: 0,
        };
      }
      driverRevenueMap[p.driver_id].totalRevenue += p.total_gross || 0;
      driverRevenueMap[p.driver_id].weekCount += 1;
    });

    const ranking = Object.values(driverRevenueMap)
      .map(d => ({
        name: d.name,
        avgRevenue: d.weekCount > 0 ? d.totalRevenue / d.weekCount : 0,
      }))
      .sort((a, b) => b.avgRevenue - a.avgRevenue)
      .slice(0, 5);

    // === BLOC 3: UPI System ===
    const upiTransactionsLast4 = upiTransactions.filter(t => {
      const txDate = new Date(t.created_date);
      return txDate >= fourWeeksAgo && txDate <= today;
    });

    const totalUPIEarned = paymentsLast4Weeks.reduce((s, p) => s + (p.upi_earned || 0), 0);
    const driverWithUPI = new Set(upiTransactions.map(t => t.driver_id)).size;

    // Mock UPI price (in a real system this would come from a price feed)
    const upiPrice = 0.95; // Mock: 0.95€ per UPI
    const lastUPIPriceChange = 2.5; // Mock: +2.5% growth

    // === BLOC 4: Croissance Structurelle ===
    const activeVehicles = vehicles.filter(v => v.status === 'assigned').length;
    const totalVehicles = vehicles.length;

    // Count new drivers this month
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const newDriversThisMonth = drivers.filter(d => {
      const startDate = d.start_date ? new Date(d.start_date) : null;
      return startDate && startDate >= thisMonth && startDate <= today && d.status === 'active';
    }).length;

    // Count new vehicles this month
    const newVehiclesThisMonth = vehicles.filter(v => {
      const createdDate = v.created_date ? new Date(v.created_date) : null;
      return createdDate && createdDate >= thisMonth && createdDate <= today && v.status === 'assigned';
    }).length;

    const totalWeeksProcessed = payments.length;

    return Response.json({
      performance: {
        avgFleetRevenueWeekly: avgFleetRevenue4Weeks,
        avgRevenuePerDriver,
        occupancyRate: Math.round(occupancyRate),
        revenueVariation: parseFloat(revenueVariation.toFixed(2)),
      },
      ranking,
      upi: {
        totalEarned: totalUPIEarned,
        price: upiPrice,
        growthPercent: lastUPIPriceChange,
        activeDrivers: driverWithUPI,
      },
      growth: {
        activeVehicles,
        totalVehicles,
        newDriversThisMonth,
        newVehiclesThisMonth,
        totalWeeksProcessed,
      },
    });
  } catch (error) {
    console.error('Error calculating dashboard metrics:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});