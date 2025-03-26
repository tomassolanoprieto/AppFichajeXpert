import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { Send, Clock, History, MapPin } from 'lucide-react-native';
import DatePicker from '@/components/DatePicker';
import TimePicker from '@/components/TimePicker';
import { Picker } from '@react-native-picker/picker';

export default function EmployeeRequests() {
  const [requestType, setRequestType] = useState<'planner' | 'time'>('planner');
  const [plannerType, setPlannerType] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState('');
  const [timeEntryType, setTimeEntryType] = useState('');
  const [timeEntryDate, setTimeEntryDate] = useState<Date | null>(null);
  const [timeEntryTime, setTimeEntryTime] = useState('');
  const [selectedWorkCenter, setSelectedWorkCenter] = useState('');
  const [workCenters, setWorkCenters] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [plannerRequests, setPlannerRequests] = useState<any[]>([]);
  const [timeRequests, setTimeRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
    fetchWorkCenters();
  }, []);

  const fetchWorkCenters = async () => {
    try {
      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) throw new Error('No se encontró el ID del empleado');

      const { data: employeeData, error: employeeError } = await supabase
        .from('employee_profiles')
        .select('work_centers')
        .eq('id', employeeId)
        .single();

      if (employeeError) throw employeeError;
      if (employeeData?.work_centers) {
        setWorkCenters(employeeData.work_centers);
        if (employeeData.work_centers.length === 1) {
          setSelectedWorkCenter(employeeData.work_centers[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching work centers:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los centros de trabajo');
    }
  };

  const fetchRequests = async () => {
    try {
      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) throw new Error('No se encontró el ID del empleado');

      // Fetch planner requests
      const { data: plannerData, error: plannerError } = await supabase
        .from('planner_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (plannerError) throw plannerError;
      setPlannerRequests(plannerData || []);

      // Fetch time requests
      const { data: timeData, error: timeError } = await supabase
        .from('time_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (timeError) throw timeError;
      setTimeRequests(timeData || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las solicitudes');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) throw new Error('No se encontró el ID del empleado');

      if (requestType === 'planner') {
        if (!plannerType || !startDate || !endDate) {
          throw new Error('Por favor, complete todos los campos requeridos');
        }

        const startDateTime = startTime 
          ? new Date(startDate.setHours(
              parseInt(startTime.split(':')[0], 10),
              parseInt(startTime.split(':')[1], 10),
              0, 0
            ))
          : startDate;

        const endDateTime = endTime
          ? new Date(endDate.setHours(
              parseInt(endTime.split(':')[0], 10),
              parseInt(endTime.split(':')[1], 10),
              0, 0
            ))
          : endDate;

        const { error } = await supabase
          .from('planner_requests')
          .insert([{
            employee_id: employeeId,
            planner_type: plannerType,
            start_date: startDateTime.toISOString(),
            end_date: endDateTime.toISOString(),
            comment,
            status: 'pending',
          }]);

        if (error) throw error;
      } else {
        if (!timeEntryType || !timeEntryDate || !selectedWorkCenter) {
          throw new Error('Por favor, complete todos los campos requeridos');
        }

        const datetime = timeEntryTime
          ? new Date(timeEntryDate.setHours(
              parseInt(timeEntryTime.split(':')[0], 10),
              parseInt(timeEntryTime.split(':')[1], 10),
              0, 0
            ))
          : timeEntryDate;

        const { error } = await supabase
          .from('time_requests')
          .insert([{
            employee_id: employeeId,
            datetime: datetime.toISOString(),
            entry_type: timeEntryType,
            work_center: selectedWorkCenter,
            comment,
            status: 'pending',
          }]);

        if (error) throw error;
      }

      setSuccess(true);
      resetForm();
      fetchRequests();
    } catch (err) {
      console.error('Error al enviar la solicitud:', err);
      setError(err instanceof Error ? err.message : 'Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPlannerType('');
    setStartDate(null);
    setStartTime('');
    setEndDate(null);
    setEndTime('');
    setTimeEntryType('');
    setTimeEntryDate(null);
    setTimeEntryTime('');
    setSelectedWorkCenter(workCenters.length === 1 ? workCenters[0] : '');
    setComment('');
  };

  const plannerTypes = [
    'Horas compensadas',
    'Horas vacaciones',
    'Horas asuntos propios',
  ];

  const timeEntryTypes = [
    { value: 'clock_in', label: 'Entrada' },
    { value: 'break_start', label: 'Inicio Pausa' },
    { value: 'break_end', label: 'Fin Pausa' },
    { value: 'clock_out', label: 'Salida' },
  ];

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return styles.approvedBadge;
      case 'rejected':
        return styles.rejectedBadge;
      default:
        return styles.pendingBadge;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      case 'pending':
        return 'Pendiente';
      default:
        return status;
    }
  };

  const getEntryTypeText = (type: string) => {
    switch (type) {
      case 'clock_in':
        return 'Entrada';
      case 'break_start':
        return 'Inicio Pausa';
      case 'break_end':
        return 'Fin Pausa';
      case 'clock_out':
        return 'Salida';
      default:
        return type;
    }
  };

  const renderRequestHistory = () => {
    const requests = requestType === 'planner' ? plannerRequests : timeRequests;

    if (requests.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <History size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>No hay solicitudes para mostrar</Text>
        </View>
      );
    }

    return requests.map((request) => (
      <View key={request.id} style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyDate}>
            {new Date(request.created_at).toLocaleDateString()}
          </Text>
          <Text style={[styles.statusBadge, getStatusBadgeStyle(request.status)]}>
            {getStatusText(request.status)}
          </Text>
        </View>

        {requestType === 'planner' ? (
          <>
            <Text style={styles.historyType}>{request.planner_type}</Text>
            <Text style={styles.historyPeriod}>
              {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.historyType}>
              {getEntryTypeText(request.entry_type)}
            </Text>
            <Text style={styles.historyDateTime}>
              {new Date(request.datetime).toLocaleString()}
            </Text>
            {request.work_center && (
              <View style={styles.workCenterContainer}>
                <MapPin size={16} color="#6b7280" />
                <Text style={styles.workCenterText}>{request.work_center}</Text>
              </View>
            )}
          </>
        )}

        {request.comment && (
          <Text style={styles.historyComment}>{request.comment}</Text>
        )}
      </View>
    ));
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nueva Solicitud</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>
            Solicitud enviada correctamente
          </Text>
        </View>
      )}

      <View style={styles.formContainer}>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeSelectorButton, requestType === 'planner' && styles.typeSelectorButtonSelected]}
            onPress={() => setRequestType('planner')}
          >
            <Clock size={20} color={requestType === 'planner' ? '#ffffff' : '#374151'} />
            <Text style={[styles.typeSelectorButtonText, requestType === 'planner' && styles.typeSelectorButtonTextSelected]}>
              Planificador
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeSelectorButton, requestType === 'time' && styles.typeSelectorButtonSelected]}
            onPress={() => setRequestType('time')}
          >
            <Clock size={20} color={requestType === 'time' ? '#ffffff' : '#374151'} />
            <Text style={[styles.typeSelectorButtonText, requestType === 'time' && styles.typeSelectorButtonTextSelected]}>
              Fichaje
            </Text>
          </TouchableOpacity>
        </View>

        {requestType === 'planner' ? (
          <>
            <Text style={styles.label}>Tipo de Solicitud</Text>
            <View style={styles.typeContainer}>
              {plannerTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    plannerType === type && styles.typeButtonSelected,
                  ]}
                  onPress={() => setPlannerType(type)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    plannerType === type && styles.typeButtonTextSelected,
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <DatePicker
              value={startDate}
              onChange={setStartDate}
              label="Fecha Inicio"
            />
            <TimePicker
              value={startTime}
              onChange={setStartTime}
              label="Hora inicio"
              placeholder="Seleccionar hora inicio"
            />

            <DatePicker
              value={endDate}
              onChange={setEndDate}
              label="Fecha Fin"
            />
            <TimePicker
              value={endTime}
              onChange={setEndTime}
              label="Hora fin"
              placeholder="Seleccionar hora fin"
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Tipo de Fichaje</Text>
            <View style={styles.typeContainer}>
              {timeEntryTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeButton,
                    timeEntryType === type.value && styles.typeButtonSelected,
                  ]}
                  onPress={() => setTimeEntryType(type.value)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    timeEntryType === type.value && styles.typeButtonTextSelected,
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <DatePicker
              value={timeEntryDate}
              onChange={setTimeEntryDate}
              label="Fecha"
            />
            <TimePicker
              value={timeEntryTime}
              onChange={setTimeEntryTime}
              label="Hora"
              placeholder="Seleccionar hora"
            />

            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Centro de Trabajo</Text>
              <View style={styles.pickerWrapper}>
                <MapPin size={20} color="#6b7280" style={styles.pickerIcon} />
                <Picker
                  selectedValue={selectedWorkCenter}
                  onValueChange={(itemValue) => setSelectedWorkCenter(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar centro de trabajo" value="" />
                  {workCenters.map((center) => (
                    <Picker.Item key={center} label={center} value={center} />
                  ))}
                </Picker>
              </View>
            </View>
          </>
        )}

        <Text style={styles.label}>Comentario</Text>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Escribe un comentario..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Send size={20} color="white" />
          <Text style={styles.submitButtonText}>
            {loading ? 'Enviando...' : 'Enviar Solicitud'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>
          Historial de Solicitudes
        </Text>
        {renderRequestHistory()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  successContainer: {
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#16a34a',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  typeSelectorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeSelectorButtonSelected: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  typeSelectorButtonText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  typeSelectorButtonTextSelected: {
    color: '#ffffff',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#374151',
    fontFamily: 'Inter_600SemiBold',
  },
  typeContainer: {
    marginBottom: 16,
  },
  typeButton: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeButtonSelected: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  typeButtonText: {
    color: '#374151',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  typeButtonTextSelected: {
    color: '#ffffff',
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  pickerIcon: {
    marginRight: 8,
  },
  picker: {
    flex: 1,
    color: '#111827',
  },
  commentInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    minHeight: 100,
    fontFamily: 'Inter_400Regular',
  },
  submitButton: {
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  historyContainer: {
    marginTop: 24,
  },
  historyTitle: {
    fontSize: 20,
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'Inter_700Bold',
  },
  historyCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    fontSize: 12,
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
  historyType: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  historyPeriod: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter_400Regular',
  },
  historyDateTime: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter_400Regular',
  },
  workCenterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  workCenterText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  historyComment: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
});