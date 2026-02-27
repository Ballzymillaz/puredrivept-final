import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { cityId } = await req.json();
    
    if (!cityId) {
      return Response.json({ error: 'Missing cityId' }, { status: 400 });
    }

    // Fetch city data
    const cities = await base44.asServiceRole.entities.Cities.filter({ id: cityId });
    if (!cities || cities.length === 0) {
      return Response.json({ error: 'City not found' }, { status: 404 });
    }

    const city = cities[0];
    const today = new Date();
    const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    const twelveWeeksAgo = new Date(today.getTime() - 84 * 24 * 60 * 60 * 1000);

    // 1. Total vehicles & occupancy rate
    const vehicles = await base44.asServiceRole.entities.Vehicles.filter({ city_id: cityId });
    const totalVehicles = vehicles.length;
    const assignedVehicles = vehicles.filter(v => v.status === 'assigned').length;
    const occupancyRate = totalVehicles > 0 ? (assignedVehicles / totalVehicles) * 100 : 0;

    // 2. Revenue last 4 & 12 weeks
    const revenues = await base44.asServiceRole.entities.WeeklyRevenues.filter({ city_id: cityId });
    const last4WeeksRevenue = revenues.filter(r => new Date(r.week_start_date) >= fourWeeksAgo);
    const last12WeeksRevenue = revenues.filter(r => new Date(r.week_start_date) >= twelveWeeksAgo);

    const total4Weeks = last4WeeksRevenue.reduce((s, r) => s + (r.total_revenue || 0), 0);
    const total12Weeks = last12WeeksRevenue.reduce((s, r) => s + (r.total_revenue || 0), 0);
    
    const avgRevenueLast4Weeks = last4WeeksRevenue.length > 0 ? total4Weeks / last4WeeksRevenue.length : 0;
    const avgRevenueLast12Weeks = last12WeeksRevenue.length > 0 ? total12Weeks / last12WeeksRevenue.length : 0;

    // 3. Debt total
    const loans = await base44.asServiceRole.entities.Loans.filter({ city_id: cityId, status: 'active' });
    const debtTotal = loans.reduce((s, l) => s + (l.remaining_balance || 0), 0);

    // 4. Debt to EBITDA ratio
    const monthlyRentIncome = vehicles.reduce((s, v) => s + ((v.weekly_rent || 0) * 4.33), 0);
    const annualEBITDA = monthlyRentIncome * 12;
    const debtToEbitdaRatio = annualEBITDA > 0 ? debtTotal / annualEBITDA : 0;

    // 5. Loan exposure ratio
    const loanExposureRatio = monthlyRentIncome > 0 ? debtTotal / monthlyRentIncome : 0;

    // 6. UPI liquidity risk
    const buybackRounds = await base44.asServiceRole.entities.UPIBuybackRounds.filter({ status: 'open' });
    const sellRequests = await base44.asServiceRole.entities.UPISellRequests.filter({ status: 'pending' });
    
    let upiLiquidityRisk = 0;
    if (buybackRounds.length > 0 && sellRequests.length > 0) {
      const totalRequested = sellRequests.reduce((s, r) => s + (r.requested_amount || 0), 0);
      const envelopeRemaining = buybackRounds[0].envelope_remaining || 0;
      upiLiquidityRisk = totalRequested > envelopeRemaining ? 1 : 0;
    }

    // 7. Global score (weighted) - NO STORAGE
    const scoreRevenueTrend = avgRevenueLast12Weeks > 0 && ((avgRevenueLast4Weeks - avgRevenueLast12Weeks) / avgRevenueLast12Weeks) < -0.2 ? 3 : avgRevenueLast12Weeks > 0 && ((avgRevenueLast4Weeks - avgRevenueLast12Weeks) / avgRevenueLast12Weeks) < -0.1 ? 1 : 0;
    const scoreOccupancy = occupancyRate < 70 ? 3 : occupancyRate < 85 ? 1 : 0;
    const scoreDebtEbitda = debtToEbitdaRatio > 4 ? 3 : debtToEbitdaRatio > 2 ? 1 : 0;
    const scoreLoanExposure = loanExposureRatio > 0.35 ? 3 : loanExposureRatio > 0.25 ? 1 : 0;
    const scoreUpiLiquidity = upiLiquidityRisk * 2;

    const globalScore = scoreRevenueTrend + scoreOccupancy + scoreDebtEbitda + scoreLoanExposure + scoreUpiLiquidity;
    
    // Determine health status
    let healthStatus = 'Green';
    if (globalScore >= 8) {
      healthStatus = 'Red';
    } else if (globalScore >= 4) {
      healthStatus = 'Yellow';
    }

    return Response.json({
      success: true,
      cityId,
      cityName: city.name,
      timestamp: today.toISOString(),
      metrics: {
        total_vehicles: totalVehicles,
        occupancy_rate: occupancyRate.toFixed(2),
        avg_revenue_last_4_weeks: avgRevenueLast4Weeks.toFixed(2),
        avg_revenue_last_12_weeks: avgRevenueLast12Weeks.toFixed(2),
        debt_total: debtTotal.toFixed(2),
        debt_to_ebitda_ratio: debtToEbitdaRatio.toFixed(2),
        loan_exposure_ratio: loanExposureRatio.toFixed(2),
        upi_liquidity_risk: upiLiquidityRisk
      },
      scores: {
        revenue_trend: scoreRevenueTrend,
        occupancy: scoreOccupancy,
        debt_ebitda: scoreDebtEbitda,
        loan_exposure: scoreLoanExposure,
        upi_liquidity: scoreUpiLiquidity
      },
      global_score: globalScore,
      health_status: healthStatus
    });
  } catch (error) {
    console.error('Error calculating fleet health:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});