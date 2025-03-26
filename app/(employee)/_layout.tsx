import { Tabs } from 'expo-router';
import { Clock, FileText, History, User } from 'lucide-react-native';
import LogoutButton from '@/components/LogoutButton';

export default function EmployeeLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { paddingBottom: 8, height: 60 },
      tabBarActiveTintColor: '#22c55e',
      tabBarLabelStyle: { fontFamily: 'Inter_500Medium' },
      headerRight: () => <LogoutButton />,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Fichar',
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Solicitudes',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}