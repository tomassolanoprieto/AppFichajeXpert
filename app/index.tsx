import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, UserCog, Clock, Check } from 'lucide-react-native';

export default function Home() {
  const router = useRouter();

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?q=80&w=2070&auto=format&fit=crop' }}
      style={styles.container}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <View style={styles.titleWrapper}>
              <Text style={styles.titlePart1}>Fichaje</Text>
              <Text style={styles.titlePart2}>Xpert</Text>
              <View style={styles.iconContainer}>
                <View style={styles.clockIconWrapper}>
                  <Clock size={24} color="#ffffff" />
                </View>
                <View style={styles.checkIconWrapper}>
                  <Check size={16} color="#22c55e" />
                </View>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Gestión inteligente del tiempo de trabajo para empresas con múltiples centros y equipos.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.employeeButton]}
              onPress={() => router.push('/auth?type=employee')}
            >
              <Users size={32} color="white" />
              <Text style={styles.buttonText}>Portal Empleado</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.supervisorButton]}
              onPress={() => router.push('/auth?type=supervisor')}
            >
              <UserCog size={32} color="white" />
              <Text style={styles.buttonText}>Portal Supervisor Centro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.15,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 48,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  titlePart1: {
    fontSize: 40,
    color: '#3b82f6',
    fontFamily: 'Inter_700Bold',
  },
  titlePart2: {
    fontSize: 40,
    color: '#22c55e',
    fontFamily: 'Inter_700Bold',
  },
  iconContainer: {
    marginLeft: 12,
    position: 'relative',
  },
  clockIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#22c55e',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  checkIconWrapper: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 24,
    fontFamily: 'Inter_400Regular',
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  employeeButton: {
    backgroundColor: '#22c55e',
  },
  supervisorButton: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
});