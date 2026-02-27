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
    if (!payment) {
      return Response.json({ error: 'Payment not found' }, { status: 404 });
    }

    const { driver_id, driver_name, upi_earned, via_verde_amount, myprio_amount, miio_amount } = payment;

    // 1. Delete UPI transaction
    const upiTransactions = await base44.asServiceRole.entities.UPITransaction.filter({
      driver_id,
      source: 'weekly_payment',
      week_label: payment.period_label,
    });

    for (const tx of upiTransactions) {
      await base44.asServiceRole.entities.UPITransaction.delete(tx.id);
    }

    // Update driver UPI balance
    if (upi_earned > 0) {
      const driver = await base44.asServiceRole.entities.Driver.get(driver_id);
      if (driver) {
        await base44.asServiceRole.entities.Driver.update(driver_id, {
          upi_balance: Math.max(0, (driver.upi_balance || 0) - upi_earned),
        });
      }
    }

    // 2. Delete all company expenses (revenus) for Via Verde, MyPRIO, Miio
    if (via_verde_amount > 0) {
      const viaVerdeExpenses = await base44.asServiceRole.entities.Expense.filter({
        driver_id,
        category: 'via_verde',
        amount: via_verde_amount,
      });
      for (const exp of viaVerdeExpenses) {
        await base44.asServiceRole.entities.Expense.delete(exp.id);
      }
    }

    if (myprio_amount > 0) {
      const myprioExpenses = await base44.asServiceRole.entities.Expense.filter({
        driver_id,
        description: { $regex: 'Combustivel' },
        amount: myprio_amount,
      });
      for (const exp of myprioExpenses) {
        await base44.asServiceRole.entities.Expense.delete(exp.id);
      }
    }

    if (miio_amount > 0) {
      const miioExpenses = await base44.asServiceRole.entities.Expense.filter({
        driver_id,
        description: { $regex: 'Miio' },
        amount: miio_amount,
      });
      for (const exp of miioExpenses) {
        await base44.asServiceRole.entities.Expense.delete(exp.id);
      }
    }

    // 3. Delete referral payments associated with this payment
    const referralPayments = await base44.asServiceRole.entities.ReferralPayment.filter({
      driver_id,
      week_label: payment.period_label,
    });

    for (const refPayment of referralPayments) {
      await base44.asServiceRole.entities.ReferralPayment.delete(refPayment.id);
    }

    return Response.json({ success: true, message: 'Payment expenses and referrals deleted' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});