import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.role?.includes('admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { documentId, fileUrl, docType } = await req.json();

    if (!documentId || !fileUrl) {
      return Response.json({ error: 'Missing documentId or fileUrl' }, { status: 400 });
    }

    // Use AI to analyze document
    const prompt = `Analyze this document image and extract key information.

Document Type: ${docType || 'unknown'}

Please extract and verify:
1. Full name
2. Document number/ID
3. Expiry date (if applicable, format as YYYY-MM-DD)
4. Issue date (if applicable)
5. Document validity (is it genuine and valid?)
6. Any inconsistencies or red flags

Return the response as JSON with fields: fullName, documentNumber, expiryDate, issueDate, isValid, flags (array of issues).

If any field cannot be determined, return null for that field.`;

    const analysisResult = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [fileUrl],
      response_json_schema: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          documentNumber: { type: 'string' },
          expiryDate: { type: 'string' },
          issueDate: { type: 'string' },
          isValid: { type: 'boolean' },
          flags: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
        },
      },
    });

    // Get the document from database
    const document = await base44.asServiceRole.entities.Document.get(documentId);
    if (!document) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }

    // Update document with AI analysis
    let autoStatus = 'approved';
    const issues = analysisResult.flags || [];

    if (!analysisResult.isValid || analysisResult.confidence < 0.85) {
      autoStatus = 'rejected';
      issues.push(`Low confidence score: ${(analysisResult.confidence * 100).toFixed(0)}%`);
    }

    if (analysisResult.expiryDate) {
      const expiry = new Date(analysisResult.expiryDate);
      const now = new Date();
      if (expiry < now) {
        autoStatus = 'rejected';
        issues.push('Document has expired');
      }
    }

    // Update document
    await base44.asServiceRole.entities.Document.update(documentId, {
      status: autoStatus,
      expiry_date: analysisResult.expiryDate || document.expiry_date,
    });

    // If document was rejected, notify admin and driver
    if (autoStatus === 'rejected' && issues.length > 0) {
      const driver = await base44.asServiceRole.entities.Driver.filter({ email: document.driver_email });

      // Notify admin
      await base44.asServiceRole.entities.Notification.create({
        title: `Documento rejeitado pela IA - ${document.driver_email}`,
        message: `Documento ${docType} foi rejeitado automaticamente. Problemas: ${issues.join(', ')}. Ação humana recomendada.`,
        type: 'alert',
        category: 'document_expiry',
        recipient_role: 'admin',
        recipient_email: 'all',
        related_entity: documentId,
        sent_email: false,
      });

      // Notify driver
      if (driver.length > 0) {
        await base44.asServiceRole.entities.Notification.create({
          title: 'Documento rejeitado',
          message: `O seu documento ${docType} foi rejeitado. Problemas encontrados: ${issues.join(', ')}. Por favor, resubmeta com as correções.`,
          type: 'alert',
          category: 'document_expiry',
          recipient_email: document.driver_email,
          related_entity: documentId,
          sent_email: false,
        });
      }
    }

    return Response.json({
      success: true,
      analysis: analysisResult,
      status: autoStatus,
      issues,
      documentId,
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});