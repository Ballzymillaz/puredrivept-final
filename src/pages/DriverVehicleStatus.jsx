import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Car, AlertTriangle, Upload, Gauge, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function DriverVehicleStatus({ currentUser }) {
  const [openMileageDialog, setOpenMileageDialog] = useState(false);
  const [openIssueDialog, setOpenIssueDialog] = useState(false);
  const [mileageValue, setMileageValue] = useState('');
  const [issueType, setIssueType] = useState('');
  const [issueSeverity, setIssueSeverity] = useState('medium');
  const [issueDescription, setIssueDescription] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const queryClient = useQueryClient();

  // Fetch current driver
  const { data: driver } = useQuery({
    queryKey: ['currentDriver', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.linked_entity_id) return null;
      return await base44.entities.Driver.get(currentUser.linked_entity_id);
    },
    enabled: !!currentUser?.linked_entity_id,
  });

  // Fetch assigned vehicle
  const { data: assignedVehicle } = useQuery({
    queryKey: ['assignedVehicle', driver?.assigned_vehicle_id],
    queryFn: async () => {
      if (!driver?.assigned_vehicle_id) return null;
      return await base44.entities.Vehicle.get(driver.assigned_vehicle_id);
    },
    enabled: !!driver?.assigned_vehicle_id,
  });

  // Fetch vehicle assignments history
  const { data: assignmentHistory = [] } = useQuery({
    queryKey: ['driverAssignments', driver?.id],
    queryFn: async () => {
      if (!driver?.id) return [];
      return await base44.entities.VehicleAssignment.filter(
        { driver_id: driver.id },
        '-assignment_date'
      );
    },
    enabled: !!driver?.id,
  });

  // Fetch vehicle issue reports
  const { data: issueReports = [] } = useQuery({
    queryKey: ['driverIssueReports', driver?.id],
    queryFn: async () => {
      if (!driver?.id) return [];
      return await base44.entities.VehicleIssueReport.filter(
        { driver_id: driver.id },
        '-report_date'
      );
    },
    enabled: !!driver?.id,
  });

  // Update mileage mutation
  const updateMileageMutation = useMutation({
    mutationFn: async (newMileage) => {
      await base44.entities.Vehicle.update(driver.assigned_vehicle_id, {
        mileage: newMileage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignedVehicle'] });
      setMileageValue('');
      setOpenMileageDialog(false);
    },
  });

  // Report issue mutation
  const reportIssueMutation = useMutation({
    mutationFn: async (issueData) => {
      return await base44.entities.VehicleIssueReport.create(issueData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverIssueReports'] });
      setIssueType('');
      setIssueSeverity('medium');
      setIssueDescription('');
      setUploadedPhotos([]);
      setOpenIssueDialog(false);
    },
  });

  // Handle photo upload
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const newUrls = [];
      for (const file of files) {
        const response = await base44.integrations.Core.UploadFile({
          file: file,
        });
        newUrls.push(response.file_url);
      }
      setUploadedPhotos([...uploadedPhotos, ...newUrls]);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  // Handle report issue submission
  const handleReportIssue = () => {
    if (!issueType || !issueDescription) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    reportIssueMutation.mutate({
      driver_id: driver.id,
      driver_name: driver.full_name,
      driver_email: driver.email,
      vehicle_id: assignedVehicle.id,
      vehicle_plate: assignedVehicle.license_plate,
      issue_type: issueType,
      severity: issueSeverity,
      description: issueDescription,
      photo_urls: uploadedPhotos,
      mileage_at_report: assignedVehicle.mileage,
      report_date: new Date().toISOString().split('T')[0],
    });
  };

  if (!driver) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Carregando informações do motorista...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículo Atribuído"
        subtitle="Gerencie seu veículo, reporte problemas e visualize histórico"
      />

      {/* Current Vehicle Card */}
      {assignedVehicle ? (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-indigo-600" />
              Veículo Atualmente Atribuído
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Matrícula</p>
                <p className="text-lg font-bold text-gray-900">{assignedVehicle.license_plate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Marca/Modelo</p>
                <p className="text-lg font-bold text-gray-900">
                  {assignedVehicle.brand} {assignedVehicle.model}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Cor</p>
                <p className="text-lg font-bold text-gray-900">{assignedVehicle.color || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Combustível</p>
                <Badge className="bg-blue-100 text-blue-800 text-xs">
                  {assignedVehicle.fuel_type}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Quilometragem</p>
                <p className="text-lg font-bold text-gray-900">
                  {assignedVehicle.mileage?.toLocaleString() || 'N/A'} km
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Seguro</p>
                <p className="text-sm text-gray-900">
                  {assignedVehicle.insurance_expiry
                    ? format(new Date(assignedVehicle.insurance_expiry), 'dd/MM/yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Dialog open={openMileageDialog} onOpenChange={setOpenMileageDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <Gauge className="w-4 h-4" />
                    Atualizar Quilometragem
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Atualizar Quilometragem</DialogTitle>
                    <DialogDescription>
                      Insira a quilometragem atual do veículo {assignedVehicle.license_plate}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">
                        Quilometragem (km)
                      </label>
                      <Input
                        type="number"
                        placeholder="Ex: 45000"
                        value={mileageValue}
                        onChange={(e) => setMileageValue(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (!mileageValue) {
                          alert('Introduza a quilometragem');
                          return;
                        }
                        updateMileageMutation.mutate(Number(mileageValue));
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                      disabled={updateMileageMutation.isPending}
                    >
                      {updateMileageMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={openIssueDialog} onOpenChange={setOpenIssueDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Reportar Problema
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Reportar Problema do Veículo</DialogTitle>
                    <DialogDescription>
                      Descreva o problema e anexe fotos se possível
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">
                        Tipo de Problema *
                      </label>
                      <Select value={issueType} onValueChange={setIssueType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha o tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="damage">Dano/Impacto</SelectItem>
                          <SelectItem value="mechanical">Problema Mecânico</SelectItem>
                          <SelectItem value="electrical">Problema Elétrico</SelectItem>
                          <SelectItem value="interior">Problema no Interior</SelectItem>
                          <SelectItem value="maintenance">Manutenção Necessária</SelectItem>
                          <SelectItem value="accident">Acidente</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">
                        Severidade
                      </label>
                      <Select value={issueSeverity} onValueChange={setIssueSeverity}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="critical">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">
                        Descrição *
                      </label>
                      <textarea
                        className="w-full border rounded-lg p-2 text-sm"
                        rows="4"
                        placeholder="Descreva o problema em detalhe..."
                        value={issueDescription}
                        onChange={(e) => setIssueDescription(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">
                        Fotos do Problema
                      </label>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploading}
                          className="hidden"
                          id="photo-upload"
                        />
                        <label
                          htmlFor="photo-upload"
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          <Upload className="w-5 h-5 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {uploading ? 'Enviando...' : 'Clique para selecionar fotos'}
                          </span>
                        </label>
                      </div>
                      {uploadedPhotos.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {uploadedPhotos.map((url, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-gray-50 p-2 rounded"
                            >
                              <span className="text-sm text-gray-600">Foto {idx + 1}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setUploadedPhotos(uploadedPhotos.filter((_, i) => i !== idx))
                                }
                              >
                                Remover
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleReportIssue}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                      disabled={reportIssueMutation.isPending || !issueType || !issueDescription}
                    >
                      {reportIssueMutation.isPending ? 'Reportando...' : 'Reportar Problema'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Nenhum veículo atribuído no momento. Contacte o administrador.
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Issues */}
      {issueReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Problemas Reportados Recentemente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {issueReports.slice(0, 5).map((report) => (
                <div key={report.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm capitalize">{report.issue_type}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(report.report_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <Badge
                      className={`text-xs ${
                        report.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : report.severity === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : report.severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {report.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
                  <div className="mt-2">
                    <Badge className="text-xs">{report.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment History */}
      {assignmentHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Veículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignmentHistory.slice(0, 5).map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between border-b pb-2 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-semibold">{assignment.vehicle_plate}</p>
                    <p className="text-xs text-gray-600">{assignment.vehicle_info}</p>
                  </div>
                  <div className="text-right text-xs text-gray-600">
                    {format(new Date(assignment.assignment_date), 'dd/MM/yy')} a{' '}
                    {assignment.end_date ? format(new Date(assignment.end_date), 'dd/MM/yy') : 'Atual'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}