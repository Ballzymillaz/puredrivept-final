import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, MessageSquare } from 'lucide-react';

export default function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  currentUser,
  fleetManager,
  fleetDrivers,
}) {
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const qc = useQueryClient();

  const createConversationMutation = useMutation({
    mutationFn: async (driverId) => {
      const driver = fleetDrivers.find(d => d.id === driverId);
      const newConv = await base44.entities.Conversation.create({
        title: `Chat com ${driver.full_name}`,
        type: 'direct',
        participants: [currentUser.email, driver.email],
        participant_names: `${currentUser.full_name}, ${driver.full_name}`,
        created_by: currentUser.email,
      });
      return newConv;
    },
    onSuccess: (newConv) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      onSelectConversation(newConv);
      setShowNewDialog(false);
      setSelectedDriver(null);
    },
  });

  const filteredConversations = conversations.filter(c =>
    c.participant_names?.toLowerCase().includes(search.toLowerCase())
  );

  const isFleetManager = fleetManager?.id;

  return (
    <>
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        {isFleetManager && (
          <Button
            onClick={() => setShowNewDialog(true)}
            size="sm"
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Nova conversa
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Nenhuma conversa
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`w-full text-left p-3 rounded-lg transition-colors text-sm ${
                  selectedConversation?.id === conv.id
                    ? 'bg-indigo-100 text-indigo-900'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <p className="font-medium truncate">{conv.participant_names}</p>
                <p className="text-xs opacity-70 truncate">{conv.last_message || 'Sem mensagens'}</p>
                {conv.last_message_at && (
                  <p className="text-xs opacity-50 mt-1">
                    {new Date(conv.last_message_at).toLocaleDateString('pt-PT')}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Selecione um motorista:</p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {fleetDrivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriver(driver.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedDriver === driver.id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-sm">{driver.full_name}</p>
                  <p className="text-xs text-gray-500">{driver.email}</p>
                </button>
              ))}
            </div>
            <Button
              onClick={() => selectedDriver && createConversationMutation.mutate(selectedDriver)}
              disabled={!selectedDriver || createConversationMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              Iniciar conversa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}