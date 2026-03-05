import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { loanId } = await req.json();

    if (!loanId) {
      return Response.json({ error: 'Missing loanId' }, { status: 400 });
    }

    // Get the loan
    const loan = await base44.asServiceRole.entities.Loan.get(loanId);
    if (!loan) {
      return Response.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Create expense for the loan
    await base44.asServiceRole.entities.Expense.create({
      category: 'loans',
      description: `Empréstimo - ${loan.driver_name}`,
      amount: loan.amount,
      date: loan.approval_date || new Date().toISOString().split('T')[0],
      driver_id: loan.driver_id,
      notes: `Loan ID: ${loanId}`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});