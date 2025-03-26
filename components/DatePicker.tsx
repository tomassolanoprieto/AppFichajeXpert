import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Calendar as CalendarIcon } from 'lucide-react-native';

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  label?: string;
  placeholder?: string;
}

export default function DatePicker({ value, onChange, label, placeholder }: DatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleDateSelect = (day: { year: number; month: number; day: number }) => {
    // Create a new date using local components to avoid timezone issues
    const selectedDate = new Date(day.year, day.month - 1, day.day);
    onChange(selectedDate);
    setShowCalendar(false);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowCalendar(true)}
      >
        <CalendarIcon size={20} color="#6b7280" />
        <Text style={styles.inputText}>
          {value ? value.toLocaleDateString() : placeholder || 'Seleccionar fecha'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Calendar
              onDayPress={handleDateSelect}
              markedDates={value ? {
                [formatDate(value)]: { selected: true, selectedColor: '#6d28d9' }
              } : {}}
              theme={{
                todayTextColor: '#6d28d9',
                selectedDayBackgroundColor: '#6d28d9',
                selectedDayTextColor: '#ffffff',
              }}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowCalendar(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#374151',
    fontFamily: 'Inter_600SemiBold',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 400,
  },
  closeButton: {
    backgroundColor: '#6d28d9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});