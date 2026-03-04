import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Car } from 'lucide-react';

export default function Apply() {
  const [submitted, setSubmitted] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get('ref') || '';

  const [form, setForm] = useState({
    applicant_type: 'driver',
    full_name: '', email: '', phone: '', nif: '', message: '',
    referral_code: referralCode,
  });

  const createMutation = useMutation({
    mutationFn: async (d) => {
      const result = await base44.entities.Application.create(d);
      try {
        await base44.integrations.Core.SendEmail({
          to: d.email,
          subject: 'Candidatura recebida - PureDrive PT',
          body: `Olá ${d.full_name},\n\nA sua candidatura foi recebida com sucesso. A nossa equipa irá analisá-la e entrará em contacto consigo em breve.\n\nReceberá um email assim que a sua candidatura for validada e poderá aceder à plataforma.\n\nAtenciosamente,\nEquipa PureDrive PT`,
        });
      } catch (_) {}
      return result;
    },
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-0 shadow-2xl">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold text-gray-900">Candidatura enviada!</h2>
            <p className="text-gray-600">Obrigado, <strong>{form.full_name}</strong>! A sua candidatura foi recebida.</p>
            <div className="bg-indigo-50 rounded-xl p-4 text-left space-y-2 text-sm text-indigo-800">
              <p>📋 A sua candidatura foi recebida e aguarda validação por um administrador.</p>
              <p>🔐 Após aprovação, pode aceder à plataforma com o email e palavra-passe que criou.</p>
              <p>⚠️ Até ser validado, não terá acesso a nenhuma página da plataforma.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
            <Car className="w-7 h-7 text-indigo-600" />
          </div>
          <CardTitle className="text-xl font-bold">Juntar-se à PureDrive<sup className="text-xs">PT</sup></CardTitle>
          <p className="text-sm text-gray-500 mt-1">Preencha o formulário para candidatar-se</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Candidato como</Label>
              <Select value={form.applicant_type} onValueChange={(v) => setForm(f => ({...f, applicant_type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="driver">Motorista TVDE</SelectItem>
                  <SelectItem value="fleet_manager">Gestor de frota</SelectItem>
                  <SelectItem value="commercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({...f, full_name: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Telefone *</Label><Input value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">NIF</Label><Input value={form.nif} onChange={(e) => setForm(f => ({...f, nif: e.target.value}))} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Mensagem (opcional)</Label><Textarea value={form.message} onChange={(e) => setForm(f => ({...f, message: e.target.value}))} rows={3} placeholder="Conte-nos sobre a sua experiência..." /></div>
            {referralCode && (
              <div className="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-700">
                Código de indicação: <strong>{referralCode}</strong>
              </div>
            )}
            {createMutation.isError && (
              <p className="text-sm text-red-600 text-center">Erro ao enviar. Tente novamente.</p>
            )}
            <Button type="submit" disabled={createMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
              {createMutation.isPending ? 'A enviar...' : 'Enviar candidatura'}
            </Button>
            <p className="text-xs text-gray-400 text-center">Após o envio, a sua candidatura será analisada pela nossa equipa. Receberá um email de confirmação assim que for validada.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}