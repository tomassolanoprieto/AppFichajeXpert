import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Calendar as CalendarIcon } from 'lucide-react-native';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  startLabel?: string;
  endLabel?: string;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = 'Fecha inicio',
  endLabel = 'Fecha fin',
}: DateRangePickerProps) {
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleDateSelect = (day: { year: number; month: number; day: number }, isStart: boolean) => {
    // Create a new date using local components to avoid timezone issues
    const selectedDate = new Date(day.year, day.month - 1, day.day);
    
    if (isStart) {
      onStartDateChange(selectedDate);
      setShowStartCalendar(false);
    } else {
      onEndDateChange(selectedDate);
      setShowEndCalendar(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dateContainer}>
        <View style={styles.dateField}>
          <Text style={styles.label}>{startLabel}</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowStartCalendar(true)}
          >
            <CalendarIcon size={20} color="#6b7280" />
            <Text style={styles.inputText}>
              {startDate ? startDate.toLocaleDateString() : 'Seleccionar fecha'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateField}>
          <Text style={styles.label}>{endLabel}</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowEndCalendar(true)}
          >
            <CalendarIcon size={20} color="#6b7280" />
            <Text style={styles.inputText}>
              {endDate ? endDate.toLocaleDateString() : 'Seleccionar fecha'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showStartCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStartCalendar(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Calendar
              onDayPress={(day) => handleDateSelect(day, true)}
              maxDate={endDate ? formatDate(endDate) : undefined}
              markedDates={startDate ? {
                [formatDate(startDate)]: { selected: true, selectedColor: '#6d28d9' }
              } : {}}
              theme={{
                todayTextColor: '#6d28d9',
                selectedDayBackgroundColor: '#6d28d9',
                selectedDayTextColor: '#ffffff',
              }}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowStartCalendar(false)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEndCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndCalendar(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Calendar
              onDayPress={(day) => handleDateSelect(day, false)}
              minDate={startDate ? formatDate(startDate) : undefined}
              markedDates={endDate ? {
                [formatDate(endDate)]: { selected: true, selectedColor: '#6d28d9' }
              } : {}}
              theme={{
                todayTextColor: '#6d28d9',
                selectedDayBackgroundColor: '#6d28d9',
                selectedDayTextColor: '#ffffff',
              }}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowEndCalendar(false)}
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
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
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