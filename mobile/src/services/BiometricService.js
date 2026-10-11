import ReactNativeBiometrics from 'react-native-biometrics';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';

/**
 * Login por biometria.
 *
 * As credenciais ficam no Keystore do Android (react-native-keychain), cifradas com uma chave
 * que SÓ libera a leitura após digital/rosto (BIOMETRY_CURRENT_SET). Antes, e-mail e senha
 * ficavam em texto aberto no AsyncStorage e a biometria era só uma "porta" na tela.
 */
const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

const SERVICE = 'liga-do-bem.biometric-login';
const ENABLED_KEY = 'biometric_enabled';
// Chaves do formato antigo (senha em texto aberto) — apagadas na migração.
const LEGACY_KEYS = ['biometric_credentials', 'biometric_public_key'];

const KEYCHAIN_OPTIONS = {
  service: SERVICE,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  storage: Keychain.STORAGE_TYPE.RSA,
};

// Erros do Keystore que não se resolvem tentando de novo: a chave foi invalidada
// (digital/rosto cadastrado ou removido, bloqueio de tela alterado) ou não existe mais.
const PERMANENT_KEY_ERROR =
  /permanently invalidated|KeyPermanentlyInvalidated|key not found|no key|Key does not exist|UserNotAuthenticated/i;
const CANCEL_ERROR = /cancel/i;

class BiometricService {
  isPermanentKeyError(message) {
    return PERMANENT_KEY_ERROR.test(String(message || ''));
  }

  // Verificar se o dispositivo suporta biometria
  async isAvailable() {
    try {
      const {available, biometryType} = await rnBiometrics.isSensorAvailable();
      return {
        available,
        biometryType, // 'FaceID', 'TouchID', 'Biometrics', ou null
      };
    } catch (error) {
      console.error('Erro ao verificar biometria:', error);
      return {available: false, biometryType: null};
    }
  }

  /**
   * Migração do formato antigo: se ainda houver senha em texto aberto no AsyncStorage,
   * apaga tudo e desliga a biometria (o app oferece reativar no próximo login com senha).
   */
  async migrateLegacyStorage() {
    try {
      const legacy = await AsyncStorage.getItem('biometric_credentials');
      if (!legacy) {
        return false;
      }
      await AsyncStorage.removeItem(ENABLED_KEY);
      for (const key of LEGACY_KEYS) {
        await AsyncStorage.removeItem(key);
      }
      try {
        await rnBiometrics.deleteKeys();
      } catch {
        // chaves antigas podem não existir
      }
      return true;
    } catch {
      return false;
    }
  }

  // Salvar credenciais no Keystore e confirmar com a biometria
  async enableBiometric(email, password) {
    try {
      const {available} = await this.isAvailable();
      if (!available) {
        throw new Error('Biometria não disponível neste dispositivo');
      }
      await this.migrateLegacyStorage();

      const saved = await Keychain.setGenericPassword(
        email,
        password,
        KEYCHAIN_OPTIONS,
      );
      if (!saved) {
        throw new Error(
          'Não foi possível guardar as credenciais com segurança',
        );
      }

      // Confirma que a leitura com biometria funciona antes de ligar a opção
      const check = await Keychain.getGenericPassword({
        service: SERVICE,
        authenticationPrompt: {
          title: 'Confirme para habilitar o login biométrico',
          cancel: 'Cancelar',
        },
      });
      if (!check || check.username !== email) {
        await Keychain.resetGenericPassword({service: SERVICE});
        throw new Error('Autenticação biométrica cancelada');
      }

      await AsyncStorage.setItem(ENABLED_KEY, 'true');
      return {success: true};
    } catch (error) {
      console.error('Erro ao habilitar biometria:', error);
      try {
        await Keychain.resetGenericPassword({service: SERVICE});
      } catch {
        // nada a limpar
      }
      return {
        success: false,
        error: CANCEL_ERROR.test(error?.message || '')
          ? 'Autenticação biométrica cancelada'
          : error.message,
      };
    }
  }

  // Autenticar com biometria e retornar credenciais
  async authenticate() {
    try {
      const {available} = await this.isAvailable();
      if (!available) {
        throw new Error('Biometria não disponível');
      }
      if (!(await this.isEnabled())) {
        throw new Error('Biometria não habilitada');
      }

      const credentials = await Keychain.getGenericPassword({
        service: SERVICE,
        authenticationPrompt: {
          title: 'Autentique-se para fazer login',
          cancel: 'Cancelar',
        },
      });

      if (!credentials) {
        // Nada guardado (ex.: dados do app limpos): a opção não tem mais como funcionar.
        await this.disable();
        return {
          success: false,
          invalidated: true,
          error: 'Credenciais não encontradas',
        };
      }

      return {
        success: true,
        email: credentials.username,
        password: credentials.password,
      };
    } catch (error) {
      const message = String(error?.message || error || '');
      if (CANCEL_ERROR.test(message)) {
        return {success: false, cancelled: true, error: 'cancel'};
      }
      console.error('Erro na autenticação biométrica:', error);
      if (this.isPermanentKeyError(message)) {
        // A chave antiga nunca mais vai funcionar: desliga a biometria e limpa os dados guardados.
        await this.disable();
        return {success: false, invalidated: true, error: message};
      }
      return {success: false, error: message};
    }
  }

  // Verificar se biometria está habilitada (migra o formato antigo, se houver)
  async isEnabled() {
    try {
      if (await this.migrateLegacyStorage()) {
        return false;
      }
      return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
    } catch (error) {
      return false;
    }
  }

  // Desabilitar biometria
  async disable() {
    try {
      await AsyncStorage.removeItem(ENABLED_KEY);
      for (const key of LEGACY_KEYS) {
        await AsyncStorage.removeItem(key);
      }
      try {
        await Keychain.resetGenericPassword({service: SERVICE});
      } catch (keyError) {
        console.warn('Erro ao apagar credenciais do Keystore:', keyError);
      }
      try {
        await rnBiometrics.deleteKeys();
      } catch {
        // chaves do formato antigo podem não existir
      }
      return {success: true};
    } catch (error) {
      console.error('Erro ao desabilitar biometria:', error);
      return {success: false, error: error.message};
    }
  }

  // Obter tipo de biometria disponível
  async getBiometryType() {
    try {
      const {biometryType} = await this.isAvailable();
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
