import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { LogOut } from 'lucide-react-native';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Limpiar todos los datos de sesión
      await SecureStore.deleteItemAsync('userSession');
      await SecureStore.deleteItemAsync('employeeId');
      await SecureStore.deleteItemAsync('supervisorEmail');
      await SecureStore.deleteItemAsync('supervisorData');
      
      // Redirigir directamente al index principal
      // Usamos reset para limpiar completamente el stack de navegación
      router.replace('/(auth)/index');
      
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleLogout}>
      <LogOut size={20} color="#ef4444" />
      <Text style={styles.text}>Cerrar</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  text: {
    color: '#ef4444',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});