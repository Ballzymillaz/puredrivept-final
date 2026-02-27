import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, Save, Upload, FileText, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DriverDetail() {
  const navigate = useNavigate();
  const { driverId } = useParams();
  const queryClient = useQueryClient();
  
  const [vehicleData, setVehicleData] = useState({
    license_plate: '',
    brand: '',
    model: '',
    first_registration_date: '',
  });
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch driver
  const { data: driver, isLoading: driverLoading } = useQuery({
    queryKey: ['driver', driverId],
    queryFn: async () => {
      const drivers = await base44.entities.Driver.list();
      return drivers.find(d => d.id === driverId);
    },
  });

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  // Fetch assigned vehicle if exists
  const assignedVehicle = driver?.assigned_vehicle_id 
    ? vehicles.find(v => v.id === driver.assigned_vehicle_id)
    : null;

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', driver?.email],
    queryFn: () => base44.entities.Document.filter({ driver_email: driver?.email }) || [],
    enabled: !!driver?.email,
  });

  // Update vehicle mutation
  const updateVehicleMutation = useMutation({
    mutationFn: async (data) => {
      if (assignedVehicle) {
        await base44.entities.Vehicle.update(assignedVehicle.id, data);
      } else {
        const newVehicle = await base44.entities.Vehicle.create({
          ...data,
          fleet_manager_id: driver?.fleet_manager_id,
          assigned_driver_id: driver?.id,
          assigned_driver_name: driver?.full_name,
          status: 'assigned',
        });
        await base44.entities.Driver.update(driver.id, { 
          assigned_vehicle_id: newVehicle.id,
          assigned_vehicle_plate: data.license_plate,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setEditingVehicle(false);
      setVehicleData({
        license_plate: '',
        brand: '',
        model: '',
        first_registration_date: '',
      });
    },
  });

  // Document upload mutation
  const uploadDocumentMutation = useMutation({
   mutationFn: async ({ file, docType }) => {
     const { file_url } = await base44.integrations.Core.UploadFile({ file });
     if (!file_url) throw new Error('Falha ao fazer upload do ficheiro');

     await base44.entities.Document.create({
       doc_type: docType,
       driver_email: driver?.email,
       driver_id: driver?.id,
       file_url,
       status: 'pending',
     });
   },
   onSuccess: () => {
     queryClient.invalidateQueries({ queryKey: ['documents', driver?.email] });
   },
   onError: (error) => {
     console.error('Erro ao fazer upload do documento:', error);
   },
  });

  // Document delete mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: (docId) => base44.entities.Document.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', driver?.email] });
    },
  });

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files?.[0];
    if (file && driver?.email) {
      uploadDocumentMutation.mutate({ file, docType });
    }
    e.target.value = '';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const DOC_TYPES = [
    { value: 'driving_license', label: 'Carta de Condução' },
    { value: 'id_card', label: 'CC/Passaporte' },
    { value: 'tvde_certificate', label: 'Certificado TVDE' },
    { value: 'iban_proof', label: 'Comprovativo IBAN' },
    { value: 'insurance', label: 'Seguro' },
    { value: 'inspection', label: 'Inspeção' },
  ];

  // Initialize form with existing vehicle data
  React.useEffect(() => {
    if (assignedVehicle && editingVehicle) {
      setVehicleData({
        license_plate: assignedVehicle.license_plate || '',
        brand: assignedVehicle.brand || '',
        model: assignedVehicle.model || '',
        first_registration_date: assignedVehicle.first_registration_date || '',
      });
    }
  }, [assignedVehicle, editingVehicle]);

  const handleSaveVehicle = (e) => {
    e.preventDefault();
    if (!vehicleData.license_plate || !vehicleData.brand || !vehicleData.model) {
      return;
    }
    updateVehicleMutation.mutate(vehicleData);
  };

  if (driverLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">A carregar...</div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Motorista não encontrado</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button 
        variant="ghost" 
        onClick={() => navigate(createPageUrl('Drivers'))}
        className="gap-2 text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Button>

      <PageHeader 
        title={driver.full_name} 
        subtitle={driver.email}
      />

      {/* Driver Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações do Motorista</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div>
            <Label className="text-xs text-gray-500">Nome completo</Label>
            <p className="font-medium mt-1">{driver.full_name}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Email</Label>
            <p className="font-medium mt-1">{driver.email}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Telefone</Label>
            <p className="font-medium mt-1">{driver.phone || '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">NIF</Label>
            <p className="font-medium mt-1">{driver.nif || '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Tipo de contrato</Label>
            <p className="font-medium mt-1">{driver.contract_type || '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Estado</Label>
            <p className="font-medium mt-1 capitalize">{driver.status}</p>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Veículo Atribuído</CardTitle>
        </CardHeader>
        <CardContent>
          {editingVehicle ? (
            <form onSubmit={handleSaveVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Matrícula *</Label>
                  <Input
                    value={vehicleData.license_plate}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, license_plate: e.target.value }))}
                    placeholder="AA-00-AA"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Marca *</Label>
                  <Input
                    value={vehicleData.brand}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="ex. Toyota"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Modelo *</Label>
                  <Input
                    value={vehicleData.model}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="ex. Prius"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Primeira Matrícula</Label>
                  <Input
                    type="date"
                    value={vehicleData.first_registration_date}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, first_registration_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setEditingVehicle(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={updateVehicleMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  <Save className="w-4 h-4" />
                  Guardar veículo
                </Button>
              </div>
            </form>
          ) : assignedVehicle ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-xs text-gray-500">Matrícula</Label>
                  <p className="font-medium mt-1">{assignedVehicle.license_plate}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Marca</Label>
                  <p className="font-medium mt-1">{assignedVehicle.brand}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Modelo</Label>
                  <p className="font-medium mt-1">{assignedVehicle.model}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Primeira Matrícula</Label>
                  <p className="font-medium mt-1">{assignedVehicle.first_registration_date || '—'}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={() => setEditingVehicle(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Editar veículo
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Nenhum veículo atribuído</p>
              <Button 
                onClick={() => setEditingVehicle(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Atribuir veículo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="flex items-center justify-between flex-row">
          <CardTitle className="text-lg">Documentos</CardTitle>
          <Button
            onClick={() => setShowDocumentUpload(!showDocumentUpload)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            <Upload className="w-4 h-4" />
            Carregar Documento
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showDocumentUpload && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                {DOC_TYPES.map(docType => (
                  <label key={docType.value} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-blue-100 bg-white cursor-pointer transition-colors">
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e, docType.value)}
                      disabled={uploadDocumentMutation.isPending}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-medium text-gray-700">{docType.label}</span>
                  </label>
                ))}
              </div>
              <Button
                onClick={() => setShowDocumentUpload(false)}
                variant="outline"
                size="sm"
                className="mt-3 w-full"
              >
                Fechar
              </Button>
            </div>
          )}

          <div className="border-t pt-4">
            {documents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum documento enviado</p>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => {
                  const docType = DOC_TYPES.find(d => d.value === doc.doc_type);
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{docType?.label || doc.doc_type}</p>
                          <p className="text-xs text-gray-500">Enviado em {doc.created_date ? new Date(doc.created_date).toLocaleDateString('pt-PT') : '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${
                          doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {doc.status === 'approved' ? 'Aprovado' :
                           doc.status === 'rejected' ? 'Rejeitado' :
                           'Pendente'}
                        </Badge>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                        >
                          Ver
                        </a>
                        <button
                          onClick={() => deleteDocumentMutation.mutate(doc.id)}
                          disabled={deleteDocumentMutation.isPending}
                          className="p-1 hover:bg-red-50 rounded text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}