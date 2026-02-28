import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Plus, Users, User, Headphones, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const TYPE_ICONS = { direct: <User className="w-3.5 h-3.5" />, group: <Users className="w-3.5 h-3.5" />, support: <Headphones className="w-3.5 h-3.5" /> };
const TYPE_COLORS = { direct: 'bg-blue-100 text-blue-700', group: 'bg-purple-100 text-purple-700', support: 'bg-orange-100 text-orange-700' };
const TYPE_LABEL = { direct: 'Direto', group: 'Grupo', support: 'Suporte' };

export default function Messaging({ currentUser }) {
  const [selectedConv, setSelectedConv] = useState(null);
  const [message, setMessage] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [newForm, setNewForm] = useState({ type: 'direct', title: '', participants: [] });
  const messagesEndRef = useRef(null);
  const qc = useQueryClient();

  const isAdmin = currentUser?.role === 'admin';
  const isFleet = currentUser?.role === 'fleet_manager';
  const isDriver = currentUser?.role === 'driver';

  // Data fetching
  const { data: allDrivers = [] } = useQuery({ queryKey: ['drivers'], queryFn: () => base44.entities.Driver.list() });
  const { data: fleetManagers = [] } = useQuery({ queryKey: ['fleet-managers'], queryFn: () => base44.entities.FleetManager.list() });
  const { data: conversations = [], isLoading: convLoading } = useQuery({
    queryKey: ['conversations', currentUser?.email],
    queryFn: async () => {
      const all = await base44.entities.Conversation.list('-last_message_at');
      if (isAdmin) return all;
      return all.filter(c => c.participants?.includes(currentUser?.email) || c.created_by === currentUser?.email);
    },
    refetchInterval: 5000,
    enabled: !!currentUser?.email,
  });
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedConv?.id],
    queryFn: () => base44.entities.Message.filter({ conversation_id: selectedConv.id }, 'created_date'),
    enabled: !!selectedConv?.id,
    refetchInterval: 3000,
  });

  // Resolve current user's fleet manager record / driver record
  const myFleetManager = useMemo(() => isFleet ? fleetManagers.find(f => f.email === currentUser?.email || f.user_id === currentUser?.id) : null, [fleetManagers, currentUser, isFleet]);
  const myDriverRecord = useMemo(() => isDriver ? allDrivers.find(d => d.email === currentUser?.email) : null, [allDrivers, currentUser, isDriver]);

  // Contacts available for creating conversations — strictly scoped
  const availableContacts = useMemo(() => {
    if (isAdmin) {
      const contacts = [];
      allDrivers.forEach(d => { if (d.email && d.email !== currentUser?.email) contacts.push({ email: d.email, name: d.full_name, role: 'Motorista' }); });
      fleetManagers.forEach(f => { if (f.email && f.email !== currentUser?.email) contacts.push({ email: f.email, name: f.full_name, role: 'Gestor frota' }); });
      return contacts;
    }
    if (isFleet && myFleetManager) {
      const myDrivers = allDrivers.filter(d => d.fleet_manager_id === myFleetManager.id);
      return myDrivers.filter(d => d.email).map(d => ({ email: d.email, name: d.full_name, role: 'Motorista' }));
    }
    // Driver: can only contact their fleet manager + support (handled separately)
    if (isDriver && myDriverRecord?.fleet_manager_id) {
      const fm = fleetManagers.find(f => f.id === myDriverRecord.fleet_manager_id);
      if (fm?.email) return [{ email: fm.email, name: fm.full_name, role: 'Gestor frota' }];
    }
    return [];
  }, [isAdmin, isFleet, isDriver, allDrivers, fleetManagers, myFleetManager, myDriverRecord, currentUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedConv || !currentUser?.email) return;
    const unread = messages.filter(m => !m.read_by?.includes(currentUser.email) && m.sender_id !== currentUser.email);
    unread.forEach(m => base44.entities.Message.update(m.id, { read_by: [...(m.read_by || []), currentUser.email] }));
  }, [messages, selectedConv, currentUser]);

  const sendMutation = useMutation({
    mutationFn: async (content) => {
      await base44.entities.Message.create({
        conversation_id: selectedConv.id,
        sender_id: currentUser.email,
        sender_name: currentUser.full_name,
        sender_role: currentUser.role,
        content,
        read_by: [currentUser.email],
      });
      return base44.entities.Conversation.update(selectedConv.id, { last_message: content.slice(0, 80), last_message_at: new Date().toISOString() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages', selectedConv.id] }); qc.invalidateQueries({ queryKey: ['conversations'] }); },
  });

  const createConvMutation = useMutation({
    mutationFn: async (data) => {
      const parts = [...new Set([currentUser.email, ...data.participants])];
      return base44.entities.Conversation.create({ ...data, participants: parts, created_by: currentUser.email, last_message_at: new Date().toISOString() });
    },
    onSuccess: (conv) => { qc.invalidateQueries({ queryKey: ['conversations'] }); setShowNew(false); setSelectedConv(conv); setNewForm({ type: 'direct', title: '', participants: [] }); },
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
    setMessage('');
  };

  const handleCreateConv = (e) => {
    e.preventDefault();
    createConvMutation.mutate({
      title: newForm.title,
      type: newForm.type,
      participants: newForm.participants,
      participant_names: newForm.participants.map(email => availableContacts.find(u => u.email === email)?.name || email).join(', '),
    });
  };

  // Contact support: find or create support conversation
  const handleContactSupport = async () => {
    const existing = conversations.find(c => c.type === 'support' && c.participants?.includes(currentUser?.email));
    if (existing) { setSelectedConv(existing); return; }
    // Build support participants: current user + their fleet manager (if driver) + admins won't be in DB but support conv is visible to all admins
    const parts = [currentUser.email];
    if (isDriver && myDriverRecord?.fleet_manager_id) {
      const fm = fleetManagers.find(f => f.id === myDriverRecord.fleet_manager_id);
      if (fm?.email) parts.push(fm.email);
    }
    const conv = await createConvMutation.mutateAsync({
      title: `Suporte — ${currentUser.full_name}`,
      type: 'support',
      participants: parts,
    });
    setSelectedConv(conv);
  };

  const filteredConvs = conversations.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

  const canCreateGroup = isAdmin || isFleet;
  const canCreateConv = isAdmin || isFleet;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mensagens</h1>
          <p className="text-sm text-gray-500">Comunicação interna</p>
        </div>
        <div className="flex gap-2">
          {canCreateConv && (
            <Button onClick={() => setShowNew(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
              <Plus className="w-4 h-4" /> Nova conversa
            </Button>
          )}
          {isDriver && (
            <Button onClick={handleContactSupport} variant="outline" className="gap-2">
              <Headphones className="w-4 h-4" /> Suporte
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 rounded-xl border overflow-hidden bg-white shadow-sm min-h-0">
        {/* Conversation list */}
        <div className="w-72 border-r flex flex-col shrink-0">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convLoading ? (
              <p className="text-center py-8 text-sm text-gray-400">A carregar...</p>
            ) : filteredConvs.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Sem conversas</p>
                {isDriver && (
                  <button onClick={handleContactSupport} className="mt-3 text-sm text-indigo-600 hover:underline">Contactar suporte</button>
                )}
              </div>
            ) : (
              filteredConvs.map(conv => (
                <button key={conv.id} onClick={() => setSelectedConv(conv)}
                  className={cn('w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors', selectedConv?.id === conv.id && 'bg-indigo-50 border-l-2 border-l-indigo-500')}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn('text-[10px] px-1.5 py-0 border-0 gap-1', TYPE_COLORS[conv.type])}>
                      {TYPE_ICONS[conv.type]}{TYPE_LABEL[conv.type]}
                    </Badge>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-gray-400 ml-auto">{format(new Date(conv.last_message_at), 'dd/MM HH:mm')}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{conv.title}</p>
                  {conv.last_message && <p className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message}</p>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConv ? (
            <>
              <div className="px-4 py-3 border-b flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', TYPE_COLORS[selectedConv.type])}>
                  {TYPE_ICONS[selectedConv.type]}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{selectedConv.title}</p>
                  {selectedConv.participant_names && <p className="text-xs text-gray-500">{selectedConv.participant_names}</p>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">Sem mensagens. Comece a conversa!</p>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_id === currentUser?.email;
                    return (
                      <div key={msg.id} className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1',
                          msg.sender_role === 'admin' ? 'bg-indigo-600' : msg.sender_role === 'fleet_manager' ? 'bg-purple-500' : 'bg-emerald-500')}>
                          {(msg.sender_name || '?')[0]?.toUpperCase()}
                        </div>
                        <div className={cn('max-w-xs lg:max-w-md flex flex-col', isMe ? 'items-end' : 'items-start')}>
                          {!isMe && <p className="text-[10px] text-gray-500 mb-1">{msg.sender_name}</p>}
                          <div className={cn('px-3 py-2 rounded-2xl text-sm', isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm')}>
                            {msg.content}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">{format(new Date(msg.created_date), 'HH:mm')}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
                <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Escrever uma mensagem..." className="flex-1" autoFocus />
                <Button type="submit" disabled={!message.trim() || sendMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Selecione uma conversa</p>
                {isDriver && <button onClick={handleContactSupport} className="mt-3 text-sm text-indigo-600 hover:underline">Contactar suporte</button>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation dialog */}
      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) setNewForm({ type: 'direct', title: '', participants: [] }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova conversa</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateConv} className="space-y-4">
            {/* Type selector — only admin/fleet can create groups */}
            <div className="flex gap-2">
              <button type="button" onClick={() => setNewForm(f => ({ ...f, type: 'direct' }))}
                className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors', newForm.type === 'direct' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
                <User className="w-4 h-4 inline mr-1.5" />Direto
              </button>
              {canCreateGroup && (
                <button type="button" onClick={() => setNewForm(f => ({ ...f, type: 'group' }))}
                  className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors', newForm.type === 'group' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
                  <Users className="w-4 h-4 inline mr-1.5" />Grupo
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} required placeholder={newForm.type === 'group' ? 'Nome do grupo' : 'Assunto'} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Participantes {newForm.type === 'direct' ? '(selecione 1)' : ''}</Label>
              {availableContacts.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">Nenhum contacto disponível</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {availableContacts.map(u => (
                    <label key={u.email} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input type={newForm.type === 'direct' ? 'radio' : 'checkbox'}
                        name="participant"
                        checked={newForm.participants.includes(u.email)}
                        onChange={e => {
                          if (newForm.type === 'direct') {
                            setNewForm(f => ({ ...f, participants: e.target.checked ? [u.email] : [] }));
                          } else {
                            setNewForm(f => ({ ...f, participants: e.target.checked ? [...f.participants, u.email] : f.participants.filter(p => p !== u.email) }));
                          }
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowNew(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={createConvMutation.isPending || !newForm.title || newForm.participants.length === 0} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                {createConvMutation.isPending ? 'A criar...' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}