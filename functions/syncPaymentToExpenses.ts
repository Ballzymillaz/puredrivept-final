import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { paymentId } = await req.json();

    if (!paymentId) {
      return Response.json({ error: 'Missing paymentId' }, { status: 400 });
    }

    // Get the payment
    const payment = await base44.asServiceRole.entities.WeeklyPayment.get(paymentId);
    if (!payment || payment.status !== 'paid') {
      return Response.json({ error: 'Payment not found or not paid' }, { status: 400 });
    }

    const { driver_id, driver_name, week_start, upi_earned, via_verde_amount, myprio_amount, miio_amount } = payment;

    // 1. Create UPI transaction for the driver
    if (upi_earned > 0) {
      await base44.asServiceRole.entities.UPITransaction.create({
        driver_id,
        driver_name,
        type: 'earned',
        amount: upi_earned,
        source: 'weekly_payment',
        week_label: payment.period_label,
        processed_by: 'system',
      });

      // Update driver UPI balance
      const driver = await base44.asServiceRole.entities.Driver.get(driver_id);
      if (driver) {
        await base44.asServiceRole.entities.Driver.update(driver_id, {
          upi_balance: (driver.upi_balance || 0) + upi_earned,
        });
      }
    }

    // 2. Create expense records for company costs
    const expenseDate = week_start || new Date().toISOString().split('T')[0];

    if (via_verde_amount > 0) {
      await base44.asServiceRole.entities.Expense.create({
        category: 'via_verde',
        description: `Via Verde - ${driver_name} - ${payment.period_label}`,
        amount: via_verde_amount,
        date: expenseDate,
        driver_id,
      });
    }

    if (myprio_amount > 0) {
      await base44.asServiceRole.entities.Expense.create({
        category: 'via_verde',
        description: `MyPRIO - ${driver_name} - ${payment.period_label}`,
        amount: myprio_amount,
        date: expenseDate,
        driver_id,
      });
    }

    if (miio_amount > 0) {
      await base44.asServiceRole.entities.Expense.create({
        category: 'via_verde',
        description: `Miio - ${driver_name} - ${payment.period_label}`,
        amount: miio_amount,
        date: expenseDate,
        driver_id,
      });
    }

    return Response.json({ success: true, message: 'Payment synced to expenses and UPI' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});