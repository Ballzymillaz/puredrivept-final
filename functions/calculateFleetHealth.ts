import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { cityId } = await req.json();
    
    if (!cityId) {
      return Response.json({ error: 'Missing cityId' }, { status: 400 });
    }

    // Fetch city data
    const cities = await base44.entities.Cities.filter({ id: cityId });
    if (!cities || cities.length === 0) {
      return Response.json({ error: 'City not found' }, { status: 404 });
    }

    const city = cities[0];
    const today = new Date();
    const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    const twelveWeeksAgo = new Date(today.getTime() - 84 * 24 * 60 * 60 * 1000);

    // Revenue trend: compare last 4 weeks vs last 12 weeks
    const recentRevenues = await base44.entities.WeeklyRevenues.filter({ city_id: cityId });
    const last4Weeks = recentRevenues.filter(r => new Date(r.week_start_date) >= fourWeeksAgo);
    const last12Weeks = recentRevenues.filter(r => new Date(r.week_start_date) >= twelveWeeksAgo);

    const avg4Weeks = last4Weeks.length > 0 ? last4Weeks.reduce((s, r) => s + (r.total_revenue || 0), 0) / last4Weeks.length : 0;
    const avg12Weeks = last12Weeks.length > 0 ? last12Weeks.reduce((s, r) => s + (r.total_revenue || 0), 0) / last12Weeks.length : 0;

    const revenueTrendScore = avg12Weeks > 0 && ((avg4Weeks - avg12Weeks) / avg12Weeks) < -0.2 ? 2 : avg12Weeks > 0 && ((avg4Weeks - avg12Weeks) / avg12Weeks) < -0.1 ? 1 : 0;

    // Occupancy: assigned vehicles / total vehicles
    const vehicles = await base44.entities.Vehicles.filter({ city_id: cityId });
    const assignedVehicles = vehicles.filter(v => v.status === 'assigned').length;
    const occupancyRatio = vehicles.length > 0 ? assignedVehicles / vehicles.length : 0;
    const occupancyScore = occupancyRatio < 0.7 ? 2 : occupancyRatio < 0.9 ? 1 : 0;

    // Debt/EBITDA: total loans / annual EBITDA estimate
    const loans = await base44.entities.Loans.filter({ city_id: cityId, status: 'active' });
    const totalDebt = loans.reduce((s, l) => s + (l.remaining_balance || 0), 0);
    const monthlyRentIncome = vehicles.reduce((s, v) => s + (v.weekly_rent || 0) * 4.33, 0);
    const annualEBITDA = monthlyRentIncome * 12;
    const debtRatio = annualEBITDA > 0 ? totalDebt / annualEBITDA : 0;
    const debtEbitdaScore = debtRatio > 4 ? 2 : debtRatio > 2 ? 1 : 0;

    // Loan exposure: total loans / monthly rent income
    const loanExposureRatio = monthlyRentIncome > 0 ? totalDebt / monthlyRentIncome : 0;
    const loanExposureScore = loanExposureRatio > 0.35 ? 2 : loanExposureRatio > 0.25 ? 1 : 0;

    // UPI liquidity: pending requests vs envelope
    const buybacks = await base44.entities.UPIBuybackRounds.filter({ status: 'open' });
    const sellRequests = await base44.entities.UPISellRequests.filter({ status: 'pending' });
    const upiLiquidityScore = buybacks.length > 0 && sellRequests.length > 0 && 
      sellRequests.reduce((s, r) => s + r.requested_amount, 0) > buybacks[0].envelope_remaining ? 2 : 0;

    // Overall score
    const totalScore = revenueTrendScore + occupancyScore + debtEbitdaScore + loanExposureScore + upiLiquidityScore;
    const overallStatus = totalScore >= 7 ? 'red' : totalScore >= 4 ? 'yellow' : 'green';

    // Create or update fleet health
    const health = await base44.entities.FleetHealth.create({
      city_id: cityId,
      city_name: city.name,
      calculated_date: today.toISOString().split('T')[0],
      revenue_trend_score: revenueTrendScore,
      occupancy_score: occupancyScore,
      debt_ebitda_score: debtEbitdaScore,
      loan_exposure_score: loanExposureScore,
      upi_liquidity_score: upiLiquidityScore,
      overall_score: totalScore,
      overall_status: overallStatus,
      metrics: {
        avg4Weeks,
        avg12Weeks,
        occupancyRatio: (occupancyRatio * 100).toFixed(1),
        debtRatio: debtRatio.toFixed(2),
        loanExposureRatio: loanExposureRatio.toFixed(2),
      },
    });

    return Response.json({ success: true, health });
  } catch (error) {
    console.error('Error calculating fleet health:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});