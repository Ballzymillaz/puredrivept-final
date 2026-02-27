import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { startOfWeek, endOfWeek, format, subWeeks } from 'npm:date-fns@3.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const weekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekLabel = `Semana ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM/yyyy')}`;

    const drivers = await base44.asServiceRole.entities.Driver.filter({ status: 'active' });
    const contracts = await base44.asServiceRole.entities.Contract.filter({ status: 'active' });
    const existingPayments = await base44.asServiceRole.entities.WeeklyPayment.filter({
      week_start: format(weekStart, 'yyyy-MM-dd'),
    });

    let created = 0;
    let skipped = 0;

    for (const driver of drivers) {
      // Skip if payment already exists
      if (existingPayments.find(p => p.driver_id === driver.id)) {
        skipped++;
        continue;
      }

      const contract = contracts.find(c => c.driver_id === driver.id);
      if (!contract) continue;

      const payment = {
        driver_id: driver.id,
        driver_name: driver.full_name,
        week_start: format(weekStart, 'yyyy-MM-dd'),
        week_end: format(weekEnd, 'yyyy-MM-dd'),
        period_label: weekLabel,
        uber_gross: 0,
        bolt_gross: 0,
        other_platform_gross: 0,
        total_gross: 0,
        commission_amount: 0,
        slot_fee: contract.slot_fee || 0,
        vehicle_rental: contract.contract_type === 'location' ? (contract.weekly_rental_price || 0) : 0,
        via_verde_amount: 0,
        myprio_amount: 0,
        miio_amount: 0,
        loan_installment: 0,
        vehicle_purchase_installment: 0,
        reimbursement_credit: 0,
        goal_bonus: 0,
        iva_amount: 0,
        irs_retention: !driver.vehicle_deposit_paid ? 50 : 0,
        upi_earned: 0,
        total_deductions: 0,
        net_amount: 0,
        status: 'draft',
        notes: 'Auto-gerado',
      };

      await base44.asServiceRole.entities.WeeklyPayment.create(payment);
      created++;
    }

    return Response.json({
      success: true,
      weekLabel,
      created,
      skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});