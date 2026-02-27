import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { onboardingId, step, driverName, driverEmail, notes } = await req.json();

    const messages = {
      documents_submitted: {
        title: `📄 Documentos submetidos — ${driverName}`,
        message: `O motorista ${driverName} submeteu os seus documentos. Por favor, verifique e aprove.`,
        adminCategory: 'driver_performance',
        driverMsg: `Os seus documentos foram submetidos com sucesso. Aguarde a validação pela equipa.`,
      },
      documents_approved: {
        title: `✅ Documentos aprovados — ${driverName}`,
        message: `Os documentos de ${driverName} foram aprovados. Prosseguir para verificação de antecedentes.`,
        adminCategory: 'driver_performance',
        driverMsg: `Os seus documentos foram aprovados! A próxima etapa é a verificação de antecedentes.`,
      },
      documents_rejected: {
        title: `❌ Documentos rejeitados — ${driverName}`,
        message: `Os documentos de ${driverName} foram rejeitados. ${notes || ''}`,
        adminCategory: 'driver_performance',
        driverMsg: `Os seus documentos foram rejeitados. ${notes || 'Por favor, resubmeta os documentos corretos.'}`,
      },
      background_approved: {
        title: `✅ Verificação aprovada — ${driverName}`,
        message: `A verificação de antecedentes de ${driverName} foi aprovada. Atribuir veículo.`,
        adminCategory: 'driver_performance',
        driverMsg: `A sua verificação de antecedentes foi aprovada! A etapa final é a atribuição do veículo.`,
      },
      background_rejected: {
        title: `❌ Verificação reprovada — ${driverName}`,
        message: `A verificação de antecedentes de ${driverName} foi reprovada. ${notes || ''}`,
        adminCategory: 'driver_performance',
        driverMsg: `A sua verificação de antecedentes não foi aprovada. ${notes || 'Entre em contacto com a equipa.'}`,
      },
      vehicle_assigned: {
        title: `🚗 Veículo atribuído — ${driverName}`,
        message: `O veículo foi atribuído a ${driverName}. Onboarding concluído!`,
        adminCategory: 'vehicle',
        driverMsg: `Parabéns! O seu veículo foi atribuído e o seu onboarding está completo. Bem-vindo à equipa!`,
      },
    };

    const cfg = messages[step];
    if (!cfg) return Response.json({ error: 'Invalid step' }, { status: 400 });

    // Notify admin
    await base44.asServiceRole.entities.Notification.create({
      title: cfg.title,
      message: cfg.message,
      type: step.includes('rejected') ? 'warning' : 'info',
      category: cfg.adminCategory,
      recipient_role: 'admin',
      related_entity: onboardingId,
    });

    // Notify driver
    await base44.asServiceRole.entities.Notification.create({
      title: cfg.title,
      message: cfg.driverMsg,
      type: step.includes('rejected') ? 'warning' : step.includes('approved') || step === 'vehicle_assigned' ? 'success' : 'info',
      category: 'general',
      recipient_email: driverEmail,
      related_entity: onboardingId,
    });

    // Send email to driver
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: driverEmail,
      subject: cfg.title,
      body: `<p>Olá ${driverName},</p><p>${cfg.driverMsg}</p><p>Aceda à plataforma PureDrivePT para mais detalhes.</p>`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});