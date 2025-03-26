import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { Calendar } from 'lucide-react-native';
import DateRangePicker from '@/components/DateRangePicker';

export default function History() {
  const [entries, setEntries] = useState([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [totalTime, setTotalTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startDate && endDate) {
      fetchTimeEntries();
    }
  }, [startDate, endDate]);

  const fetchTimeEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      const employeeId = await SecureStore.getItemAsync('employeeId');
      if (!employeeId) {
        throw new Error('No se encontró el ID del empleado');
      }

      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .order('timestamp', { ascending: true });

      if (startDate) {
        query = query.gte('timestamp', startDate.toISOString());
      }
      
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('timestamp', endDateTime.toISOString());
      }

      const { data, error: entriesError } = await query;
      if (entriesError) throw entriesError;

      setEntries(data || []);
      calculateTotalTime(data);
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los fichajes');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalTime = (entries) => {
    let total = 0;
    let clockInTime = null;
    let breakStartTime = null;

    entries?.forEach((entry) => {
      const currentTime = new Date(entry.timestamp).getTime();

      switch (entry.entry_type) {
        case 'clock_in':
          clockInTime = currentTime;
          break;
        case 'break_start':
          if (clockInTime) {
            total += currentTime - clockInTime;
            clockInTime = null;
          }
          breakStartTime = currentTime;
          break;
        case 'break_end':
          clockInTime = currentTime;
          breakStartTime = null;
          break;
        case 'clock_out':
          if (clockInTime) {
            total += currentTime - clockInTime;
            clockInTime = null;
          }
          break;
      }
    });

    if (clockInTime) {
      total += new Date().getTime() - clockInTime;
    }

    setTotalTime(total);
  };

  const filterToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStartDate(today);
    setEndDate(today);
  };

  const filterWeek = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(monday.getDate() - monday.getDay() + (monday.getDay() === 0 ? -6 : 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    setStartDate(monday);
    setEndDate(sunday);
  };

  const filterMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59, 999);
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  const formatDuration = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getEntryTypeText = (type) => {
    switch (type) {
      case 'clock_in': return 'Entrada';
      case 'break_start': return 'Inicio Pausa';
      case 'break_end': return 'Fin Pausa';
      case 'clock_out': return 'Salida';
      default: return type;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Historial de Fichajes</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.filterButton} onPress={filterToday}>
          <Text style={styles.filterButtonText}>Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={filterWeek}>
          <Text style={styles.filterButtonText}>Semana</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={filterMonth}>
          <Text style={styles.filterButtonText}>Mes</Text>
        </TouchableOpacity>
      </View>

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        startLabel="Fecha inicio"
        endLabel="Fecha fin"
      />

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Tiempo Total Trabajado</Text>
        <Text style={styles.statsValue}>{formatDuration(totalTime)}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando fichajes...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay fichajes para mostrar</Text>
        </View>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryDate}>
                {new Date(entry.timestamp).toLocaleDateString()}
              </Text>
              <Text style={styles.entryTime}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            <View style={styles.entryDetails}>
              <Text style={styles.entryType}>
                {getEntryTypeText(entry.entry_type)}
              </Text>
              {entry.work_center && (
                <Text style={styles.entryWorkCenter}>
                  {entry.work_center}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
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
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonText: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  statsCard: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  statsTitle: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  statsValue: {
    color: '#ffffff',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  entryCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  entryDate: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  entryTime: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  entryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryType: {
    color: '#111827',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  entryWorkCenter: {
    color: '#6b7280',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});