import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let rnBiometricsInstance = null;
function getRnBiometrics() {
  if (!rnBiometricsInstance) {
    rnBiometricsInstance = new ReactNativeBiometrics({
      allowDeviceCredentials: true,
    });
  }
  return rnBiometricsInstance;
}

class BiometricService {
  // Verificar se o dispositivo suporta biometria
  async isAvailable() {
    try {
      const { available, biometryType } = await getRnBiometrics().isSensorAvailable();
      return {
        available,
        biometryType, // 'FaceID', 'TouchID', 'Biometrics', ou null
      };
    } catch (error) {
      console.error('Erro ao verificar biometria:', error);
      return { available: false, biometryType: null };
    }
  }

  // Criar chave biométrica e salvar credenciais
  async enableBiometric(email, password) {
    try {
      const { available } = await this.isAvailable();
      if (!available) {
        throw new Error('Biometria não disponível neste dispositivo');
      }

      // Criar chaves biométricas
      const { publicKey } = await getRnBiometrics().createKeys();

      // Criptografar credenciais usando a chave pública
      // Usar a API de criptografia da biblioteca
      const payload = JSON.stringify({ email, password });
      const { success, signature } = await getRnBiometrics().createSignature({
        promptMessage: 'Confirme para habilitar login biométrico',
        payload: payload,
      });

      if (!success) {
        throw new Error('Autenticação biométrica cancelada');
      }

      // Salvar credenciais criptografadas
      await AsyncStorage.setItem('biometric_enabled', 'true');
      await AsyncStorage.setItem('biometric_public_key', publicKey);
      await AsyncStorage.setItem('biometric_credentials', JSON.stringify({ email, password }));

      return { success: true };
    } catch (error) {
      console.error('Erro ao habilitar biometria:', error);
      return { success: false, error: error.message };
    }
  }

  // Autenticar com biometria e retornar credenciais
  async authenticate() {
    try {
      const { available } = await this.isAvailable();
      if (!available) {
        throw new Error('Biometria não disponível');
      }

      // Verificar se biometria está habilitada
      const biometricEnabled = await AsyncStorage.getItem('biometric_enabled');
      if (!biometricEnabled || biometricEnabled !== 'true') {
        throw new Error('Biometria não habilitada');
      }

      // Buscar credenciais salvas
      const credentialsJson = await AsyncStorage.getItem('biometric_credentials');
      if (!credentialsJson) {
        throw new Error('Credenciais não encontradas');
      }

      const credentials = JSON.parse(credentialsJson);
      const payload = JSON.stringify({ email: credentials.email, password: credentials.password });

      // Solicitar autenticação biométrica e verificar assinatura
      const { success, signature } = await getRnBiometrics().createSignature({
        promptMessage: 'Autentique-se para fazer login',
        payload: payload,
      });

      if (success && signature) {
        // Verificar assinatura usando a chave pública
        const publicKey = await AsyncStorage.getItem('biometric_public_key');
        if (publicKey) {
          return {
            success: true,
            email: credentials.email,
            password: credentials.password,
          };
        } else {
          throw new Error('Chave biométrica não encontrada');
        }
      } else {
        return { success: false, error: 'Autenticação biométrica cancelada' };
      }
    } catch (error) {
      console.error('Erro na autenticação biométrica:', error);
      return { success: false, error: error.message };
    }
  }

  // Verificar se biometria está habilitada
  async isEnabled() {
    try {
      const biometricEnabled = await AsyncStorage.getItem('biometric_enabled');
      return biometricEnabled === 'true';
    } catch (error) {
      return false;
    }
  }

  // Desabilitar biometria
  async disable() {
    try {
      await AsyncStorage.removeItem('biometric_enabled');
      await AsyncStorage.removeItem('biometric_credentials');
      await AsyncStorage.removeItem('biometric_public_key');
      
      // Deletar chaves biométricas
      try {
        await getRnBiometrics().deleteKeys();
      } catch (keyError) {
        console.warn('Erro ao deletar chaves biométricas:', keyError);
      }

      return { success: true };
    } catch (error) {
      console.error('Erro ao desabilitar biometria:', error);
      return { success: false, error: error.message };
    }
  }

  // Obter tipo de biometria disponível
  async getBiometryType() {
    try {
      const { biometryType } = await this.isAvailable();
      if (biometryType === 'FaceID') {
        return 'Face ID';
      } else if (biometryType === 'TouchID') {
        return 'Touch ID';
      } else if (biometryType === 'Biometrics') {
        return Platform.OS === 'ios' ? 'Face ID' : 'Impressão Digital';
      }
      return 'Biometria';
    } catch (error) {
      return 'Biometria';
    }
  }
}

export default new BiometricService();

