import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Plus, Users, User, Headphones, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Messaging({ currentUser }) {
  const [selectedConv, setSelectedConv] = useState(null);
  const [message, setMessage] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [newForm, setNewForm] = useState({ type: 'direct', title: '', participants: [] });
  const messagesEndRef = useRef(null);
  const qc = useQueryClient();
  const userRoles = currentUser?.role ? currentUser.role.split(',').map(r => r.trim()) : [];
  const isAdmin = userRoles.includes('admin');
  const isFleet = userRoles.includes('fleet_manager');
  const isDriver = userRoles.includes('driver') && !isAdmin && !isFleet;

  const { data: conversations = [], isLoading: convLoading } = useQuery({
    queryKey: ['conversations', currentUser?.email],
    queryFn: async () => {
      const all = await base44.entities.Conversation.list('-last_message_at');
      // Show only conversations where user is participant
      return all.filter(c =>
        isAdmin ||
        (c.participants && c.participants.includes(currentUser?.email)) ||
        c.created_by === currentUser?.email
      );
    },
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedConv?.id],
    queryFn: () => base44.entities.Message.filter({ conversation_id: selectedConv.id }, 'created_date'),
    enabled: !!selectedConv,
    refetchInterval: 3000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });
  const { data: fleetManagers = [] } = useQuery({
    queryKey: ['fleetManagers'],
    queryFn: () => base44.entities.FleetManager.list(),
  });

  // Participants list filtered by role:
  // admin → all users; fleet_manager → their affiliated drivers; commercial → n/a
  const allUsers = useMemo(() => {
    const u = [];
    if (isAdmin) {
      drivers.forEach(d => { if (d.email) u.push({ email: d.email, name: d.full_name, role: 'driver' }); });
      fleetManagers.forEach(f => { if (f.email) u.push({ email: f.email, name: f.full_name, role: 'fleet_manager' }); });
    } else if (isFleet) {
      // Find this fleet manager's record
      const myFM = fleetManagers.find(f => f.email === currentUser?.email);
      // Only their affiliated drivers
      const myDrivers = myFM ? drivers.filter(d => d.fleet_manager_id === myFM.id) : [];
      myDrivers.forEach(d => { if (d.email) u.push({ email: d.email, name: d.full_name, role: 'driver' }); });
    }
    return u;
  }, [drivers, fleetManagers, isAdmin, isFleet, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when conv selected
  useEffect(() => {
    if (!selectedConv || !currentUser?.email) return;
    const unread = messages.filter(m => !m.read_by?.includes(currentUser.email) && m.sender_id !== currentUser.email);
    unread.forEach(m => {
      base44.entities.Message.update(m.id, { read_by: [...(m.read_by || []), currentUser.email] });
    });
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
      return base44.entities.Conversation.update(selectedConv.id, {
        last_message: content.slice(0, 80),
        last_message_at: new Date().toISOString(),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages', selectedConv.id] }); qc.invalidateQueries({ queryKey: ['conversations'] }); },
  });

  const createConvMutation = useMutation({
    mutationFn: async (data) => {
      // Add current user to participants
      const parts = [...new Set([currentUser.email, ...data.participants])];
      return base44.entities.Conversation.create({
        ...data,
        participants: parts,
        created_by: currentUser.email,
        last_message_at: new Date().toISOString(),
      });
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setShowNew(false);
      setSelectedConv(conv);
    },
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
      participant_names: newForm.participants
        .map(email => allUsers.find(u => u.email === email)?.name || email)
        .join(', '),
    });
  };

  // Contact support shortcut for drivers
  const handleContactSupport = async () => {
    // Find or create support conversation
    const existing = conversations.find(c => c.type === 'support' && c.participants?.includes(currentUser?.email));
    if (existing) { setSelectedConv(existing); return; }
    const conv = await createConvMutation.mutateAsync({
      title: `Suporte — ${currentUser.full_name}`,
      type: 'support',
      participants: [currentUser.email],
    });
    setSelectedConv(conv);
  };

  const filteredConvs = conversations.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

  const unreadCount = (conv) => {
    // Simplified: just show if last message not from me
    return 0; // Could be enhanced with proper read tracking
  };

  const TYPE_ICONS = {
    direct: <User className="w-3.5 h-3.5" />,
    group: <Users className="w-3.5 h-3.5" />,
    support: <Headphones className="w-3.5 h-3.5" />,
  };

  const TYPE_COLORS = {
    direct: 'bg-blue-100 text-blue-700',
    group: 'bg-purple-100 text-purple-700',
    support: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mensagens</h1>
          <p className="text-sm text-gray-500">Comunicação interna</p>
        </div>
        <div className="flex gap-2">
          {(isAdmin || isFleet) && (
            <Button onClick={() => setShowNew(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
              <Plus className="w-4 h-4" /> Nova conversa
            </Button>
          )}
          {isDriver && (
            <Button onClick={handleContactSupport} variant="outline" className="gap-2">
              <Headphones className="w-4 h-4" /> Contactar suporte
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 rounded-xl border overflow-hidden bg-white shadow-sm min-h-0">
        {/* Sidebar: conversation list */}
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
                  <button onClick={handleContactSupport} className="mt-3 text-sm text-indigo-600 hover:underline">
                    Contactar suporte
                  </button>
                )}
              </div>
            ) : (
              filteredConvs.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors',
                    selectedConv?.id === conv.id && 'bg-indigo-50 border-l-2 border-l-indigo-500'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn('text-[10px] px-1.5 py-0 border-0 gap-1', TYPE_COLORS[conv.type])}>
                      {TYPE_ICONS[conv.type]}
                      {conv.type === 'direct' ? 'Direto' : conv.type === 'group' ? 'Grupo' : 'Suporte'}
                    </Badge>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {format(new Date(conv.last_message_at), 'dd/MM HH:mm')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{conv.title}</p>
                  {conv.last_message && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', TYPE_COLORS[selectedConv.type])}>
                  {TYPE_ICONS[selectedConv.type]}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{selectedConv.title}</p>
                  {selectedConv.participant_names && (
                    <p className="text-xs text-gray-500">{selectedConv.participant_names}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">Sem mensagens ainda. Comece a conversa!</p>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_id === currentUser?.email;
                    return (
                      <div key={msg.id} className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1',
                          msg.sender_role === 'admin' ? 'bg-indigo-600' :
                          msg.sender_role === 'fleet_manager' ? 'bg-purple-500' :
                          msg.sender_role === 'driver' ? 'bg-emerald-500' : 'bg-gray-400'
                        )}>
                          {(msg.sender_name || msg.sender_id || '?')[0]?.toUpperCase()}
                        </div>
                        <div className={cn('max-w-xs lg:max-w-md', isMe ? 'items-end' : 'items-start', 'flex flex-col')}>
                          {!isMe && <p className="text-[10px] text-gray-500 mb-1">{msg.sender_name}</p>}
                          <div className={cn('px-3 py-2 rounded-2xl text-sm',
                            isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                          )}>
                            {msg.content}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {format(new Date(msg.created_date), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Escrever uma mensagem..."
                  className="flex-1"
                  autoFocus
                />
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
                <p className="text-sm text-gray-400 mt-1">ou crie uma nova para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova conversa</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateConv} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={newForm.type} onValueChange={v => setNewForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Mensagem direta</SelectItem>
                  <SelectItem value="group">Grupo</SelectItem>
                  <SelectItem value="support">Suporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título / Nome</Label>
              <Input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} required placeholder="Ex: Equipa Semana 10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Participantes</Label>
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {allUsers.map(u => (
                  <label key={u.email} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={newForm.participants.includes(u.email)}
                      onChange={e => {
                        setNewForm(f => ({
                          ...f,
                          participants: e.target.checked
                            ? [...f.participants, u.email]
                            : f.participants.filter(p => p !== u.email)
                        }));
                      }}
                      className="rounded"
                    />
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.role === 'driver' ? 'Motorista' : 'Gestor de frota'} · {u.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNew(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={createConvMutation.isPending || !newForm.title} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                Criar conversa
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}