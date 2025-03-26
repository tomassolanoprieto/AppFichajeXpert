import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';
import { Lock, Mail, Clock, Check, Fingerprint, Scan } from 'lucide-react-native';
import { 
  isBiometricAvailable, 
  getBiometricType,
  authenticateWithBiometrics,
  getBiometricCredentials,
  saveBiometricCredentials
} from '@/lib/biometrics';

export default function Auth() {
  const router = useRouter();
  const { type } = useLocalSearchParams();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'facial' | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    checkExistingSession();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const available = await isBiometricAvailable();
      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);
        
        // Check if user has saved biometric credentials
        const credentials = await getBiometricCredentials(type as 'employee' | 'supervisor', email);
        setBiometricEnabled(!!credentials);
        
        // Show biometric prompt immediately if credentials exist
        if (credentials) {
          setShowBiometricPrompt(true);
          handleBiometricAuth();
        }
      }
    } catch (err) {
      console.error('Error checking biometric availability:', err);
    }
  };

  const checkExistingSession = async () => {
    try {
      const session = await SecureStore.getItemAsync('userSession');
      if (session) {
        const { userType, email, expiresAt } = JSON.parse(session);
        if (new Date().getTime() < expiresAt && userType === type) {
          if (userType === 'employee') {
            const { data } = await supabase
              .from('employee_profiles')
              .select('id')
              .eq('email', email)
              .single();
            if (data) {
              await SecureStore.setItemAsync('employeeId', data.id);
              router.replace('/(employee)');
            }
          } else {
            const { data: supervisorData } = await supabase
              .from('supervisor_profiles')
              .select('*')
              .eq('email', email)
              .single();
            
            if (supervisorData) {
              await SecureStore.setItemAsync('supervisorEmail', email);
              await SecureStore.setItemAsync('supervisorData', JSON.stringify({
                id: supervisorData.id,
                work_centers: supervisorData.work_centers,
                supervisor_type: supervisorData.supervisor_type,
                delegations: supervisorData.delegations
              }));
              router.replace('/(supervisor)');
            }
          }
        } else {
          await SecureStore.deleteItemAsync('userSession');
          await SecureStore.deleteItemAsync('employeeId');
          await SecureStore.deleteItemAsync('supervisorEmail');
          await SecureStore.deleteItemAsync('supervisorData');
        }
      }
    } catch (err) {
      console.error('Error checking session:', err);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      const credentials = await getBiometricCredentials(type as 'employee' | 'supervisor', email);
      if (!credentials) {
        throw new Error('No se encontraron credenciales biométricas');
      }

      const { success, error: authError } = await authenticateWithBiometrics(
        `Autenticación ${biometricType === 'facial' ? 'facial' : 'de huella digital'}`
      );

      if (success) {
        // Use stored credentials to log in
        setEmail(credentials.email);
        setPin(credentials.pin);
        await handleLogin(credentials.email, credentials.pin);
      } else {
        throw new Error(authError || 'Error en la autenticación biométrica');
      }
    } catch (err) {
      console.error('Error in biometric auth:', err);
      setError(err instanceof Error ? err.message : 'Error en la autenticación biométrica');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (loginEmail = email, loginPin = pin) => {
    try {
      setLoading(true);
      setError(null);

      if (!loginEmail || !loginPin) {
        throw new Error('Por favor, completa todos los campos');
      }

      if (type === 'employee') {
        const { data: employeeData, error: employeeError } = await supabase
          .from('employee_profiles')
          .select('id')
          .eq('email', loginEmail)
          .eq('pin', loginPin)
          .eq('is_active', true)
          .single();

        if (employeeError || !employeeData) {
          throw new Error('Credenciales inválidas');
        }

        await SecureStore.setItemAsync('employeeId', employeeData.id);
        
        const session = {
          userType: 'employee',
          email: loginEmail,
          expiresAt: new Date().getTime() + 24 * 60 * 60 * 1000,
        };
        await SecureStore.setItemAsync('userSession', JSON.stringify(session));

        // Ask to save biometric credentials if available and not already saved
        if (biometricType && !biometricEnabled) {
          Alert.alert(
            'Activar autenticación biométrica',
            `¿Deseas activar la autenticación ${biometricType === 'facial' ? 'facial' : 'de huella digital'} para futuros inicios de sesión?`,
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Sí',
                onPress: async () => {
                  await saveBiometricCredentials({
                    email: loginEmail,
                    pin: loginPin,
                    type: 'employee'
                  });
                }
              }
            ]
          );
        }

        router.replace('/(employee)');
      } else if (type === 'supervisor') {
        const { data: supervisorData, error: supervisorError } = await supabase
          .from('supervisor_profiles')
          .select('*')
          .eq('email', loginEmail)
          .eq('pin', loginPin)
          .eq('is_active', true)
          .single();

        if (supervisorError || !supervisorData) {
          throw new Error('Credenciales inválidas');
        }

        await SecureStore.setItemAsync('supervisorEmail', loginEmail);
        await SecureStore.setItemAsync('supervisorData', JSON.stringify({
          id: supervisorData.id,
          work_centers: supervisorData.work_centers,
          supervisor_type: supervisorData.supervisor_type,
          delegations: supervisorData.delegations
        }));
        
        const session = {
          userType: 'supervisor',
          email: loginEmail,
          expiresAt: new Date().getTime() + 24 * 60 * 60 * 1000,
        };
        await SecureStore.setItemAsync('userSession', JSON.stringify(session));

        // Ask to save biometric credentials if available and not already saved
        if (biometricType && !biometricEnabled) {
          Alert.alert(
            'Activar autenticación biométrica',
            `¿Deseas activar la autenticación ${biometricType === 'facial' ? 'facial' : 'de huella digital'} para futuros inicios de sesión?`,
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Sí',
                onPress: async () => {
                  await saveBiometricCredentials({
                    email: loginEmail,
                    pin: loginPin,
                    type: 'supervisor'
                  });
                }
              }
            ]
          );
        }

        router.replace('/(supervisor)');
      }
    } catch (err) {
      console.error('Error de inicio de sesión:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?q=80&w=2070&auto=format&fit=crop' }}
      style={styles.container}
      imageStyle={styles.backgroundImage}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.overlay}>
            <View style={styles.content}>
              <View style={styles.logoContainer}>
                <View style={styles.logoWrapper}>
                  <Text style={styles.logoPart1}>Fichaje</Text>
                  <Text style={styles.logoPart2}>Xpert</Text>
                  <View style={styles.iconContainer}>
                    <View style={styles.clockIconWrapper}>
                      <Clock size={24} color="#ffffff" />
                    </View>
                    <View style={styles.checkIconWrapper}>
                      <Check size={16} color="#22c55e" />
                    </View>
                  </View>
                </View>
                <Text style={styles.portalType}>
                  {type === 'employee' ? 'Portal Empleado' : 'Portal Supervisor'}
                </Text>
              </View>

              <View style={styles.formContainer}>
                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Mail size={20} color="#6b7280" />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Correo electrónico"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Lock size={20} color="#6b7280" />
                  <TextInput
                    style={styles.input}
                    value={pin}
                    onChangeText={setPin}
                    placeholder="PIN (6 dígitos)"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.loginButton,
                    type === 'employee' ? styles.employeeButton : styles.supervisorButton,
                    loading && styles.loginButtonDisabled
                  ]}
                  onPress={() => handleLogin()}
                  disabled={loading}
                >
                  <Text style={styles.loginButtonText}>
                    {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                  </Text>
                </TouchableOpacity>

                {biometricType && (
                  <TouchableOpacity
                    style={[
                      styles.biometricButton,
                      type === 'employee' ? styles.employeeBiometricButton : styles.supervisorBiometricButton,
                      loading && styles.loginButtonDisabled
                    ]}
                    onPress={handleBiometricAuth}
                    disabled={loading}
                  >
                    {biometricType === 'facial' ? (
                      <Scan size={24} color="#ffffff" />
                    ) : (
                      <Fingerprint size={24} color="#ffffff" />
                    )}
                    <Text style={styles.biometricButtonText}>
                      {biometricType === 'facial' 
                        ? 'Usar reconocimiento facial'
                        : 'Usar huella digital'
                      }
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.backButtonText}>Volver</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoPart1: {
    fontSize: 36,
    color: '#3b82f6',
    fontFamily: 'Inter_700Bold',
  },
  logoPart2: {
    fontSize: 36,
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
  portalType: {
    fontSize: 24,
    color: '#111827',
    fontFamily: 'Inter_600SemiBold',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  loginButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  employeeBiometricButton: {
    backgroundColor: '#059669',
  },
  supervisorBiometricButton: {
    backgroundColor: '#4f46e5',
  },
  biometricButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
});