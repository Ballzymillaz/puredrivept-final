import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, XCircle, Plus, Trash2, Mail } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

const TYPE_CONFIG = {
  info: { icon: Info, color: 'bg-blue-100 text-blue-700', label: 'Info' },
  warning: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700', label: 'Aviso' },
  alert: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Alerta' },
  success: { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: 'Sucesso' },
};

const CATEGORY_LABELS = {
  document_expiry: 'Vencimento documentos',
  maintenance: 'Manutenção',
  payment: 'Pagamento',
  driver_performance: 'Performance motorista',
  vehicle: 'Veículo',
  general: 'Geral',
};

export default function Notifications({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState({ title: '', message: '', type: 'info', category: 'general', recipient_role: 'all', send_email: false });
  const qc = useQueryClient();

  const isAdmin = currentUser?.role?.includes('admin');
  const myEmail = currentUser?.email;

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Notification.create({ ...d, read_by: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); setShowForm(false); setForm({ title: '', message: '', type: 'info', category: 'general', recipient_role: 'all', send_email: false }); },
  });
  const markReadMutation = useMutation({
    mutationFn: (n) => base44.entities.Notification.update(n.id, { read_by: [...(n.read_by || []), myEmail] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = myNotifications.filter(n => !n.read_by?.includes(myEmail));
      for (const n of unread) {
        await base44.entities.Notification.update(n.id, { read_by: [...(n.read_by || []), myEmail] });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markUnreadMutation = useMutation({
    mutationFn: (n) => base44.entities.Notification.update(n.id, { read_by: (n.read_by || []).filter(e => e !== myEmail) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      for (const n of myNotifications) {
        await base44.entities.Notification.delete(n.id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Filter notifications visible to this user
  const myNotifications = useMemo(() => {
    const roles = currentUser?.role ? currentUser.role.split(',').map(r => r.trim()) : [];
    return notifications.filter(n => {
      if (isAdmin) return true;
      if (n.recipient_email === myEmail) return true;
      if (n.recipient_role === 'all') return true;
      if (roles.includes(n.recipient_role)) return true;
      return false;
    });
  }, [notifications, isAdmin, myEmail, currentUser]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return myNotifications.filter(n => !n.read_by?.includes(myEmail));
    if (filter === 'all') return myNotifications;
    return myNotifications.filter(n => n.type === filter);
  }, [myNotifications, filter, myEmail]);

  const unreadCount = myNotifications.filter(n => !n.read_by?.includes(myEmail)).length;

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notificações"
        subtitle={unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo lido'}
        actionLabel={isAdmin ? 'Nova notificação' : undefined}
        onAction={isAdmin ? () => setShowForm(true) : undefined}
        actionIcon={Plus}
      >
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} className="gap-1.5">
              <CheckCheck className="w-4 h-4" /> Marcar tudo como lido
            </Button>
          )}
          {isAdmin && myNotifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => { if (confirm('Limpar todas as notificações?')) clearAllMutation.mutate(); }} className="gap-1.5 text-red-500 hover:text-red-600 border-red-200">
              <Trash2 className="w-4 h-4" /> Limpar tudo
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'unread', 'alert', 'warning', 'info', 'success'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {f === 'all' ? 'Todas' : f === 'unread' ? `Não lidas (${unreadCount})` : TYPE_CONFIG[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center py-8 text-sm text-gray-400">A carregar...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma notificação</p>
            </div>
          ) : (
            filtered.map(n => {
              const isRead = n.read_by?.includes(myEmail);
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <div key={n.id} className={`flex items-start gap-4 p-4 border-b last:border-0 transition-colors ${isRead ? 'bg-white' : 'bg-indigo-50/40'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-medium ${isRead ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</p>
                      {!isRead && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{n.message}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Badge className={`${cfg.color} border-0 text-[10px]`}>{cfg.label}</Badge>
                      <span>{CATEGORY_LABELS[n.category] || n.category}</span>
                      <span>·</span>
                      <span>{n.created_date ? format(new Date(n.created_date), 'dd/MM/yyyy HH:mm') : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isRead && (
                      <button onClick={() => markReadMutation.mutate(n)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Marcar como lida">
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => { if (confirm('Eliminar?')) deleteMutation.mutate(n.id); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Create notification dialog */}
      {isAdmin && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova notificação</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label className="text-xs">Mensagem *</Label><Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Destinatário</Label>
                  <Select value={form.recipient_role} onValueChange={v => setForm(f => ({ ...f, recipient_role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                      <SelectItem value="driver">Motoristas</SelectItem>
                      <SelectItem value="fleet_manager">Gestores de frota</SelectItem>
                      <SelectItem value="commercial">Comerciais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email específico (opcional)</Label>
                  <Input value={form.recipient_email || ''} onChange={e => setForm(f => ({ ...f, recipient_email: e.target.value }))} placeholder="user@email.com" type="email" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="send_email" checked={form.send_email} onChange={e => setForm(f => ({ ...f, send_email: e.target.checked })) } className="rounded" />
                <label htmlFor="send_email" className="text-xs text-gray-600 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Enviar email de notificação</label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'A enviar...' : 'Criar notificação'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}