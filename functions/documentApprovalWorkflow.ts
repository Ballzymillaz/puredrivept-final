import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can process document approvals
    if (!user?.role?.includes('admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { document_id, action, notes } = await req.json();

    if (!document_id || !action || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get document
    const doc = await base44.asServiceRole.entities.Document.get('Document', document_id);
    if (!doc) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Update document status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await base44.asServiceRole.entities.Document.update(document_id, {
      status: newStatus,
      rejection_reason: action === 'reject' ? notes : undefined,
      approved_by: user.email,
      approved_at: new Date().toISOString(),
    });

    // Notify driver
    const notificationTitle = action === 'approve' 
      ? '✅ Documento aprovado'
      : '❌ Documento rejeitado';

    const notificationMsg = action === 'approve'
      ? `O seu documento foi aprovado pelo administrador.`
      : `O seu documento foi rejeitado. Motivo: ${notes || 'Veja os detalhes na aplicação'}`;

    await base44.asServiceRole.entities.Notification.create({
      title: notificationTitle,
      message: notificationMsg,
      type: action === 'approve' ? 'success' : 'alert',
      category: 'document_expiry',
      recipient_email: doc.driver_email,
      action_url: 'DocumentsHub',
      sent_email: false,
    });

    return Response.json({
      success: true,
      document_id,
      status: newStatus,
      driver_notified: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});