import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { paymentId } = await req.json();
    
    // Get payment details
    const payment = await base44.asServiceRole.entities.WeeklyPayment.get(paymentId);
    
    if (!payment || payment.status !== 'paid') {
      return Response.json({ error: 'Pagamento não encontrado ou não está pago' }, { status: 400 });
    }

    const expenses = [];
    const date = payment.week_start || new Date().toISOString().split('T')[0];

    // Via Verde
    if (payment.via_verde_amount > 0) {
      expenses.push({
        category: 'via_verde',
        description: `Via Verde - ${payment.driver_name} - ${payment.period_label}`,
        amount: payment.via_verde_amount,
        date,
        driver_id: payment.driver_id,
      });
    }

    // MyPRIO
    if (payment.myprio_amount > 0) {
      expenses.push({
        category: 'vehicle_costs',
        description: `MyPRIO Combustível - ${payment.driver_name} - ${payment.period_label}`,
        amount: payment.myprio_amount,
        date,
        driver_id: payment.driver_id,
      });
    }

    // Miio
    if (payment.miio_amount > 0) {
      expenses.push({
        category: 'vehicle_costs',
        description: `Miio Carregamento - ${payment.driver_name} - ${payment.period_label}`,
        amount: payment.miio_amount,
        date,
        driver_id: payment.driver_id,
      });
    }

    // Reimbursements
    if (payment.reimbursement_credit > 0) {
      expenses.push({
        category: 'driver_payments',
        description: `Reembolso - ${payment.driver_name} - ${payment.period_label}`,
        amount: payment.reimbursement_credit,
        date,
        driver_id: payment.driver_id,
      });
    }

    // Create all expenses
    for (const expense of expenses) {
      await base44.asServiceRole.entities.Expense.create(expense);
    }

    // Attribute UPI to driver
    if (payment.upi_earned > 0) {
      const driver = await base44.asServiceRole.entities.Driver.get(payment.driver_id);
      if (driver) {
        const newBalance = (driver.upi_balance || 0) + payment.upi_earned;
        await base44.asServiceRole.entities.Driver.update(payment.driver_id, {
          upi_balance: newBalance
        });

        // Create UPI transaction
        await base44.asServiceRole.entities.UPITransaction.create({
          driver_id: payment.driver_id,
          driver_name: payment.driver_name,
          type: 'earned',
          amount: payment.upi_earned,
          source: `Uber+Bolt 4% - ${payment.period_label}`,
          week_label: payment.period_label,
        });
      }
    }

    return Response.json({ 
      success: true, 
      expensesCreated: expenses.length,
      upiAttributed: payment.upi_earned 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});