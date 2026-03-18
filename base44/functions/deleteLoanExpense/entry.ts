import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { loanId } = await req.json();

    if (!loanId) {
      return Response.json({ error: 'Missing loanId' }, { status: 400 });
    }

    // Find and delete expenses related to this loan
    const expenses = await base44.asServiceRole.entities.Expense.filter({ 
      category: 'loans',
      notes: `Loan ID: ${loanId}`
    });

    for (const expense of expenses) {
      await base44.asServiceRole.entities.Expense.delete(expense.id);
    }

    return Response.json({ success: true, deleted: expenses.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});