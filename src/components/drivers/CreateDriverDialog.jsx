import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Copy, CheckCircle2, UserPlus } from 'lucide-react';

const EMPTY_FORM = { full_name: '', email: '', phone: '', contract_type: '', iban: '' };

export default function CreateDriverDialog({ open, onOpenChange, onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await base44.functions.invoke('createDriverWithUser', form);
    setLoading(false);
    if (res.data?.success) {
      setCredentials(res.data);
      onSuccess?.();
    } else {
      setError(res.data?.error || 'Erreur lors de la création');
    }
  };

  const handleCopy = () => {
    const text = `Email: ${credentials.email}\nMot de passe temporaire: ${credentials.temporary_password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setCredentials(null);
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Adicionar Motorista
          </DialogTitle>
        </DialogHeader>

        {credentials ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Motorista criado com sucesso!</p>
                <p className="text-xs text-green-600">A conta está imediatamente ativa.</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl border p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-sans">Email</span>
                <span className="font-semibold text-gray-800">{credentials.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-sans">Palavra-passe temp.</span>
                <span className="font-bold text-indigo-700 tracking-wider">{credentials.temporary_password}</span>
              </div>
            </div>

            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
              ⚠️ O motorista deverá alterar a palavra-passe no primeiro login.
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
              <Input value={form.full_name} onChange={e => handleChange('full_name', e.target.value)} required placeholder="João Silva" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} required placeholder="joao@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone *</Label>
              <Input value={form.phone} onChange={e => handleChange('phone', e.target.value)} required placeholder="+351 9xx xxx xxx" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de contrato</Label>
              <Select value={form.contract_type} onValueChange={v => handleChange('contract_type', v)}>
                <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slot_standard">Slot Standard (35€/sem)</SelectItem>
                  <SelectItem value="slot_premium">Slot Premium (45€/sem)</SelectItem>
                  <SelectItem value="slot_black">Slot Black (99€/sem)</SelectItem>
                  <SelectItem value="location">Aluguer de veículo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">IBAN (opcional)</Label>
              <Input value={form.iban} onChange={e => handleChange('iban', e.target.value)} placeholder="PT50 ..." />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                {loading ? 'A criar...' : 'Criar motorista'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}