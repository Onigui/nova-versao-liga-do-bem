import { Alert, Linking, Platform } from 'react-native';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFetchBlob from 'rn-fetch-blob';
import { PermissionsAndroid, NativeModules } from 'react-native';

// Importar versão do app.json dinamicamente
// Nota: Em React Native, require pode não funcionar em runtime
// Por isso, vamos usar valores do package.json que são incluídos no bundle
let CURRENT_VERSION = '1.2.3';
let CURRENT_VERSION_CODE = 5;

// Tentar ler do app.json (pode não funcionar em runtime, mas tentamos)
try {
  // Em desenvolvimento, isso funciona
  const appConfig = require('../../app.json');
  if (appConfig && appConfig.version) {
    CURRENT_VERSION = appConfig.version;
  }
  if (appConfig && appConfig.versionCode) {
    CURRENT_VERSION_CODE = appConfig.versionCode;
  }
} catch (error) {
  // Em produção, os valores são definidos no build.gradle
  // Por isso mantemos os valores padrão que devem corresponder ao build.gradle
  console.warn('Não foi possível ler app.json em runtime, usando valores padrão:', {
    version: CURRENT_VERSION,
    versionCode: CURRENT_VERSION_CODE,
  });
}

// IMPORTANTE: Estes valores devem corresponder ao mobile/android/app/build.gradle
// versionCode e versionName devem ser atualizados manualmente antes de cada build

class UpdateService {
  async checkForUpdates() {
    try {
      console.log('🔍 Verificando atualizações...', {
        currentVersion: CURRENT_VERSION,
        currentVersionCode: CURRENT_VERSION_CODE,
      });

      const response = await fetch(
        `${API_BASE_PATH}/app/version?platform=android&version=${CURRENT_VERSION}&versionCode=${CURRENT_VERSION_CODE}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📱 Resposta da verificação de versão:', data);
        
        // Garantir que hasUpdate só seja true se realmente houver atualização
        if (data.hasUpdate && data.latestVersion) {
          const latestVersionCode = data.latestVersion.versionCode || 0;
          // Verificar novamente no cliente para garantir
          if (latestVersionCode <= CURRENT_VERSION_CODE) {
            console.log('⚠️ Backend retornou hasUpdate=true, mas versão não é maior. Corrigindo...');
            data.hasUpdate = false;
          }
        }
        
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao verificar atualizações:', error);
      return null;
    }
  }

  async requestStoragePermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      // Para Android 13+ (API 33+), não precisa de WRITE_EXTERNAL_STORAGE
      if (Platform.Version >= 33) {
        // Usar REQUEST_INSTALL_PACKAGES para instalar APKs
        const installPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.REQUEST_INSTALL_PACKAGES,
          {
            title: 'Permissão de Instalação',
            message: 'O app precisa de permissão para instalar atualizações',
            buttonNeutral: 'Perguntar depois',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
          },
        );
        return installPermission === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // Para Android < 13, usar WRITE_EXTERNAL_STORAGE
        const storagePermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Permissão de Armazenamento',
            message: 'O app precisa de permissão para baixar atualizações',
            buttonNeutral: 'Perguntar depois',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
          },
        );
        return storagePermission === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('Erro ao solicitar permissão:', err);
      return false;
    }
  }

  async downloadAPK(apkUrl, onProgress) {
    try {
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        throw new Error('Permissão de armazenamento negada');
      }

      const { config, fs } = RNFetchBlob;
      const downloads = fs.dirs.DownloadDir;
      const fileName = `liga-do-bem-update-${Date.now()}.apk`;
      const filePath = `${downloads}/${fileName}`;

      const downloadTask = config({
        fileCache: true,
        path: filePath,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          title: 'Baixando atualização Liga do Bem',
          description: 'Aguarde enquanto baixamos a nova versão...',
          mime: 'application/vnd.android.package-archive',
          mediaScannable: true,
        },
      }).fetch('GET', apkUrl);

      downloadTask.progress((received, total) => {
        const progress = received / total;
        if (onProgress) {
          onProgress(progress);
        }
      });

      const res = await downloadTask;
      return res.path();
    } catch (error) {
      console.error('Erro ao baixar APK:', error);
      throw error;
    }
  }

  // Método removido - causa crash nativo
  // A instalação agora é manual pelo usuário
  async installAPK(filePath) {
    // Este método não é mais usado, mas mantido para compatibilidade
    throw new Error('Instalação automática desabilitada para evitar crash. Use openDownloadsFolder()');
  }

  // Novo método: Abrir pasta Downloads sem tentar instalar APK
  async openDownloadsFolder() {
    try {
      if (Platform.OS !== 'android') {
        throw new Error('Apenas Android suportado');
      }

      const { fs } = RNFetchBlob;
      const downloads = fs.dirs.DownloadDir;
      
      // Tentar abrir a pasta Downloads usando Intent do Android
      // Isso é mais seguro que tentar instalar o APK diretamente
      try {
        // Usar Intent para abrir o gerenciador de arquivos na pasta Downloads
        const Intent = require('react-native').NativeModules.IntentAndroid;
        if (Intent) {
          Intent.openURL(`content://com.android.externalstorage.documents/document/primary:Download`);
        } else {
          // Fallback: tentar abrir com Linking usando content://
          await Linking.openURL(`content://com.android.externalstorage.documents/document/primary:Download`);
        }
      } catch (intentError) {
        // Se falhar, tentar abrir com file://
        try {
          await Linking.openURL(`file://${downloads}`);
        } catch (linkingError) {
          console.warn('Não foi possível abrir pasta Downloads automaticamente');
          // Não lançar erro, apenas logar
        }
      }
    } catch (error) {
      console.error('Erro ao abrir pasta Downloads:', error);
      // Não lançar erro para não quebrar o fluxo
    }
  }


  showUpdateDialog(updateInfo, onUpdate, onLater) {
    const { latestVersion, isMandatory, releaseNotes } = updateInfo;
    
    Alert.alert(
      isMandatory ? 'Atualização Obrigatória' : 'Nova Versão Disponível',
      `Uma nova versão (${latestVersion.version}) está disponível.\n\n${releaseNotes || 'Melhorias e correções de bugs.'}\n\n${isMandatory ? 'Esta atualização é obrigatória para continuar usando o app.' : 'Deseja atualizar agora?'}`,
      isMandatory
        ? [
            {
              text: 'Atualizar Agora',
              onPress: onUpdate,
              style: 'default',
            },
          ]
        : [
            {
              text: 'Depois',
              onPress: onLater,
              style: 'cancel',
            },
            {
              text: 'Atualizar Agora',
              onPress: onUpdate,
              style: 'default',
            },
          ],
      { cancelable: !isMandatory },
    );
  }
}

export default new UpdateService();

