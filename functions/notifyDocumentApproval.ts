import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const { driverId, driverEmail, driverName, docType, status, rejectionReason } = await req.json();
    const base44 = createClientFromRequest(req);

    const subject = status === 'approved' 
      ? `✅ Documento aprovado - ${docType}`
      : `❌ Documento rejeitado - ${docType}`;

    const body = status === 'approved'
      ? `Olá ${driverName},\n\nO seu documento "${docType}" foi aprovado com sucesso.\n\nObrigado.`
      : `Olá ${driverName},\n\nO seu documento "${docType}" foi rejeitado.\n\nMotivo: ${rejectionReason || 'Sem especificação'}\n\nPor favor, envie novamente com as correções necessárias.`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: driverEmail,
      subject,
      body,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});