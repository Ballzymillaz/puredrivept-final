import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Paperclip, Send, Check, CheckCheck } from 'lucide-react';

export default function ConversationDetail({ conversation, currentUser, onConversationUpdate }) {
  const [messageText, setMessageText] = useState('');
  const [files, setFiles] = useState([]);
  const scrollRef = useRef(null);
  const qc = useQueryClient();

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', conversation?.id],
    queryFn: async () => {
      const allMessages = await base44.entities.Message.list();
      return allMessages
        .filter(m => m.conversation_id === conversation.id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    },
    refetchInterval: 2000,
    enabled: !!conversation?.id,
  });

  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (content) => {
      return await base44.entities.Message.create({
        conversation_id: conversation.id,
        sender_id: currentUser.email,
        sender_name: currentUser.full_name,
        sender_role: currentUser.role,
        content,
        read_by: [currentUser.email],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', conversation.id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setMessageText('');
      setFiles([]);
    },
  });

  // Mark messages as read
  useEffect(() => {
    const markAsRead = async () => {
      const unreadMessages = messages.filter(
        m => m.sender_id !== currentUser.email && !m.read_by?.includes(currentUser.email)
      );

      for (const msg of unreadMessages) {
        const readBy = [...(msg.read_by || []), currentUser.email];
        await base44.entities.Message.update(msg.id, { read_by: readBy });
      }

      if (unreadMessages.length > 0) {
        qc.invalidateQueries({ queryKey: ['messages', conversation.id] });
      }
    };

    markAsRead();
  }, [messages, currentUser.email, conversation.id, qc]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (messageText.trim()) {
      createMessageMutation.mutate(messageText);
    }
  };

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files || []);
    for (const file of uploadedFiles) {
      const fileUrl = await base44.integrations.Core.UploadFile({ file });
      setFiles(prev => [...prev, fileUrl.file_url]);
    }
  };

  const otherParticipant = conversation.participants?.find(p => p !== currentUser.email);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <h3 className="font-semibold text-gray-900">{conversation.participant_names}</h3>
        <p className="text-xs text-gray-500">{otherParticipant}</p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => {
            const isOwn = message.sender_id === currentUser.email;
            const isRead = message.read_by?.length > 1;

            return (
              <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    isOwn ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {!isOwn && <p className="text-xs font-semibold opacity-70 mb-1">{message.sender_name}</p>}
                  <p className="text-sm break-words">{message.content}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <p className="text-xs opacity-70">
                      {new Date(message.created_date).toLocaleTimeString('pt-PT', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {isOwn && (
                      <span className={isRead ? 'text-blue-400' : ''}>
                        {isRead ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Files preview */}
      {files.length > 0 && (
        <div className="border-t p-3 flex gap-2 flex-wrap">
          {files.map((file, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              📎 Ficheiro {idx + 1}
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Escreva uma mensagem..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 text-sm"
          />
          <label className="cursor-pointer">
            <Paperclip className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              multiple
            />
          </label>
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || createMessageMutation.isPending}
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}