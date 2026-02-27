import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { driverId } = await req.json();
    
    if (!driverId) {
      return Response.json({ error: 'Missing driverId' }, { status: 400 });
    }

    // Fetch all active loans for the driver
    const loans = await base44.asServiceRole.entities.Loans.filter({ 
      driver_id: driverId,
      status: 'active'
    });

    // Sum weekly payments from all active loans
    const totalLoanDue = loans.reduce((sum, loan) => {
      return sum + (loan.weekly_payment || 0);
    }, 0);

    return Response.json({
      success: true,
      driverId,
      loan_due: totalLoanDue.toFixed(2),
      activeLoansCount: loans.length
    });
  } catch (error) {
    console.error('Error calculating weekly loan due:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});