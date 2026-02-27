import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Zap, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AutoAssignDialog({ open, onClose, drivers, vehicles, preselectedVehicleId, preselectedDriverId, onSuccess }) {
  const [driverId, setDriverId] = useState(preselectedDriverId || '');
  const [vehicleId, setVehicleId] = useState(preselectedVehicleId || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const availableDrivers = drivers.filter(d => !d.assigned_vehicle_id || d.id === driverId);
  const availableVehicles = vehicles.filter(v => v.status === 'available' || v.id === vehicleId);

  const handleAssign = async () => {
    if (!driverId) return;
    setLoading(true);
    const { data } = await base44.functions.invoke('autoAssignVehicle', {
      driver_id: driverId,
      vehicle_id: vehicleId || undefined,
    });
    setLoading(false);
    if (data?.success) {
      setResult(data.vehicle);
      onSuccess?.();
    } else {
      alert(data?.error || 'Erro ao atribuir veículo');
    }
  };

  const handleClose = () => {
    setResult(null);
    setDriverId(preselectedDriverId || '');
    setVehicleId(preselectedVehicleId || '');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" /> Atribuição de Veículo
          </DialogTitle>
        </DialogHeader>
        {result ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-semibold text-green-700">Veículo atribuído com sucesso!</p>
            <p className="text-sm text-gray-600">{result.brand} {result.model} — {result.license_plate}</p>
            <p className="text-xs text-gray-400">Notificações enviadas ao motorista e ao admin. Lembrete para emitir contrato.</p>
            <Button onClick={handleClose} className="bg-indigo-600 hover:bg-indigo-700">Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Selecione o motorista e opcionalmente um veículo específico. Se não selecionar veículo, será atribuído automaticamente com base no tipo de contrato.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Motorista *</Label>
              <Select value={driverId} onValueChange={setDriverId} disabled={!!preselectedDriverId}>
                <SelectTrigger><SelectValue placeholder="Selecionar motorista..." /></SelectTrigger>
                <SelectContent>
                  {availableDrivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name} — {d.contract_type?.replace('_', ' ') || 'sem contrato'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Veículo (opcional — automático se não selecionado)</Label>
              <Select value={vehicleId} onValueChange={setVehicleId} disabled={!!preselectedVehicleId}>
                <SelectTrigger><SelectValue placeholder="Automático..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  {availableVehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} — {v.license_plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
              <strong>Critério automático:</strong> Contratos Slot Black/Premium → veículos híbridos/elétricos em prioridade. Outros → primeiro disponível.
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleAssign} disabled={!driverId || loading} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
                <Zap className="w-3.5 h-3.5" /> {loading ? 'A atribuir...' : 'Atribuir'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}