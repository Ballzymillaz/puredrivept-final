import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Copy, CheckCircle2, Building2 } from 'lucide-react';

const EMPTY_FORM = { full_name: '', email: '', phone: '', fleet_name: '' };

export default function CreateFleetManagerDialog({ open, onOpenChange, onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await base44.functions.invoke('createFleetManagerWithFleet', form);
    setLoading(false);
    if (res.data?.success) {
      setResult(res.data);
      onSuccess?.();
    } else {
      setError(res.data?.error || 'Erreur lors de la création');
    }
  };

  const handleCopy = () => {
    const text = `Email: ${result.email}\nMot de passe temporaire: ${result.temporary_password}\nFrota: ${result.fleet_name}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setResult(null);
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Novo Gestor de Frota
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Gestor criado com sucesso!</p>
                <p className="text-xs text-green-600">Frota criada: <strong>{result.fleet_name}</strong></p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl border p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-sans">Frota</span>
                <span className="font-semibold text-gray-800">{result.fleet_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-sans">Email</span>
                <span className="font-semibold text-gray-800">{result.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-sans">Palavra-passe temp.</span>
                <span className="font-bold text-indigo-700 tracking-wider">{result.temporary_password}</span>
              </div>
            </div>

            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
              ⚠️ O gestor deverá alterar a palavra-passe no primeiro login.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar credenciais'}
              </Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome completo *</Label>
              <Input value={form.full_name} onChange={e => handleChange('full_name', e.target.value)} required placeholder="Maria Santos" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} required placeholder="maria@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone *</Label>
              <Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} required placeholder="+351 9xx xxx xxx" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Frota (opcional)</Label>
              <Input value={form.fleet_name} onChange={e => handleChange('fleet_name', e.target.value)} placeholder="Frota Lisboa Norte..." />
              <p className="text-xs text-gray-400">Se vazio: "Frota {form.full_name || 'Nome'}"</p>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                {loading ? 'A criar...' : 'Criar gestor + frota'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}