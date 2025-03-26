import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationsPermission() {
  if (Platform.OS === 'web') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function getSupervisorsByWorkCenter(workCenter: string) {
  try {
    const { data: supervisors, error } = await supabase
      .from('supervisor_profiles')
      .select('*')
      .contains('work_centers', [workCenter])
      .eq('supervisor_type', 'center')
      .eq('is_active', true);

    if (error) throw error;
    return supervisors || [];
  } catch (err) {
    console.error('Error getting supervisors:', err);
    return [];
  }
}

export async function scheduleWorkNotification(
  employeeId: string,
  employeeName: string,
  workCenter: string,
  day: number, // 0-6 for Sunday-Saturday
  time: string, // HH:mm format
  delayMinutes: number,
  type: 'entry' | 'exit' // New parameter to differentiate between entry and exit notifications
) {
  if (Platform.OS === 'web') {
    return null;
  }

  // Parse the time
  const [hours, minutes] = time.split(':').map(Number);
  
  // Calculate next occurrence of this day and time
  const now = new Date();
  const targetDate = new Date();
  
  // Set the target time
  targetDate.setHours(hours, minutes + delayMinutes, 0);
  
  // Adjust the date to the next occurrence of the specified day
  const currentDay = targetDate.getDay();
  if (currentDay !== day) {
    const daysUntilTarget = (day - currentDay + 7) % 7;
    targetDate.setDate(targetDate.getDate() + daysUntilTarget);
  }
  
  // If the time has already passed today, move to next week
  if (targetDate <= now) {
    targetDate.setDate(targetDate.getDate() + 7);
  }

  // Get supervisors for the work center
  const supervisors = await getSupervisorsByWorkCenter(workCenter);

  // Schedule notification for employee with different messages based on type
  const employeeNotificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: type === 'entry' ? '¡Recordatorio de entrada!' : '¡Recordatorio de salida!',
      body: type === 'entry' 
        ? 'No has registrado tu entrada todavía. Por favor, registra tu fichaje.'
        : 'No has registrado tu salida todavía. Por favor, registra tu fichaje.',
      data: { type: 'work_reminder', employeeId, reminderType: type },
    },
    trigger: {
      date: targetDate,
      repeats: true,
    },
  });

  // Schedule notifications for supervisors with different messages based on type
  const supervisorNotifications = await Promise.all(
    supervisors.map(supervisor =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: type === 'entry' ? 'Alerta de entrada' : 'Alerta de salida',
          body: type === 'entry'
            ? `El empleado ${employeeName} no ha registrado su entrada en ${workCenter}`
            : `El empleado ${employeeName} no ha registrado su salida en ${workCenter}`,
          data: { 
            type: 'supervisor_reminder', 
            employeeId,
            workCenter,
            supervisorId: supervisor.id,
            reminderType: type
          },
        },
        trigger: {
          date: targetDate,
          repeats: true,
        },
      })
    )
  );

  return {
    employeeNotificationId,
    supervisorNotificationIds: supervisorNotifications,
  };
}

export async function cancelAllWorkNotifications() {
  if (Platform.OS === 'web') {
    return;
  }
  
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function setupWorkScheduleNotifications(
  employeeId: string,
  employeeName: string,
  workCenters: string[],
  workSchedule: { [key: string]: { start_time: string, end_time: string } | null },
  notificationMinutes: number
) {
  if (Platform.OS === 'web') {
    return;
  }

  // First, cancel all existing notifications
  await cancelAllWorkNotifications();

  // Request permissions if not already granted
  const permissionGranted = await requestNotificationsPermission();
  if (!permissionGranted) {
    return;
  }

  // Map day names to numbers (0-6)
  const dayMapping: { [key: string]: number } = {
    'Domingo': 0,
    'Lunes': 1,
    'Martes': 2,
    'Miércoles': 3,
    'Jueves': 4,
    'Viernes': 5,
    'Sábado': 6,
  };

  // Schedule notifications for each working day and work center
  const notifications = [];
  for (const [day, schedule] of Object.entries(workSchedule)) {
    if (schedule?.start_time && schedule?.end_time) {
      const dayNumber = dayMapping[day];
      
      // Schedule notifications for each work center
      for (const workCenter of workCenters) {
        // Schedule entry notification
        const entryNotificationIds = await scheduleWorkNotification(
          employeeId,
          employeeName,
          workCenter,
          dayNumber,
          schedule.start_time,
          notificationMinutes,
          'entry'
        );

        // Schedule exit notification
        const exitNotificationIds = await scheduleWorkNotification(
          employeeId,
          employeeName,
          workCenter,
          dayNumber,
          schedule.end_time,
          notificationMinutes,
          'exit'
        );

        if (entryNotificationIds || exitNotificationIds) {
          notifications.push({ 
            day, 
            workCenter,
            entry: entryNotificationIds,
            exit: exitNotificationIds
          });
        }
      }
    }
  }

  return notifications;
}