import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { Clock, CirclePause as PauseCircle, CirclePlay as PlayCircle, LogOut, MapPin, X } from 'lucide-react-native';

export default function TimeControl() {
  const [currentState, setCurrentState] = useState('initial');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string | null>(null);
  const [workCenters, setWorkCenters] = useState<string[]>([]);
  const [showWorkCenterModal, setShowWorkCenterModal] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [activeEntry, setActiveEntry] = useState<any>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const employeeId = await SecureStore.getItemAsync('employeeId');
        if (!employeeId) return;

        // Load work centers
        const { data: profileData, error: profileError } = await supabase
          .from('employee_profiles')
          .select('work_centers')
          .eq('id', employeeId)
          .single();

        if (profileError) throw profileError;
        if (profileData?.work_centers) {
          setWorkCenters(profileData.work_centers);
          if (profileData.work_centers.length === 1) {
            setSelectedWorkCenter(profileData.work_centers[0]);
          }
        }

        // Check for active entry
        const { data: activeEntries, error: entriesError } = await supabase
          .from('time_entries')
          .select('*')
          .eq('employee_id', employeeId)
          .eq('is_active', true)
          .order('timestamp', { ascending: false })
          .limit(1);

        if (entriesError) throw entriesError;

        if (activeEntries && activeEntries.length > 0) {
          const entry = activeEntries[0];
          setActiveEntry(entry);
          setSelectedWorkCenter(entry.work_center);

          switch (entry.entry_type) {
            case 'clock_in':
            case 'break_end':
              setCurrentState('working');
              break;
            case 'break_start':
              setCurrentState('paused');
              break;
            default:
              setCurrentState('initial');
          }
        } else {
          setCurrentState('initial');
          setActiveEntry(null);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Error al cargar datos iniciales');
      }
    };

    loadInitialData();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      return await Location.getCurrentPositionAsync({});
    } catch (err) {
      console.error('Error getting location:', err);
      return null;
    }
  };

  const handleClockIn = async () => {
    try {
      setLoading(true);
      setError(null);

      if (workCenters.length === 0) {
        throw new Error('No tienes centros asignados');
      }

      if (workCenters.length > 1 && !selectedWorkCenter) {
        setShowWorkCenterModal(true);
        return;
      }

      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) throw new Error('No se encontró ID de empleado');

      const location = await getLocation();
      setLocation(location);

      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          employee_id: employeeId,
          entry_type: 'clock_in',
          work_center: selectedWorkCenter || workCenters[0],
          timestamp: new Date().toISOString(),
          latitude: location?.coords.latitude,
          longitude: location?.coords.longitude,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      setActiveEntry(data);
      setCurrentState('working');
    } catch (err) {
      console.error('Error en clock in:', err);
      setError(err.message || 'Error al registrar entrada');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeEntry = async (entryType: 'break_start' | 'break_end' | 'clock_out') => {
    try {
      setLoading(true);
      setError(null);

      if (!activeEntry) {
        throw new Error('No hay un fichaje activo');
      }

      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) throw new Error('No se encontró ID de empleado');

      const location = await getLocation();

      // Create new entry
      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          employee_id: employeeId,
          entry_type: entryType,
          work_center: activeEntry.work_center,
          timestamp: new Date().toISOString(),
          latitude: location?.coords.latitude,
          longitude: location?.coords.longitude,
          is_active: entryType !== 'clock_out' // Only set inactive for clock_out
        }])
        .select()
        .single();

      if (error) throw error;

      // Update state based on entry type
      switch (entryType) {
        case 'break_start':
          setCurrentState('paused');
          setActiveEntry(data);
          break;
        case 'break_end':
          setCurrentState('working');
          setActiveEntry(data);
          break;
        case 'clock_out':
          setCurrentState('initial');
          setActiveEntry(null);
          setSelectedWorkCenter(workCenters.length === 1 ? workCenters[0] : null);
          break;
      }
    } catch (err) {
      console.error('Error en time entry:', err);
      setError(err.message || 'Error al registrar acción');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkCenter = (center: string) => {
    setSelectedWorkCenter(center);
    setShowWorkCenterModal(false);
    handleClockIn();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Control de Tiempo</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            currentState !== 'initial' && styles.actionButtonDisabled,
          ]}
          onPress={handleClockIn}
          disabled={currentState !== 'initial' || loading}
        >
          <Clock size={24} color={currentState !== 'initial' ? '#9ca3af' : '#ffffff'} />
          <Text style={[
            styles.actionButtonText,
            currentState !== 'initial' && styles.actionButtonTextDisabled
          ]}>
            Entrada
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            currentState !== 'working' && styles.actionButtonDisabled,
          ]}
          onPress={() => handleTimeEntry('break_start')}
          disabled={currentState !== 'working' || loading}
        >
          <PauseCircle size={24} color={currentState !== 'working' ? '#9ca3af' : '#ffffff'} />
          <Text style={[
            styles.actionButtonText,
            currentState !== 'working' && styles.actionButtonTextDisabled
          ]}>
            Pausa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            currentState !== 'paused' && styles.actionButtonDisabled,
          ]}
          onPress={() => handleTimeEntry('break_end')}
          disabled={currentState !== 'paused' || loading}
        >
          <PlayCircle size={24} color={currentState !== 'paused' ? '#9ca3af' : '#ffffff'} />
          <Text style={[
            styles.actionButtonText,
            currentState !== 'paused' && styles.actionButtonTextDisabled
          ]}>
            Volver
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.exitButton,
            (currentState === 'initial' || currentState === 'paused') && styles.actionButtonDisabled,
          ]}
          onPress={() => handleTimeEntry('clock_out')}
          disabled={currentState === 'initial' || currentState === 'paused' || loading}
        >
          <LogOut size={24} color={(currentState === 'initial' || currentState === 'paused') ? '#9ca3af' : '#ffffff'} />
          <Text style={[
            styles.actionButtonText,
            (currentState === 'initial' || currentState === 'paused') && styles.actionButtonTextDisabled
          ]}>
            Salida
          </Text>
        </TouchableOpacity>
      </View>

      {activeEntry?.work_center && (
        <View style={styles.statusContainer}>
          <MapPin size={20} color="#6b7280" />
          <Text style={styles.statusText}>
            Centro: {activeEntry.work_center}
          </Text>
        </View>
      )}

      <Modal
        visible={showWorkCenterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWorkCenterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona tu centro de trabajo</Text>
              <TouchableOpacity onPress={() => setShowWorkCenterModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            {workCenters.map((center) => (
              <TouchableOpacity
                key={center}
                style={styles.workCenterButton}
                onPress={() => handleSelectWorkCenter(center)}
              >
                <Text style={styles.workCenterButtonText}>{center}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
    fontFamily: 'Inter_400Regular',
  },
  buttonContainer: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  actionButtonTextDisabled: {
    color: '#9ca3af',
  },
  exitButton: {
    backgroundColor: '#ef4444',
  },
  statusContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter_400Regular',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    color: '#111827',
    fontFamily: 'Inter_600SemiBold',
  },
  workCenterButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  workCenterButtonText: {
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
});