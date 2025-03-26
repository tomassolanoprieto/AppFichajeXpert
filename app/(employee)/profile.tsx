import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { Save, Clock, Bell } from 'lucide-react-native';
import TimePicker from '@/components/TimePicker';
import { setupWorkScheduleNotifications } from '@/lib/notifications';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState<{
    email: string;
    pin: string;
    fiscal_name: string;
    document_type: string;
    document_number: string;
    employee_id: string;
    work_centers: string[];
    job_positions: string[];
    seniority_date: string;
    work_schedule: { [key: string]: { start_time: string, end_time: string } | null };
    notification_minutes: number;
  } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [workSchedule, setWorkSchedule] = useState<{ [key: string]: { start_time: string, end_time: string } | null }>({});
  const [notificationMinutes, setNotificationMinutes] = useState<number>(0);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) {
        throw new Error('No se encontró el ID del empleado');
      }

      const { data: profile, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (error) throw error;
      if (!profile) throw new Error('No se encontró el perfil del empleado');

      setProfile(profile);
      setWorkSchedule(profile.work_schedule || {});
      setNotificationMinutes(profile.notification_minutes || 0);

      // Setup notifications based on saved schedule
      if (Platform.OS !== 'web' && profile.work_schedule && profile.notification_minutes) {
        await setupWorkScheduleNotifications(
          employeeId,
          profile.fiscal_name,
          profile.work_centers || [],
          profile.work_schedule,
          profile.notification_minutes
        );
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePin = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      if (!profile) {
        throw new Error('No se encontró el perfil del empleado');
      }

      if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
        throw new Error('El PIN debe ser de 6 dígitos numéricos');
      }

      if (newPin !== confirmPin) {
        throw new Error('Los PINs no coinciden');
      }

      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) {
        throw new Error('No se encontró el ID del empleado');
      }

      const { error: updateError } = await supabase
        .from('employee_profiles')
        .update({ pin: newPin })
        .eq('id', employeeId);

      if (updateError) throw updateError;

      setSuccess(true);
      setNewPin('');
      setConfirmPin('');
      await fetchProfile();
    } catch (err) {
      console.error('Error updating PIN:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar el PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      if (!profile) {
        throw new Error('No se encontró el perfil del empleado');
      }

      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) {
        throw new Error('No se encontró el ID del empleado');
      }

      const { error } = await supabase
        .from('employee_profiles')
        .update({ work_schedule: workSchedule, notification_minutes: notificationMinutes })
        .eq('id', employeeId);

      if (error) throw error;

      // Setup notifications with new schedule
      if (Platform.OS !== 'web') {
        await setupWorkScheduleNotifications(
          employeeId,
          profile.fiscal_name,
          profile.work_centers || [],
          workSchedule,
          notificationMinutes
        );
      }

      setSuccess(true);
      await fetchProfile();
    } catch (err) {
      console.error('Error saving work schedule:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar el horario laboral');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkScheduleChange = (day: string, field: 'start_time' | 'end_time', value: string) => {
    setWorkSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleNotificationMinutesChange = (value: string) => {
    const minutes = parseInt(value, 10);
    if (!isNaN(minutes)) {
      setNotificationMinutes(minutes);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Error al cargar el perfil</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Mi Perfil</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información Personal</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Nombre</Text>
            <Text style={styles.value}>{profile.fiscal_name}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile.email}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{profile.document_type}</Text>
            <Text style={styles.value}>{profile.document_number}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información Laboral</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>ID Empleado</Text>
            <Text style={styles.value}>{profile.employee_id}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Centros de Trabajo</Text>
            <Text style={styles.value}>{profile.work_centers?.join(', ')}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Puestos</Text>
            <Text style={styles.value}>{profile.job_positions?.join(', ')}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Fecha de Antigüedad</Text>
            <Text style={styles.value}>{new Date(profile.seniority_date).toLocaleDateString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cambiar PIN</Text>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>PIN actualizado correctamente</Text>
          </View>
        )}
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Nuevo PIN (6 dígitos)"
            value={newPin}
            onChangeText={setNewPin}
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Confirmar nuevo PIN"
            value={confirmPin}
            onChangeText={setConfirmPin}
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleUpdatePin}
            disabled={loading}
          >
            <Save size={20} color="white" />
            <Text style={styles.buttonText}>
              {loading ? 'Actualizando...' : 'Actualizar PIN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Horario Laboral</Text>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>Horario guardado correctamente</Text>
          </View>
        )}
        <View style={styles.card}>
          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
            <View key={day} style={styles.field}>
              <Text style={styles.label}>{day}</Text>
              <View style={styles.timeContainer}>
                <View style={styles.timeField}>
                  <Text style={styles.timeLabel}>Hora entrada</Text>
                  <TimePicker
                    value={workSchedule[day]?.start_time || ''}
                    onChange={(value) => handleWorkScheduleChange(day, 'start_time', value)}
                    placeholder="Seleccionar hora"
                  />
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.timeLabel}>Hora salida</Text>
                  <TimePicker
                    value={workSchedule[day]?.end_time || ''}
                    onChange={(value) => handleWorkScheduleChange(day, 'end_time', value)}
                    placeholder="Seleccionar hora"
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={() => setWorkSchedule(prev => ({ ...prev, [day]: null }))}
              >
                <Text style={styles.buttonText}>No Trabaja</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.field}>
            <Text style={styles.label}>Notificación App (minutos)</Text>
            <TextInput
              style={styles.input}
              placeholder="Minutos"
              value={notificationMinutes.toString()}
              onChangeText={handleNotificationMinutesChange}
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>
              Se enviará una notificación {notificationMinutes} minutos después de esta hora si no se ha registrado ningún fichaje.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSaveWorkSchedule}
            disabled={loading}
          >
            <Save size={20} color="white" />
            <Text style={styles.buttonText}>
              {loading ? 'Guardando...' : 'Guardar Horario y Notificación'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
    color: '#374151',
    fontFamily: 'Inter_600SemiBold',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    fontFamily: 'Inter_500Medium',
  },
  value: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontFamily: 'Inter_400Regular',
  },
  button: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDanger: {
    backgroundColor: '#dc2626',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  successText: {
    color: '#16a34a',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  hintText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  timeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  timeField: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
  },
});