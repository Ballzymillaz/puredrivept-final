import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.role?.includes('admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { paymentId } = await req.json();

    if (!paymentId) {
      return Response.json({ error: 'Missing paymentId' }, { status: 400 });
    }

    // Get the payment
    const payment = await base44.asServiceRole.entities.WeeklyPayment.get(paymentId);
    if (!payment || payment.status !== 'paid') {
      return Response.json({ error: 'Payment not found or not paid' }, { status: 400 });
    }

    const { driver_id, driver_name, week_start, upi_earned, via_verde_amount, myprio_amount, miio_amount, irs_retention } = payment;

    // Check if already synced (to avoid duplicates)
    const existingTransactions = await base44.asServiceRole.entities.UPITransaction.filter({
      driver_id,
      source: 'weekly_payment',
      week_label: payment.period_label,
    });

    const existingExpenses = await base44.asServiceRole.entities.Expense.filter({
      driver_id,
      description: { $regex: payment.period_label }
    });

    // 1. Create UPI transaction for the driver (if not already exists)
    if (upi_earned > 0 && existingTransactions.length === 0) {
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

    // 2. Create expense records for company costs (if not already exist)
    const expenseDate = week_start || new Date().toISOString().split('T')[0];

    const viaVerdeExists = existingExpenses.some(e => e.description.includes('Via Verde'));
    if (via_verde_amount > 0 && !viaVerdeExists) {
      // Dépense d'entreprise
      await base44.asServiceRole.entities.Expense.create({
        category: 'via_verde',
        description: `Via Verde - ${driver_name} - ${payment.period_label}`,
        amount: via_verde_amount,
        date: expenseDate,
        driver_id,
      });
      // Recette (prélevé du chauffeur)
      await base44.asServiceRole.entities.Expense.create({
        category: 'via_verde',
        description: `Recebido Via Verde - ${driver_name} - ${payment.period_label}`,
        amount: -via_verde_amount,
        date: expenseDate,
        driver_id,
      });
    }

    const myprioExists = existingExpenses.some(e => e.description.includes('MyPRIO'));
    if (myprio_amount > 0 && !myprioExists) {
      // Dépense d'entreprise
      await base44.asServiceRole.entities.Expense.create({
        category: 'via_verde',
        description: `MyPRIO - ${driver_name} - ${payment.period_label}`,
        amount: myprio_amount,
        date: expenseDate,
        driver_id,
      });
      // Recette (prélevé du chauffeur)
      await base44.asServiceRole.entities.Expense.create({
        category: 'via_verde',
        description: `Recebido MyPRIO - ${driver_name} - ${payment.period_label}`,
        amount: -myprio_amount,
        date: expenseDate,
        driver_id,
      });
    }

    const miioExists = existingExpenses.some(e => e.description.includes('Miio'));
    if (miio_amount > 0 && !miioExists) {
      // Dépense d'entreprise
      await base44.asServiceRole.entities.Expense.create({
        category: 'combustivel',
        description: `Miio - ${driver_name} - ${payment.period_label}`,
        amount: miio_amount,
        date: expenseDate,
        driver_id,
      });
      // Recette (prélevé du chauffeur)
      await base44.asServiceRole.entities.Expense.create({
        category: 'combustivel',
        description: `Recebido Miio - ${driver_name} - ${payment.period_label}`,
        amount: -miio_amount,
        date: expenseDate,
        driver_id,
      });
    }

    // Caução - recette pour l'entreprise
    const caucaoExists = existingExpenses.some(e => e.description.includes('Caução'));
    if (irs_retention > 0 && !caucaoExists) {
      await base44.asServiceRole.entities.Expense.create({
        category: 'other',
        description: `Caução - ${driver_name} - ${payment.period_label}`,
        amount: -irs_retention,
        date: expenseDate,
        driver_id,
      });
    }

    return Response.json({ success: true, message: 'Payment synced to expenses and UPI' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});