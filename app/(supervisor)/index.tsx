import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ImageBackground } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { Shield, Users, Clock, Search, X, Building2 } from 'lucide-react-native';

export default function SupervisorDashboard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEmployeeEntries, setSelectedEmployeeEntries] = useState<any[]>([]);
  const [supervisorWorkCenters, setSupervisorWorkCenters] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getSupervisorInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        const supervisorEmail = await SecureStore.getItemAsync('supervisorEmail');
        if (!supervisorEmail) {
          throw new Error('No se encontró el correo electrónico del supervisor');
        }

        const { data: workCenters, error: workCentersError } = await supabase
          .rpc('get_supervisor_work_centers', {
            p_email: supervisorEmail,
          });

        if (workCentersError) throw workCentersError;
        if (!workCenters?.length) throw new Error('No se encontraron centros de trabajo asignados');

        setSupervisorWorkCenters(workCenters);

        const { data: employeesData, error: employeesError } = await supabase
          .rpc('get_supervisor_center_employees_v6', {
            p_email: supervisorEmail,
          });

        if (employeesError) throw employeesError;
        setEmployees(employeesData || []);

        if (employeesData?.length) {
          const employeeIds = employeesData.map(emp => emp.id);
          const { data: timeEntriesData, error: timeEntriesError } = await supabase
            .from('time_entries')
            .select('*')
            .in('employee_id', employeeIds)
            .eq('is_active', true)
            .order('timestamp', { ascending: false });

          if (timeEntriesError) throw timeEntriesError;
          setTimeEntries(timeEntriesData || []);
        }
      } catch (err) {
        console.error('Error getting supervisor info:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };

    getSupervisorInfo();
  }, []);

  const calculateTotalWorkTime = (entries: any[]) => {
    if (!entries?.length) return 0;

    let totalTime = 0;
    let clockInTime: number | null = null;
    let breakStartTime: number | null = null;

    entries
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach((entry) => {
        const time = new Date(entry.timestamp).getTime();

        switch (entry.entry_type) {
          case 'clock_in':
            clockInTime = time;
            break;
          case 'break_start':
            if (clockInTime) {
              totalTime += time - clockInTime;
              clockInTime = null;
            }
            breakStartTime = time;
            break;
          case 'break_end':
            breakStartTime = null;
            clockInTime = time;
            break;
          case 'clock_out':
            if (clockInTime) {
              totalTime += time - clockInTime;
              clockInTime = null;
            }
            break;
        }
      });

    if (clockInTime && !breakStartTime) {
      const now = new Date().getTime();
      totalTime += now - clockInTime;
    }

    return totalTime;
  };

  const calculateDailyWorkTime = (entries: any[]) => {
    if (!entries?.length) return 0;

    const today = new Date().toLocaleDateString();
    const todayEntries = entries.filter(
      (entry) => new Date(entry.timestamp).toLocaleDateString() === today
    );

    return calculateTotalWorkTime(todayEntries);
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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

  const handleSelectEmployee = async (employee: any) => {
    try {
      const employeeEntries = timeEntries.filter(entry => entry.employee_id === employee.id);
      const todayTime = calculateDailyWorkTime(employeeEntries);
      const totalTime = calculateTotalWorkTime(employeeEntries);
      
      setSelectedEmployee({
        ...employee,
        todayTime,
        totalTime,
        entries: employeeEntries
      });
      setSelectedEmployeeEntries(employeeEntries);
      setShowDetailsModal(true);
    } catch (err) {
      console.error('Error selecting employee:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los datos del empleado');
    }
  };

  const employeeWorkTimes = employees.map((employee) => {
    const employeeEntries = timeEntries.filter((entry) => entry.employee_id === employee.id);
    const todayTime = calculateDailyWorkTime(employeeEntries);
    const totalTime = calculateTotalWorkTime(employeeEntries);
    return {
      employee,
      todayTime,
      totalTime,
    };
  });

  const totalWorkTime = employeeWorkTimes.reduce((acc, curr) => acc + curr.totalTime, 0);

  const filteredEmployees = employeeWorkTimes.filter(({ employee }) =>
    employee.fiscal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
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
            <Text style={styles.title}>Vista General</Text>
            <Text style={styles.subtitle}>
              Gestión y supervisión de empleados
            </Text>
            <View style={styles.workCentersContainer}>
              <Building2 size={20} color="#6b7280" />
              <Text style={styles.workCentersText}>
                Centros asignados: {supervisorWorkCenters.join(', ')}
              </Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Shield size={32} color="#6d28d9" />
              <Text style={styles.statValue}>{employees.length}</Text>
              <Text style={styles.statLabel}>Empleados</Text>
            </View>
            <View style={styles.statCard}>
              <Clock size={32} color="#22c55e" />
              <Text style={styles.statValue}>{formatDuration(totalWorkTime)}</Text>
              <Text style={styles.statLabel}>Tiempo Total</Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar empleados..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#9ca3af"
            />
          </View>

          {loading ? (
            <Text style={styles.loadingText}>Cargando...</Text>
          ) : filteredEmployees.length === 0 ? (
            <Text style={styles.emptyText}>No hay empleados para mostrar</Text>
          ) : (
            <View style={styles.employeesContainer}>
              {filteredEmployees.map(({ employee, todayTime, totalTime }) => (
                <TouchableOpacity
                  key={employee.id}
                  style={styles.employeeCard}
                  onPress={() => handleSelectEmployee(employee)}
                >
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{employee.fiscal_name}</Text>
                    <Text style={styles.employeeEmail}>{employee.email}</Text>
                    <Text style={styles.employeeTime}>
                      Tiempo total: {formatDuration(totalTime)}
                    </Text>
                  </View>
                  <View style={styles.employeeStatus}>
                    <View style={[
                      styles.statusIndicator,
                      todayTime > 0 ? styles.statusActive : styles.statusInactive
                    ]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showDetailsModal && selectedEmployee && (
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Detalles de {selectedEmployee.fiscal_name}
                  </Text>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => {
                      setShowDetailsModal(false);
                      setSelectedEmployee(null);
                      setSelectedEmployeeEntries([]);
                    }}
                  >
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailText}>{selectedEmployee.email}</Text>

                  <Text style={styles.detailLabel}>Centros de Trabajo:</Text>
                  <Text style={styles.detailText}>
                    {selectedEmployee.work_centers?.join(', ')}
                  </Text>

                  <Text style={styles.detailLabel}>Tiempo trabajado hoy:</Text>
                  <Text style={styles.detailText}>
                    {formatDuration(selectedEmployee.todayTime)}
                  </Text>

                  <Text style={styles.detailLabel}>Tiempo total trabajado:</Text>
                  <Text style={styles.detailText}>
                    {formatDuration(selectedEmployee.totalTime)}
                  </Text>

                  <Text style={styles.sectionTitle}>Registro de Entradas</Text>
                  {selectedEmployeeEntries.length > 0 ? (
                    selectedEmployeeEntries.map((entry, index) => (
                      <View key={entry.id} style={styles.entryCard}>
                        <Text style={styles.entryType}>
                          {getEntryTypeText(entry.entry_type)}
                        </Text>
                        <Text style={styles.entryTime}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </Text>
                        {entry.work_center && (
                          <Text style={styles.entryWorkCenter}>
                            Centro: {entry.work_center}
                          </Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noEntriesText}>
                      No hay registros para mostrar
                    </Text>
                  )}
                </ScrollView>
              </View>
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
    marginBottom: 12,
  },
  workCentersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  workCentersText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter_500Medium',
    flex: 1,
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
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statValue: {
    fontSize: 24,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
    marginTop: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  employeesContainer: {
    gap: 16,
  },
  employeeCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
    color: '#111827',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  employeeEmail: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  employeeTime: {
    fontSize: 14,
    color: '#6d28d9',
    fontFamily: 'Inter_500Medium',
  },
  employeeStatus: {
    justifyContent: 'center',
    paddingLeft: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#22c55e',
  },
  statusInactive: {
    backgroundColor: '#e5e7eb',
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginTop: 32,
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    height: '100%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  closeButton: {
    padding: 8,
  },
  modalScroll: {
    maxHeight: '80%',
  },
  detailLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  detailText: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'Inter_400Regular',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#111827',
    marginTop: 8,
    marginBottom: 16,
    fontFamily: 'Inter_700Bold',
  },
  entryCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  entryType: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  entryTime: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
  },
  entryWorkCenter: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  noEntriesText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});