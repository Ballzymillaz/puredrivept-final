import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, AlertCircle } from 'lucide-react';

const DOC_TYPES = {
  driving_license: 'Carta de condução',
  tvde_certificate: 'Certificado TVDE',
  id_card: 'Cartão de cidadão',
  iban_proof: 'Comprovativo IBAN',
  insurance: 'Seguro',
  periodic_inspection: 'Inspeção periódica',
  vehicle_booklet: 'Livro do veículo',
};

export default function DriverDocumentUpload({ driverId, driverName, onUploadSuccess }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      let fileUrl = '';
      if (file) {
        const res = await base44.integrations.Core.UploadFile({ file });
        fileUrl = res.file_url;
      }
      return base44.entities.Document.create({
        ...data,
        file_url: fileUrl,
        status: 'pending',
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['my-docs', driverId] });
      await qc.invalidateQueries({ queryKey: ['documents'] });
      
      // Notify admins
      try {
        await base44.functions.invoke('notifyDocumentSubmission', {
          driverId,
          driverName,
          docType: DOC_TYPES[docType],
        });
      } catch (e) {
        console.error('Error notifying:', e);
      }

      setOpen(false);
      resetForm();
      if (onUploadSuccess) onUploadSuccess();
    },
  });

  const resetForm = () => {
    setFile(null);
    setDocType('');
    setExpiryDate('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!docType || !file) return;
    
    setUploading(true);
    await createMutation.mutateAsync({
      owner_type: 'driver',
      owner_id: driverId,
      owner_name: driverName,
      document_type: docType,
      expiry_date: expiryDate,
    });
    setUploading(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="gap-2">
        <Upload className="w-4 h-4" />
        Enviar documento
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar documento</DialogTitle>
          </DialogHeader>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">Os documentos serão revistos pelos administradores. Você receberá notificação quando aprovado ou rejeitado.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo de documento *</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolher..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Data de validade (se aplicável)</Label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Ficheiro (PDF ou imagem) *</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={e => setFile(e.target.files?.[0])}
                required
              />
              {file && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                  <FileText className="w-3 h-3" />
                  {file.name}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={uploading || !docType || !file}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {uploading ? 'A enviar...' : 'Enviar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}