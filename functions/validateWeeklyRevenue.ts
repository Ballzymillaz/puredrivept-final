import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { weeklyRevenueId } = await req.json();
    if (!weeklyRevenueId) {
      return Response.json({ error: 'Missing weeklyRevenueId' }, { status: 400 });
    }

    // Fetch WeeklyRevenue
    const revenues = await base44.asServiceRole.entities.WeeklyRevenues.filter({ id: weeklyRevenueId });
    if (!revenues || revenues.length === 0) {
      return Response.json({ error: 'WeeklyRevenue not found' }, { status: 404 });
    }

    const revenue = revenues[0];

    // 1. Lock the record
    await base44.asServiceRole.entities.WeeklyRevenues.update(weeklyRevenueId, {
      status: 'validated'
    });

    // 2. Create UPI Accrual
    const upiDriver = revenue.total_revenue * 0.04;
    const upiTotal = upiDriver + (revenue.upi_company_match || upiDriver);
    
    await base44.asServiceRole.entities.UPIAccruals.create({
      driver_id: revenue.driver_id,
      driver_name: revenue.driver_name,
      weekly_revenue_id: weeklyRevenueId,
      week_start_date: revenue.week_start_date,
      upi_driver: upiDriver,
      upi_company_match: revenue.upi_company_match || upiDriver,
      upi_total: upiTotal
    });

    // 3. Create Ledger entries for deductions
    const today = new Date().toISOString().split('T')[0];
    const ledgerEntries = [
      {
        date: today,
        city_id: revenue.city_id,
        driver_id: revenue.driver_id,
        type: 'upi',
        amount: upiTotal,
        description: `UPI accrual - Week ${revenue.week_start_date}`,
        reference_id: weeklyRevenueId,
        status: 'recorded'
      }
    ];

    if (revenue.rent_due > 0) {
      ledgerEntries.push({
        date: today,
        city_id: revenue.city_id,
        driver_id: revenue.driver_id,
        type: 'rent',
        amount: revenue.rent_due,
        description: `Rent - Week ${revenue.week_start_date}`,
        reference_id: weeklyRevenueId,
        status: 'recorded'
      });
    }

    if (revenue.loan_due > 0) {
      ledgerEntries.push({
        date: today,
        city_id: revenue.city_id,
        driver_id: revenue.driver_id,
        type: 'loan',
        amount: revenue.loan_due,
        description: `Loan payment - Week ${revenue.week_start_date}`,
        reference_id: weeklyRevenueId,
        status: 'recorded'
      });
    }

    if (revenue.insurance > 0) {
      ledgerEntries.push({
        date: today,
        city_id: revenue.city_id,
        driver_id: revenue.driver_id,
        type: 'insurance',
        amount: revenue.insurance,
        description: `Insurance - Week ${revenue.week_start_date}`,
        reference_id: weeklyRevenueId,
        status: 'recorded'
      });
    }

    // Create ledger entries
    for (const entry of ledgerEntries) {
      await base44.asServiceRole.entities.Ledger.create(entry);
    }

    // 4. Lock the record
    await base44.asServiceRole.entities.WeeklyRevenues.update(weeklyRevenueId, {
      status: 'locked'
    });

    return Response.json({
      success: true,
      weeklyRevenueId,
      vestingCalculated: true,
      ledgerEntriesCreated: ledgerEntries.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});