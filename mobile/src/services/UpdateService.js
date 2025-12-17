import { Alert, Linking, Platform } from 'react-native';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFetchBlob from 'rn-fetch-blob';
import { PermissionsAndroid } from 'react-native';

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

  async installAPK(filePath) {
    try {
      if (Platform.OS !== 'android') {
        throw new Error('Instalação de APK só é suportada no Android');
      }

      console.log('📦 Tentando instalar APK:', filePath);

      // Verificar se o arquivo existe
      const { fs } = RNFetchBlob;
      const fileExists = await fs.exists(filePath);
      if (!fileExists) {
        throw new Error('Arquivo APK não encontrado');
      }

      // Método mais seguro: usar Linking que é mais estável e não causa crash
      // Linking.openURL com file:// funciona bem no Android
      try {
        // Construir URI file://
        const fileUri = `file://${filePath}`;
        console.log('📱 Tentando abrir APK via Linking:', fileUri);
        
        // Usar Linking.openURL diretamente (mais confiável que actionViewIntent)
        await Linking.openURL(fileUri);
        console.log('✅ APK aberto via Linking com sucesso');
        return; // Sucesso
      } catch (linkingError) {
        console.warn('⚠️ Erro ao usar Linking com file://, tentando actionViewIntent:', linkingError);
        
        // Fallback: tentar actionViewIntent (mas envolver em try-catch robusto)
        try {
          // Chamar actionViewIntent de forma segura
          // Usar setTimeout para garantir que não causa crash síncrono
          await new Promise((resolveIntent, rejectIntent) => {
            setTimeout(() => {
              try {
                const result = RNFetchBlob.android.actionViewIntent(
                  filePath,
                  'application/vnd.android.package-archive',
                );
                
                // Se retornar Promise
                if (result && typeof result.then === 'function') {
                  result.then(() => {
                    console.log('✅ Intent de instalação enviado com sucesso');
                    resolveIntent();
                  }).catch(rejectIntent);
                } else {
                  // Se não retornar Promise, assumir sucesso
                  console.log('✅ Intent de instalação enviado (sem Promise)');
                  resolveIntent();
                }
              } catch (syncError) {
                rejectIntent(syncError);
              }
            }, 50);
          });
          
          console.log('✅ APK aberto via actionViewIntent com sucesso');
          return; // Sucesso
        } catch (intentError) {
          console.error('❌ Erro ao usar actionViewIntent:', intentError);
          throw new Error(
            'Não foi possível abrir o instalador automaticamente.\n\n' +
            'O APK foi baixado com sucesso. Por favor:\n' +
            '1. Abra o gerenciador de arquivos\n' +
            '2. Vá até a pasta Downloads\n' +
            '3. Toque no arquivo APK para instalar'
          );
        }
      }
    } catch (error) {
      console.error('❌ Erro ao instalar APK:', error);
      throw error;
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

