import React, { useState } from 'react';
import { Shield, Globe, Palette, Plug, Lock, Save, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'geral', label: 'Geral', icon: Globe, adminOnly: false },
  { id: 'aparencia', label: 'Aparência', icon: Palette, adminOnly: false },
  { id: 'integracoes', label: 'Integrações', icon: Plug, adminOnly: true },
  { id: 'permissoes', label: 'Permissões', icon: Shield, adminOnly: true },
];

const ROLE_PERMISSIONS = {
  admin: {
    label: 'Administrador',
    color: 'bg-red-100 text-red-700',
    permissions: {
      drivers: ['read', 'write', 'delete'],
      vehicles: ['read', 'write', 'delete'],
      payments: ['read', 'write', 'delete'],
      reports: ['read', 'export'],
      users: ['read', 'write', 'delete'],
      settings: ['read', 'write'],
      finances: ['read', 'write'],
    }
  },
  fleet_manager: {
    label: 'Gestor de Frota',
    color: 'bg-blue-100 text-blue-700',
    permissions: {
      drivers: ['read', 'write'],
      vehicles: ['read', 'write'],
      payments: ['read'],
      reports: ['read', 'export'],
      users: [],
      settings: [],
      finances: ['read'],
    }
  },
  commercial: {
    label: 'Comercial',
    color: 'bg-green-100 text-green-700',
    permissions: {
      drivers: ['read'],
      vehicles: [],
      payments: [],
      reports: ['read'],
      users: [],
      settings: [],
      finances: [],
    }
  },
  driver: {
    label: 'Motorista',
    color: 'bg-indigo-100 text-indigo-700',
    permissions: {
      drivers: [],
      vehicles: [],
      payments: ['read'],
      reports: [],
      users: [],
      settings: [],
      finances: [],
    }
  },
};

const PERM_LABELS = {
  drivers: 'Motoristas', vehicles: 'Veículos', payments: 'Pagamentos',
  reports: 'Relatórios', users: 'Utilizadores', settings: 'Configurações', finances: 'Finanças'
};
const ACTION_LABELS = { read: 'Ver', write: 'Editar', delete: 'Eliminar', export: 'Exportar' };

export default function Configuracoes({ currentUser }) {
  const [activeTab, setActiveTab] = useState('geral');
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    language: 'pt',
    timezone: 'Europe/Lisbon',
    dateFormat: 'dd/MM/yyyy',
    currency: 'EUR',
    theme: 'light',
    primaryColor: 'indigo',
    compactMode: false,
    slackWebhook: '',
    webhookUrl: '',
    dataRetentionDays: '365',
  });

  const isAdmin = currentUser?.role?.includes('admin');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
          <p className="text-sm text-gray-500">Personalize a plataforma e gira permissões</p>
        </div>
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Save className="w-4 h-4" /> {saved ? 'Guardado!' : 'Guardar alterações'}
        </Button>
      </div>

      <div className="flex gap-1 border-b bg-white rounded-t-xl px-2 pt-2 shadow-sm">
        {visibleTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2',
              activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            <tab.icon className="w-4 h-4" /> {tab.label}
            {tab.adminOnly && <Lock className="w-3 h-3 text-gray-400" />}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* GERAL */}
        {activeTab === 'geral' && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Idioma & Região</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Idioma</Label>
                  <Select value={settings.language} onValueChange={v => set('language', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">Português</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fuso horário</Label>
                  <Select value={settings.timezone} onValueChange={v => set('timezone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Lisbon">Europe/Lisbon (UTC+0/+1)</SelectItem>
                      <SelectItem value="Europe/Paris">Europe/Paris (UTC+1/+2)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Formato de data</Label>
                  <Select value={settings.dateFormat} onValueChange={v => set('dateFormat', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem>
                      <SelectItem value="MM/dd/yyyy">MM/dd/yyyy</SelectItem>
                      <SelectItem value="yyyy-MM-dd">yyyy-MM-dd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Moeda</Label>
                  <Select value={settings.currency} onValueChange={v => set('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            {isAdmin && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4 text-gray-400" /> Retenção de dados</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Retenção de pagamentos (dias)</Label>
                    <Input type="number" value={settings.dataRetentionDays} onChange={e => set('dataRetentionDays', e.target.value)} />
                    <p className="text-xs text-gray-400">Dados mais antigos serão arquivados automaticamente</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700">⚠️ Alterações nas políticas de retenção são irreversíveis. Consulte o administrador antes de modificar.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* APARÊNCIA */}
        {activeTab === 'aparencia' && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Tema</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {['light', 'dark'].map(t => (
                    <button key={t} onClick={() => set('theme', t)}
                      className={cn('p-4 rounded-xl border-2 text-left transition-all', settings.theme === t ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300')}>
                      <div className={cn('w-full h-12 rounded-lg mb-2', t === 'light' ? 'bg-gray-100' : 'bg-gray-800')} />
                      <p className="text-sm font-medium">{t === 'light' ? 'Claro' : 'Escuro'}</p>
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor principal</Label>
                  <div className="flex gap-2 flex-wrap">
                    {['indigo', 'blue', 'green', 'purple', 'red', 'orange'].map(c => (
                      <button key={c} onClick={() => set('primaryColor', c)}
                        className={cn('w-8 h-8 rounded-full transition-all ring-2 ring-offset-2', `bg-${c}-500`, settings.primaryColor === c ? `ring-${c}-500` : 'ring-transparent')} />
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={settings.compactMode} onChange={e => set('compactMode', e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded" />
                  <div>
                    <p className="text-sm font-medium">Modo compacto</p>
                    <p className="text-xs text-gray-400">Reduz o espaçamento da interface</p>
                  </div>
                </label>
              </CardContent>
            </Card>
          </div>
        )}

        {/* INTEGRAÇÕES */}
        {activeTab === 'integracoes' && isAdmin && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Slack</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-500">Envie notificações automáticas para um canal Slack.</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Webhook URL do Slack</Label>
                  <Input value={settings.slackWebhook} onChange={e => set('slackWebhook', e.target.value)} placeholder="https://hooks.slack.com/services/..." />
                </div>
                <Button variant="outline" size="sm" className="gap-2">Testar ligação</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Webhooks externos</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-500">Receba eventos da plataforma num endpoint externo.</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL do Webhook</Label>
                  <Input value={settings.webhookUrl} onChange={e => set('webhookUrl', e.target.value)} placeholder="https://meu-sistema.com/webhook" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Eventos a enviar</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Novo motorista', 'Pagamento processado', 'Documento vencido', 'Candidatura nova'].map(ev => (
                      <label key={ev} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" defaultChecked />
                        {ev}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* PERMISSÕES */}
        {activeTab === 'permissoes' && isAdmin && (
          <Card>
            <CardHeader><CardTitle className="text-base">Matriz de permissões por role</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500">Módulo</th>
                      {Object.entries(ROLE_PERMISSIONS).map(([role, cfg]) => (
                        <th key={role} className="py-2 px-3">
                          <Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(PERM_LABELS).map(([module, label]) => (
                      <tr key={module} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-700">{label}</td>
                        {Object.entries(ROLE_PERMISSIONS).map(([role, cfg]) => {
                          const perms = cfg.permissions[module] || [];
                          return (
                            <td key={role} className="py-3 px-3 text-center">
                              {perms.length === 0 ? (
                                <span className="text-gray-300 text-lg">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {perms.map(p => (
                                    <span key={p} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">{ACTION_LABELS[p]}</span>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-4">As permissões são aplicadas automaticamente pela plataforma com base no role atribuído ao utilizador.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}