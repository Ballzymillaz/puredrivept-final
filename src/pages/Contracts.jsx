import React from 'react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

export default function Contracts() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400 gap-4">
      <FileText className="w-12 h-12 opacity-30" />
      <p className="text-lg font-medium text-gray-500">Módulo de Contratos desativado</p>
      <p className="text-sm text-gray-400">O sistema de contratos foi removido. Use a página de Motoristas para gerir os acordos.</p>
      <Link to={createPageUrl('Drivers')} className="text-indigo-600 hover:underline text-sm">Ir para Motoristas →</Link>
    </div>
  );
}