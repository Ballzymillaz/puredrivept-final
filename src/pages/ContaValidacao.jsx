import React from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ContaValidacao() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Clock className="w-10 h-10 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Conta em validação</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            A sua candidatura foi recebida e está a ser analisada pela nossa equipa.
            Receberá um email assim que a sua conta for ativada.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-2">
          <p className="text-sm font-medium text-amber-800">O que acontece a seguir?</p>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• A equipa PureDrive irá analisar a sua candidatura</li>
            <li>• Será contactado por email ou telefone</li>
            <li>• Após validação, terá acesso completo à plataforma</li>
          </ul>
        </div>
        <Button
          variant="outline"
          className="gap-2 w-full"
          onClick={() => base44.auth.logout()}
        >
          <LogOut className="w-4 h-4" /> Sair
        </Button>
      </div>
    </div>
  );
}