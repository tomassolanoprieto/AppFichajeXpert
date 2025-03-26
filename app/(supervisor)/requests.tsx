import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, ImageBackground } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Check, X, Search, Download, Clock, Calendar } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DateRangePicker from '@/components/DateRangePicker';

interface Request {
  id: string;
  type: 'time' | 'planner';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  employee: {
    id: string;
    fiscal_name: string;
    email: string;
    work_centers: string[];
    delegation: string;
  };
  details: {
    datetime?: string;
    entry_type?: string;
    planner_type?: string;
    start_date?: string;
    end_date?: string;
    comment?: string;
    work_center?: string;
  };
}

export default function SupervisorRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [supervisorWorkCenters, setSupervisorWorkCenters] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [filter, startDate, endDate]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const supervisorEmail = await SecureStore.getItemAsync('supervisorEmail');
      if (!supervisorEmail) {
        throw new Error('No se encontró el correo electrónico del supervisor');
      }

      // Obtener el ID del supervisor y marcar notificaciones como leídas
      const { data: supervisorData } = await supabase
        .from('supervisor_profiles')
        .select('id, work_centers')
        .eq('email', supervisorEmail)
        .single();

      if (!supervisorData) {
        throw new Error('No se encontró el perfil del supervisor');
      }

      // Marcar notificaciones como leídas
      await supabase
        .from('supervisor_notifications')
        .update({ is_read: true })
        .eq('supervisor_id', supervisorData.id)
        .eq('is_read', false);

      setSupervisorWorkCenters(supervisorData.work_centers || []);

      // Call the function for each work center and combine results
      const allRequests = [];
      for (const workCenter of supervisorData.work_centers || []) {
        const { data: requestsData, error: rpcError } = await supabase
          .rpc('get_filtered_requests', {
            p_work_center: workCenter,
            p_start_date: startDate ? startDate.toISOString() : null,
            p_end_date: endDate ? endDate.toISOString() : null,
          });

        if (rpcError) throw rpcError;
        if (requestsData) {
          allRequests.push(...requestsData);
        }
      }

      // Remove duplicates based on request_id
      const uniqueRequests = Array.from(
        new Map(allRequests.map(item => [item.request_id, item])).values()
      );

      // Sort by created_at in descending order
      uniqueRequests.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const formattedRequests: Request[] = uniqueRequests.map((req: any) => ({
        id: req.request_id,
        type: req.request_type,
        status: req.request_status,
        created_at: req.created_at,
        employee: {
          id: req.employee_id,
          fiscal_name: req.employee_name,
          email: req.employee_email,
          work_centers: req.work_centers || [],
          delegation: req.delegation || '',
        },
        details: {
          ...(req.request_type === 'time' ? {
            datetime: req.details.datetime,
            entry_type: req.details.entry_type,
            work_center: req.details.work_center,
          } : {
            planner_type: req.details.planner_type,
            start_date: req.details.start_date,
            end_date: req.details.end_date,
          }),
          comment: req.details.comment,
        },
      }));

      // Filter by status if needed
      const filteredByStatus = filter === 'all' 
        ? formattedRequests 
        : formattedRequests.filter(req => req.status === filter);

      setRequests(filteredByStatus);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, type: string, newStatus: 'approved' | 'rejected') => {
    try {
      setLoading(true);
      const table = type === 'time' ? 'time_requests' : 'planner_requests';

      const { error } = await supabase
        .from(table)
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      await fetchRequests();
    } catch (err) {
      console.error('Error updating request status:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const exportData = requests.map((request) => ({
        'Tipo de Solicitud': request.type === 'time' ? 'Fichaje' : 'Planificador',
        'Estado': getStatusText(request.status),
        'Fecha de Solicitud': new Date(request.created_at).toLocaleString(),
        'Empleado': request.employee.fiscal_name,
        'Email': request.employee.email,
        'Centros de Trabajo': request.employee.work_centers.join(', '),
        'Delegación': request.employee.delegation || '',
        'Detalles': request.type === 'time'
          ? `${new Date(request.details.datetime!).toLocaleString()} - ${getEntryTypeText(request.details.entry_type!)}`
          : `${request.details.planner_type} (${new Date(request.details.start_date!).toLocaleDateString()} - ${new Date(request.details.end_date!).toLocaleDateString()})`,
        'Comentario': request.details.comment || '',
      }));

      const csvContent = [
        Object.keys(exportData[0]).join(','),
        ...exportData.map(row => Object.values(row).join(','))
      ].join('\n');

      const filename = `solicitudes_${new Date().toISOString().split('T')[0]}.csv`;
      const csvUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(csvUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(csvUri);
    } catch (err) {
      console.error('Error exporting requests:', err);
      setError(err instanceof Error ? err.message : 'Error al exportar las solicitudes');
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprobada';
      case 'rejected': return 'Rechazada';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'approved': return styles.approvedBadge;
      case 'rejected': return styles.rejectedBadge;
      default: return styles.pendingBadge;
    }
  };

  const getEntryTypeText = (type: string) => {
    switch (type) {
      case 'clock_in': return 'Entrada';
      case 'break_start': return 'Inicio Pausa';
      case 'break_end': return 'Fin Pausa';
      case 'clock_out': return 'Salida';
      default: return type;
    }
  };

  const filteredRequests = requests.filter((request) =>
    request.employee.fiscal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?q=80&w=2070&auto=format&fit=crop' }}
      style={styles.container}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <ScrollView style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Solicitudes</Text>
            <Text style={styles.subtitle}>
              Gestión de solicitudes de empleados
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.filterContainer}>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              startLabel="Fecha inicio"
              endLabel="Fecha fin"
            />

            <View style={styles.statusFilterContainer}>
              {['all', 'pending', 'approved', 'rejected'].map((filterType) => (
                <TouchableOpacity
                  key={filterType}
                  style={[
                    styles.statusFilterButton,
                    filter === filterType && styles.activeStatusFilterButton,
                  ]}
                  onPress={() => setFilter(filterType as any)}
                >
                  <Text style={[
                    styles.statusFilterButtonText,
                    filter === filterType && styles.activeStatusFilterButtonText,
                  ]}>
                    {filterType === 'all' ? 'Todas' :
                     filterType === 'pending' ? 'Pendientes' :
                     filterType === 'approved' ? 'Aprobadas' : 'Rechazadas'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.searchContainer}>
              <Search size={20} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar solicitudes..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <TouchableOpacity 
            style={styles.exportButton} 
            onPress={handleExport}
            disabled={requests.length === 0}
          >
            <Download size={20} color="#ffffff" />
            <Text style={styles.exportButtonText}>Exportar a CSV</Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator size="large" color="#6d28d9" style={styles.loader} />
          ) : filteredRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Calendar size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No hay solicitudes que mostrar</Text>
            </View>
          ) : (
            <View style={styles.requestsContainer}>
              {filteredRequests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.employeeInfo}>
                      <Text style={styles.employeeName}>{request.employee.fiscal_name}</Text>
                      <Text style={styles.employeeEmail}>{request.employee.email}</Text>
                    </View>
                    <Text style={[styles.statusBadge, getStatusBadgeStyle(request.status)]}>
                      {getStatusText(request.status)}
                    </Text>
                  </View>

                  <View style={styles.requestDetails}>
                    <View style={styles.detailRow}>
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.detailText}>
                        {request.type === 'time' ? 'Fichaje' : 'Planificador'}
                      </Text>
                    </View>

                    {request.type === 'time' ? (
                      <>
                        <Text style={styles.detailLabel}>Fichaje:</Text>
                        <Text style={styles.detailText}>
                          {getEntryTypeText(request.details.entry_type!)} - {new Date(request.details.datetime!).toLocaleString()}
                        </Text>
                        {request.details.work_center && (
                          <>
                            <Text style={styles.detailLabel}>Centro de Trabajo:</Text>
                            <Text style={styles.detailText}>{request.details.work_center}</Text>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.detailLabel}>Período:</Text>
                        <Text style={styles.detailText}>
                          {request.details.planner_type}
                          {'\n'}
                          {new Date(request.details.start_date!).toLocaleDateString()} - {new Date(request.details.end_date!).toLocaleDateString()}
                        </Text>
                      </>
                    )}

                    {request.details.comment && (
                      <>
                        <Text style={styles.detailLabel}>Comentario:</Text>
                        <Text style={styles.detailText}>{request.details.comment}</Text>
                      </>
                    )}
                  </View>

                  {request.status === 'pending' && (
                    <View style={styles.actionsContainer}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleUpdateStatus(request.id, request.type, 'approved')}
                      >
                        <Check size={20} color="#ffffff" />
                        <Text style={styles.actionButtonText}>Aprobar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleUpdateStatus(request.id, request.type, 'rejected')}
                      >
                        <X size={20} color="#ffffff" />
                        <Text style={styles.actionButtonText}>Rechazar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 16,
  },
  statusFilterButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  activeStatusFilterButton: {
    backgroundColor: '#6d28d9',
  },
  statusFilterButtonText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  activeStatusFilterButtonText: {
    color: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  loader: {
    marginTop: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  requestsContainer: {
    gap: 16,
  },
  requestCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    color: '#111827',
    fontFamily: 'Inter_600SemiBold',
  },
  employeeEmail: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  approvedBadge: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
  },
  rejectedBadge: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  pendingBadge: {
    backgroundColor: '#fef9c3',
    color: '#ca8a04',
  },
  requestDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter_600SemiBold',
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#22c55e',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});