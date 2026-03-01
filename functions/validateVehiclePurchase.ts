import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const ALLOWED_DURATIONS = [6, 9, 12, 18, 20, 24, 30, 36, 40, 44, 48];

function getTvdeExpiry(firstRegDate) {
  if (!firstRegDate) return null;
  const d = new Date(firstRegDate);
  d.setFullYear(d.getFullYear() + 7);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function computeQuarterlySchedule(totalPrice, durationMonths) {
  const totalWeeks = Math.round(durationMonths * 4.33);
  const numQuarters = Math.ceil(totalWeeks / 13);
  if (totalWeeks === 0) return null;

  if (numQuarters < 2) {
    const weekly = Math.round((totalPrice / totalWeeks) * 100) / 100;
    if (weekly < 0) return null;
    return [{ quarter: 1, weeks: totalWeeks, weeklyAmount: weekly, total: totalPrice }];
  }

  const M1 = 300;
  const fullQ = 13;
  const lastQWeeks = totalWeeks - (numQuarters - 1) * fullQ;

  let denominator = 0;
  for (let q = 1; q <= numQuarters; q++) {
    const qw = q < numQuarters ? fullQ : lastQWeeks;
    denominator += (q - 1) * qw;
  }
  const step = denominator > 0 ? (M1 * totalWeeks - totalPrice) / denominator : 0;
  if (step < 0) return null;

  const quarters = [];
  let cumulativeTotal = 0;

  for (let q = 1; q <= numQuarters; q++) {
    const qWeeks = q < numQuarters ? fullQ : lastQWeeks;
    const rawWeekly = M1 - (q - 1) * step;
    if (rawWeekly < 0) return null;
    const weeklyAmount = q < numQuarters
      ? Math.round(rawWeekly * 100) / 100
      : Math.round((totalPrice - cumulativeTotal) / Math.max(1, qWeeks) * 100) / 100;
    if (weeklyAmount < 0) return null;
    const qTotal = q < numQuarters
      ? Math.round(rawWeekly * qWeeks * 100) / 100
      : Math.round((totalPrice - cumulativeTotal) * 100) / 100;
    if (qTotal < 0) return null;
    quarters.push({ quarter: q, weeks: qWeeks, weeklyAmount, total: qTotal });
    if (q < numQuarters) cumulativeTotal += qTotal;
  }

  return quarters;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { vehicle_id, duration_months, total_price, _vehicle_first_reg_date } = body;

    // 1. Duration must be allowed
    const months = parseInt(duration_months);
    if (!ALLOWED_DURATIONS.includes(months)) {
      return Response.json({ error: `Duração não permitida: ${months} meses.` }, { status: 400 });
    }

    // 2. Fetch vehicle for TVDE check
    let firstRegDate = _vehicle_first_reg_date;
    if (vehicle_id && !firstRegDate) {
      const vehicle = await base44.asServiceRole.entities.Vehicle.filter({ id: vehicle_id });
      firstRegDate = vehicle?.[0]?.first_registration_date || null;
    }

    const tvdeExpiry = getTvdeExpiry(firstRegDate);
    const contractEnd = addMonths(new Date(), months);
    if (tvdeExpiry && contractEnd > tvdeExpiry) {
      return Response.json({ error: 'Esta duração ultrapassa o limite de atividade TVDE do veículo.' }, { status: 400 });
    }

    // 3. Validate degressive schedule — no negative payments
    const schedule = computeQuarterlySchedule(parseFloat(total_price) || 0, months);
    if (!schedule) {
      return Response.json({ error: 'Duração inválida — estrutura de pagamento resultaria em valor negativo.' }, { status: 400 });
    }

    // 4. Total price coherence
    const sumTotal = schedule.reduce((s, q) => s + q.total, 0);
    const expectedTotal = parseFloat(total_price) || 0;
    if (expectedTotal > 0 && Math.abs(sumTotal - expectedTotal) > 1) {
      return Response.json({ error: 'Preço total incoerente com o plano de pagamentos.' }, { status: 400 });
    }

    return Response.json({ valid: true, schedule });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});