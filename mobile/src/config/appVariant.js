import {NativeModules} from 'react-native';

/**
 * Qual app está rodando: 'member' (Liga do Bem) ou 'partner' (Liga do Bem Parceiros).
 * Vem do flavor do Android (BuildConfig.FLAVOR). Sem o módulo nativo (testes, APK antigo) = 'member'.
 */
export const APP_VARIANT =
  NativeModules?.ApkInstaller?.APP_VARIANT === 'partner' ? 'partner' : 'member';

export const IS_PARTNER_APP = APP_VARIANT === 'partner';

/** Instalado pela Play Store: as atualizações vêm da loja (sem baixar APK dentro do app). */
export const IS_PLAY_STORE = NativeModules?.ApkInstaller?.PLAY_STORE === true;
