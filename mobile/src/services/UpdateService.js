import { Alert, Linking, Platform } from 'react-native';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFetchBlob from 'rn-fetch-blob';
import { PermissionsAndroid } from 'react-native';

// Versão atual do app (deve ser atualizada manualmente ou via package.json)
// TODO: Pegar dinamicamente do package.json ou app.json
const CURRENT_VERSION = '1.2.3';
const CURRENT_VERSION_CODE = 3; // Incrementar a cada build

class UpdateService {
  async checkForUpdates() {
    try {
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
        return data;
      }
      return null;
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
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

      // Usar Intent do Android para instalar
      const { config } = RNFetchBlob;
      await config({
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true,
          title: 'Instalando atualização',
          description: 'Aguarde enquanto instalamos a nova versão...',
          mime: 'application/vnd.android.package-archive',
          mediaScannable: true,
        },
      });

      // Abrir o arquivo APK para instalação
      await RNFetchBlob.android.actionViewIntent(filePath, 'application/vnd.android.package-archive');
    } catch (error) {
      console.error('Erro ao instalar APK:', error);
      // Fallback: tentar abrir com Linking
      try {
        await Linking.openURL(`file://${filePath}`);
      } catch (linkError) {
        throw new Error('Não foi possível instalar o APK automaticamente. Por favor, instale manualmente.');
      }
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

