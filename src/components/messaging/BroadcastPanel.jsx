import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Paperclip, Send, AlertCircle } from 'lucide-react';

export default function BroadcastPanel({ fleetManager, fleetDrivers, currentUser }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [success, setSuccess] = useState(false);
  const qc = useQueryClient();

  const createBroadcastMutation = useMutation({
    mutationFn: async () => {
      // Create group conversation if not exists
      const conversationTitle = `Comunicado: ${title}`;
      const groupConv = await base44.entities.Conversation.create({
        title: conversationTitle,
        type: 'group',
        participants: [currentUser.email, ...fleetDrivers.map(d => d.email)],
        participant_names: `Comunicado para ${fleetDrivers.length} motoristas`,
        created_by: currentUser.email,
        fleet_manager_id: fleetManager.id,
      });

      // Create message to all participants
      const message = await base44.entities.Message.create({
        conversation_id: groupConv.id,
        sender_id: currentUser.email,
        sender_name: currentUser.full_name,
        sender_role: currentUser.role,
        content: `📢 **${title}**\n\n${content}`,
        read_by: [currentUser.email],
      });

      return { conversation: groupConv, message };
    },
    onSuccess: () => {
      setSuccess(true);
      setTitle('');
      setContent('');
      setFiles([]);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setTimeout(() => setSuccess(false), 5000);
    },
  });

  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files || []);
    for (const file of uploadedFiles) {
      const fileUrl = await base44.integrations.Core.UploadFile({ file });
      setFiles(prev => [...prev, fileUrl.file_url]);
    }
  };

  const handleSendBroadcast = () => {
    if (title.trim() && content.trim() && fleetDrivers.length > 0) {
      createBroadcastMutation.mutate();
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Editor */}
      <div className="col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo comunicado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {success && (
              <Alert className="border-emerald-200 bg-emerald-50">
                <AlertCircle className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700">
                  Comunicado enviado com sucesso para {fleetDrivers.length} motoristas
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assunto</label>
              <Input
                placeholder="Título do comunicado..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
              <Textarea
                placeholder="Escreva o comunicado..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-40 text-sm"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Ficheiros anexados</label>
                <div className="flex gap-2 flex-wrap">
                  {files.map((file, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      📎 Ficheiro {idx + 1}
                      <button
                        onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                        className="ml-2 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <label className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 cursor-pointer text-sm text-gray-600">
                <Paperclip className="w-4 h-4" />
                Anexar ficheiro
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  multiple
                />
              </label>
              <Button
                onClick={handleSendBroadcast}
                disabled={!title.trim() || !content.trim() || createBroadcastMutation.isPending}
                className="ml-auto gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="w-4 h-4" />
                Enviar para {fleetDrivers.length} motorista{fleetDrivers.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-600 uppercase font-semibold">Assunto</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{title || 'Sem título'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase font-semibold">Mensagem</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                {content || 'Sem conteúdo'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase font-semibold">Destinatários</p>
              <div className="mt-2 space-y-1">
                {fleetDrivers.slice(0, 5).map((driver) => (
                  <p key={driver.id} className="text-xs text-gray-600">
                    • {driver.full_name}
                  </p>
                ))}
                {fleetDrivers.length > 5 && (
                  <p className="text-xs text-gray-500 italic">
                    ... e {fleetDrivers.length - 5} mais
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}