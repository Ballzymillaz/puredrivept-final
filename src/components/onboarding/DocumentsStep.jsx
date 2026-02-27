import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Upload, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

const DOCS = [
  { key: 'driving_license_url', label: 'Carta de Condução', required: true },
  { key: 'tvde_certificate_url', label: 'Certificado TVDE', required: true },
  { key: 'id_card_url', label: 'CC / Passaporte', required: true },
  { key: 'iban_proof_url', label: 'Comprovativo IBAN', required: true },
];

function StatusIcon({ status }) {
  if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === 'submitted') return <Clock className="w-4 h-4 text-amber-500" />;
  return null;
}

export default function DocumentsStep({ onboarding, isAdmin, onUpdate }) {
  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);

  const handleUpload = async (key, file) => {
    setUploading(p => ({ ...p, [key]: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Update onboarding with file URL
      await base44.entities.DriverOnboarding.update(onboarding.id, { [key]: file_url });
      
      // Create Document record for tracking
      const docTypeMap = {
        driving_license_url: 'driving_license',
        tvde_certificate_url: 'tvde_certificate',
        id_card_url: 'id_card',
        iban_proof_url: 'iban_proof'
      };
      
      const docRecord = await base44.entities.Document.create({
        doc_type: docTypeMap[key],
        driver_email: onboarding.driver_email,
        driver_id: onboarding.driver_id,
        file_url,
        status: 'pending'
      });
      
      // Send to AI verification
      await base44.functions.invoke('verifyDocumentAI', {
        documentId: docRecord.id,
        fileUrl: file_url,
        docType: docTypeMap[key]
      });
      
      setUploading(p => ({ ...p, [key]: false }));
      onUpdate();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erro ao fazer upload do documento');
      setUploading(p => ({ ...p, [key]: false }));
    }
  };

  const handleSubmitForReview = async () => {
    setSaving(true);
    await base44.entities.DriverOnboarding.update(onboarding.id, { documents_status: 'submitted' });
    await base44.functions.invoke('onboardingNotify', {
      onboardingId: onboarding.id,
      step: 'documents_submitted',
      driverName: onboarding.driver_name,
      driverEmail: onboarding.driver_email,
    });
    setSaving(false);
    onUpdate();
  };

  const handleApprove = async () => {
    setSaving(true);
    await base44.entities.DriverOnboarding.update(onboarding.id, {
      documents_status: 'approved',
      current_step: 'background_check',
    });
    await base44.functions.invoke('onboardingNotify', {
      onboardingId: onboarding.id,
      step: 'documents_approved',
      driverName: onboarding.driver_name,
      driverEmail: onboarding.driver_email,
    });
    setSaving(false);
    onUpdate();
  };

  const handleReject = async () => {
    const notes = prompt('Motivo da rejeição:');
    if (!notes) return;
    setSaving(true);
    await base44.entities.DriverOnboarding.update(onboarding.id, {
      documents_status: 'rejected',
      status: 'blocked',
    });
    await base44.functions.invoke('onboardingNotify', {
      onboardingId: onboarding.id,
      step: 'documents_rejected',
      driverName: onboarding.driver_name,
      driverEmail: onboarding.driver_email,
      notes,
    });
    setSaving(false);
    onUpdate();
  };

  const allUploaded = DOCS.every(d => onboarding[d.key]);
  const docStatus = onboarding.documents_status || 'pending';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Documentos obrigatórios</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          docStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
          docStatus === 'rejected' ? 'bg-red-100 text-red-700' :
          docStatus === 'submitted' ? 'bg-amber-100 text-amber-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {docStatus === 'approved' ? 'Aprovado' : docStatus === 'rejected' ? 'Rejeitado' : docStatus === 'submitted' ? 'Em revisão' : 'Pendente'}
        </span>
      </div>

      <div className="space-y-3">
        {DOCS.map(doc => (
          <div key={doc.key} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
            <div className="flex items-center gap-2">
              <StatusIcon status={onboarding[doc.key] ? (docStatus === 'approved' ? 'approved' : 'submitted') : null} />
              <span className="text-sm font-medium text-gray-700">{doc.label}</span>
              {doc.required && <span className="text-red-400 text-xs">*</span>}
            </div>
            <div className="flex items-center gap-2">
              {onboarding[doc.key] && (
                <a href={onboarding[doc.key]} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Ver</a>
              )}
              {docStatus === 'pending' || docStatus === 'rejected' ? (
                <label className="cursor-pointer">
                  <span className="text-xs bg-white border border-gray-300 rounded px-2 py-1 hover:bg-gray-50 flex items-center gap-1">
                    {uploading[doc.key] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {onboarding[doc.key] ? 'Substituir' : 'Upload'}
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleUpload(doc.key, e.target.files[0])} />
                </label>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {!isAdmin && docStatus === 'pending' && allUploaded && (
        <Button onClick={handleSubmitForReview} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Submeter para revisão
        </Button>
      )}
      {!isAdmin && docStatus === 'rejected' && allUploaded && (
        <Button onClick={handleSubmitForReview} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700">
          Resubmeter documentos
        </Button>
      )}

      {isAdmin && docStatus === 'submitted' && (
        <div className="flex gap-2">
          <Button onClick={handleApprove} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
            ✅ Aprovar documentos
          </Button>
          <Button onClick={handleReject} disabled={saving} variant="destructive" className="flex-1">
            ❌ Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}