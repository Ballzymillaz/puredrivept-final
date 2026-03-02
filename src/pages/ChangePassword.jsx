import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { KeyRound, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function ChangePassword() {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('A palavra-passe deve ter pelo menos 8 caracteres.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('As palavras-passe não coincidem.');
      return;
    }
    setLoading(true);
    await base44.auth.updateMe({ password: form.password, must_change_password: false });
    setLoading(false);
    setSuccess(true);
    setTimeout(() => {
      const role = user?.role;
      const dest = role === 'driver' ? 'DriverDashboard' : role === 'fleet_manager' ? 'Payments' : 'Dashboard';
      window.location.href = createPageUrl(dest);
    }, 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h2 className="text-lg font-bold text-gray-900">Palavra-passe alterada!</h2>
          <p className="text-sm text-gray-500">A redirecionar para o painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border shadow-sm p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Alterar palavra-passe</h2>
          <p className="text-sm text-gray-500 mt-1">Por segurança, deve alterar a sua palavra-passe temporária antes de continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nova palavra-passe *</Label>
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                placeholder="Mínimo 8 caracteres"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirmar palavra-passe *</Label>
            <Input
              type="password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              required
              placeholder="Repetir palavra-passe"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
            {loading ? 'A guardar...' : 'Confirmar nova palavra-passe'}
          </Button>
        </form>
      </div>
    </div>
  );
}