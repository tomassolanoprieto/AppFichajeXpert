import { Platform } from 'react-native';

export interface BiometricCredentials {
  email: string;
  pin: string;
  type: 'employee' | 'supervisor';
}

// Web-safe implementation that always returns false
export async function isBiometricAvailable() {
  return false;
}

export async function getBiometricType() {
  return null;
}

export async function saveBiometricCredentials(credentials: BiometricCredentials) {
  return false;
}

export async function getBiometricCredentials(type: 'employee' | 'supervisor', email: string) {
  return null;
}

export async function authenticateWithBiometrics(promptMessage: string = 'Autenticación biométrica') {
  return { success: false, error: 'Biometrics not available on web' };
}

export async function removeBiometricCredentials(type: 'employee' | 'supervisor', email: string) {
  return false;
}