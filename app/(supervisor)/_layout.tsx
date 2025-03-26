import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { ChartBar as BarChart, Shield, FileText } from 'lucide-react-native';
import LogoutButton from '@/components/LogoutButton';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import { View, Text, StyleSheet } from 'react-native';

export default function SupervisorLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadNotifications = async () => {
      try {
        const supervisorEmail = await SecureStore.getItemAsync('supervisorEmail');
        if (!supervisorEmail) return;

        const { data: supervisor } = await supabase
          .from('supervisor_profiles')
          .select('id')
          .eq('email', supervisorEmail)
          .single();

        if (!supervisor) return;

        const { count } = await supabase
          .from('supervisor_notifications')
          .select('count', { count: 'exact' })
          .eq('supervisor_id', supervisor.id)
          .eq('is_read', false);

        setUnreadCount(count || 0);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    // Initial fetch
    fetchUnreadNotifications();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('supervisor_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'supervisor_notifications'
        },
        () => {
          fetchUnreadNotifications();
        }
      )
      .subscribe();

    // Subscribe to time_requests changes
    const timeRequestsChannel = supabase
      .channel('time_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'time_requests'
        },
        () => {
          fetchUnreadNotifications();
        }
      )
      .subscribe();

    // Subscribe to planner_requests changes
    const plannerRequestsChannel = supabase
      .channel('planner_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'planner_requests'
        },
        () => {
          fetchUnreadNotifications();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      timeRequestsChannel.unsubscribe();
      plannerRequestsChannel.unsubscribe();
    };
  }, []);

  return (
    <Tabs screenOptions={{
      tabBarStyle: { 
        paddingBottom: 8, 
        height: 60,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
      },
      tabBarActiveTintColor: '#6d28d9',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarLabelStyle: { 
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
      },
      headerStyle: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
      },
      headerTitleStyle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
        color: '#111827',
      },
      headerRight: () => <LogoutButton />,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vista General',
          tabBarIcon: ({ color, size }) => <Shield size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Solicitudes',
          tabBarIcon: ({ color, size }) => (
            <View>
              <FileText size={size} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Informes',
          tabBarIcon: ({ color, size }) => <BarChart size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -6,
    top: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 4,
  },
});