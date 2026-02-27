import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import ConversationList from '../components/messaging/ConversationList';
import ConversationDetail from '../components/messaging/ConversationDetail';
import BroadcastPanel from '../components/messaging/BroadcastPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Megaphone } from 'lucide-react';

export default function FleetCommunications({ currentUser }) {
  const isFleetManager = currentUser?.role?.includes('fleet_manager');
  const isDriver = currentUser?.role?.includes('driver');
  
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [activeTab, setActiveTab] = useState('messages');

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', currentUser?.email],
    queryFn: async () => {
      const allConversations = await base44.entities.Conversation.list();
      return allConversations.filter(c => c.participants?.includes(currentUser?.email));
    },
    enabled: !!currentUser?.email,
  });

  // Fetch fleet manager data
  const { data: fleetManager } = useQuery({
    queryKey: ['fleet-manager', currentUser?.email],
    queryFn: async () => {
      if (!isFleetManager) return null;
      const managers = await base44.entities.FleetManager.list();
      return managers.find(m => m.email === currentUser?.email);
    },
    enabled: isFleetManager && !!currentUser?.email,
  });

  // Fetch drivers for fleet manager
  const { data: fleetDrivers = [] } = useQuery({
    queryKey: ['fleet-drivers', fleetManager?.id],
    queryFn: async () => {
      if (!fleetManager?.id) return [];
      const allDrivers = await base44.entities.Driver.list();
      return allDrivers.filter(d => d.fleet_manager_id === fleetManager.id);
    },
    enabled: !!fleetManager?.id,
  });

  if (!isFleetManager && !isDriver) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Acesso restrito a gestores de frota e motoristas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comunicações da Frota"
        subtitle="Gestão de mensagens e comunicados"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Mensagens ({conversations.length})
          </TabsTrigger>
          {isFleetManager && (
            <TabsTrigger value="broadcast" className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Comunicados
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="messages" className="mt-6">
          <div className="grid grid-cols-3 gap-6 h-[600px]">
            {/* Conversation List */}
            <div className="col-span-1 border rounded-lg overflow-hidden flex flex-col bg-white">
              <ConversationList
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={setSelectedConversation}
                currentUser={currentUser}
                fleetManager={fleetManager}
                fleetDrivers={fleetDrivers}
              />
            </div>

            {/* Conversation Detail */}
            <div className="col-span-2 border rounded-lg overflow-hidden flex flex-col bg-white">
              {selectedConversation ? (
                <ConversationDetail
                  conversation={selectedConversation}
                  currentUser={currentUser}
                  onConversationUpdate={(updated) => setSelectedConversation(updated)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>Selecione uma conversa para começar</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {isFleetManager && (
          <TabsContent value="broadcast" className="mt-6">
            <BroadcastPanel
              fleetManager={fleetManager}
              fleetDrivers={fleetDrivers}
              currentUser={currentUser}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}