import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Bell, CheckCheck, CreditCard, Wrench, FileText, Coins, Settings, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

// Allowed notification types
const NOTIF_TYPES = {
  payment:     { icon: CreditCard, color: 'bg-green-100 text-green-700',  label: 'Pagamento' },
  maintenance: { icon: Wrench,     color: 'bg-orange-100 text-orange-700', label: 'Manutenção' },
  document:    { icon: FileText,   color: 'bg-blue-100 text-blue-700',    label: 'Documento' },
  upi:         { icon: Coins,      color: 'bg-violet-100 text-violet-700', label: 'UPI' },
  system:      { icon: Settings,   color: 'bg-gray-100 text-gray-700',    label: 'Sistema' },
};

const EMPTY_FORM = { title: '', message: '', type: 'system', recipient_scope: 'all', recipient_fleet_id: '', recipient_email: '' };

export default function Notifications({ currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);
  const qc = useQueryClient();

  const isAdmin = currentUser?.role === 'admin';
  const isFleet = currentUser?.role === 'fleet_manager';
  const isDriver = currentUser?.role === 'driver';
  const myEmail = currentUser?.email;

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 200),
  });
  const { data: fleetManagers = [] } = useQuery({ queryKey: ['fleet-managers'], queryFn: () => base44.entities.FleetManager.list(), enabled: isAdmin });
  const { data: allDrivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.list(), enabled: isAdmin || isFleet });

  // Fleet manager record
  const myFleetManager = useMemo(() => isFleet ? fleetManagers.find(f => f.email === myEmail) : null, [fleetManagers, myEmail, isFleet]);
  const myFleetDriverEmails = useMemo(() => {
    if (!isFleet || !myFleetManager) return [];
    return allDrivers.filter(d => d.fleet_manager_id === myFleetManager.id).map(d => d.email).filter(Boolean);
  }, [isFleet, myFleetManager, allDrivers]);

  // Driver record for fleet manager linkage
  const myDriverRecord = useMemo(() => isDriver ? allDrivers.find(d => d.email === myEmail) : null, [isDriver, allDrivers, myEmail]);

  // Notifications visible to current user
  const myNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (isAdmin) return true;
      if (n.recipient_email === myEmail) return true;
      if (n.recipient_scope === 'all') return true;
      if (isFleet && n.recipient_scope === 'fleet_manager') return true;
      if (isDriver && n.recipient_scope === 'driver') return true;
      // Fleet-specific notification: check if driver belongs to the fleet
      if (isDriver && n.recipient_fleet_id && myDriverRecord?.fleet_manager_id === n.recipient_fleet_id) return true;
      return false;
    });
  }, [notifications, isAdmin, isFleet, isDriver, myEmail, myDriverRecord]);

  const filtered = useMemo(() => {
    let base = myNotifications;
    if (filter === 'unread') return base.filter(n => !n.read_by?.includes(myEmail));
    if (filter !== 'all') return base.filter(n => n.type === filter);
    return base;
  }, [myNotifications, filter, myEmail]);

  const unreadCount = myNotifications.filter(n => !n.read_by?.includes(myEmail)).length;

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Notification.create({ ...d, read_by: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); setShowForm(false); setForm(EMPTY_FORM); },
  });
  const markReadMutation = useMutation({
    mutationFn: (n) => base44.entities.Notification.update(n.id, { read_by: [...(n.read_by || []), myEmail] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = myNotifications.filter(n => !n.read_by?.includes(myEmail));
      for (const n of unread) await base44.entities.Notification.update(n.id, { read_by: [...(n.read_by || []), myEmail] });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Fleet manager can only target their own drivers
    let payload = { ...form };
    if (isFleet) {
      payload.recipient_scope = 'fleet';
      payload.recipient_fleet_id = myFleetManager?.id || '';
      payload.recipient_email = '';
    }
    createMutation.mutate(payload);
  };

  const canSend = isAdmin || isFleet;

  return (
    <div className="space-y-4">
      <PageHeader title="Notificações" subtitle={unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo lido'}
        actionLabel={canSend ? 'Nova notificação' : undefined} onAction={canSend ? () => setShowForm(true) : undefined} actionIcon={Plus}>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} className="gap-1.5">
            <CheckCheck className="w-4 h-4" /> Marcar tudo lido
          </Button>
        )}
      </PageHeader>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['all', 'Todas'], ['unread', `Não lidas (${unreadCount})`], ...Object.entries(NOTIF_TYPES).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === k ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

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
              const cfg = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
              const Icon = cfg.icon;
              return (
                <div key={n.id} className={`flex items-start gap-4 p-4 border-b last:border-0 ${isRead ? 'bg-white' : 'bg-indigo-50/40'}`}>
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
                      <span>{n.created_date ? format(new Date(n.created_date), 'dd/MM/yyyy HH:mm') : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isRead && (
                      <button onClick={() => markReadMutation.mutate(n)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Marcar lida">
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

      {/* Create dialog */}
      {canSend && (
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
                    <SelectContent>{Object.entries(NOTIF_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {isAdmin && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Destinatário</Label>
                    <Select value={form.recipient_scope} onValueChange={v => setForm(f => ({ ...f, recipient_scope: v, recipient_fleet_id: '', recipient_email: '' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="driver">Todos os motoristas</SelectItem>
                        <SelectItem value="fleet_manager">Gestores de frota</SelectItem>
                        <SelectItem value="fleet">Por frota</SelectItem>
                        <SelectItem value="individual">Utilizador específico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {isAdmin && form.recipient_scope === 'fleet' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Escolher frota</Label>
                  <Select value={form.recipient_fleet_id} onValueChange={v => setForm(f => ({ ...f, recipient_fleet_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Gestor de frota..." /></SelectTrigger>
                    <SelectContent>{fleetManagers.map(fm => <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {isAdmin && form.recipient_scope === 'individual' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Email do utilizador</Label>
                  <Select value={form.recipient_email} onValueChange={v => setForm(f => ({ ...f, recipient_email: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar motorista..." /></SelectTrigger>
                    <SelectContent>{allDrivers.filter(d => d.email).map(d => <SelectItem key={d.id} value={d.email}>{d.full_name} ({d.email})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {isFleet && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2">Esta notificação será enviada aos seus motoristas.</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'A enviar...' : 'Enviar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}