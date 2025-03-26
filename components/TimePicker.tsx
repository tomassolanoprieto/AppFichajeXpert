import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { Clock } from 'lucide-react-native';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
}

export default function TimePicker({ value, onChange, label, placeholder }: TimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(value ? parseInt(value.split(':')[0]) : 0);
  const [selectedMinute, setSelectedMinute] = useState(value ? parseInt(value.split(':')[1]) : 0);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleConfirm = () => {
    const formattedHour = selectedHour.toString().padStart(2, '0');
    const formattedMinute = selectedMinute.toString().padStart(2, '0');
    onChange(`${formattedHour}:${formattedMinute}`);
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowPicker(true)}
      >
        <Clock size={20} color="#6b7280" />
        <Text style={styles.inputText}>
          {value || placeholder || 'Seleccionar hora'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar Hora</Text>
            
            <View style={styles.timeContainer}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>Horas</Text>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                  {hours.map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.timeOption,
                        selectedHour === hour && styles.timeOptionSelected
                      ]}
                      onPress={() => setSelectedHour(hour)}
                    >
                      <Text style={[
                        styles.timeText,
                        selectedHour === hour && styles.timeTextSelected
                      ]}>
                        {hour.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.timeSeparator}>
                <Text style={styles.timeSeparatorText}>:</Text>
              </View>

              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>Minutos</Text>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                  {minutes.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.timeOption,
                        selectedMinute === minute && styles.timeOptionSelected
                      ]}
                      onPress={() => setSelectedMinute(minute)}
                    >
                      <Text style={[
                        styles.timeText,
                        selectedMinute === minute && styles.timeTextSelected
                      ]}>
                        {minute.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowPicker(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={[styles.buttonText, styles.confirmButtonText]}>Confirmar</Text>
              </TouchableOpacity>
            </View>
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
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter_500Medium',
  },
  timeScroll: {
    height: 200,
  },
  timeOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    alignItems: 'center',
  },
  timeOptionSelected: {
    backgroundColor: '#6d28d9',
  },
  timeText: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  timeTextSelected: {
    color: '#ffffff',
    fontFamily: 'Inter_600SemiBold',
  },
  timeSeparator: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  timeSeparatorText: {
    fontSize: 24,
    color: '#6b7280',
    fontFamily: 'Inter_600SemiBold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  confirmButton: {
    backgroundColor: '#6d28d9',
  },
  buttonText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter_600SemiBold',
  },
  confirmButtonText: {
    color: '#ffffff',
  },
});