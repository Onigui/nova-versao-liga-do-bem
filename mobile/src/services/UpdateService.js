import { Alert, Linking, Platform, NativeModules } from 'react-native';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Função para obter versão atual do app
async function getCurrentAppVersion() {
  try {
    // Tentar usar DeviceInfo (mais confiável)
    const version = await DeviceInfo.getVersion();
    const buildNumber = await DeviceInfo.getBuildNumber();
    return {
      version,
      versionCode: parseInt(buildNumber, 10) || 0,
    };
  } catch (error) {
    console.warn('Erro ao obter versão do DeviceInfo:', error);
    // Fallback: usar package.json
    try {
      const packageJson = require('../../package.json');
      return {
        version: packageJson.version || '1.0.0',
        versionCode: parseInt(packageJson.version?.split('.').join('') || '100', 10),
      };
    } catch {
      return {
        version: '1.0.0',
        versionCode: 100,
      };
    }
  }
}

class UpdateService {
  /**
   * Verifica se há atualizações disponíveis
   * @returns {Promise<{hasUpdate: boolean, latestVersion: object|null}>}
   */
  async checkForUpdates() {
    try {
      const { version, versionCode } = await getCurrentAppVersion();
      console.log('📱 Verificando atualizações...', { version, versionCode });

      const url = `${API_BASE_PATH}/app/update/check?version=${version}&versionCode=${versionCode}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      console.log('📡 Status da resposta:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📱 Resposta da verificação:', JSON.stringify(data, null, 2));

        if (data.hasUpdate && data.latestVersion) {
          const latestVersionCode = data.latestVersion.versionCode || 0;
          if (latestVersionCode <= versionCode) {
            console.log('⚠️ Backend retornou hasUpdate=true, mas versão não é maior. Corrigindo...');
            data.hasUpdate = false;
            data.latestVersion = null;
          } else {
            console.log('✅ Atualização disponível:', {
              current: versionCode,
              latest: latestVersionCode,
            });
          }
        }

        return data;
      } else {
        const errorText = await response.text();
        console.error('❌ Erro na resposta do servidor:', response.status, errorText);
        return null;
      }
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
      if (Platform.Version >= 33) {
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

  /**
   * Baixa o APK diretamente do backend
   * @param {string} versionId - ID da versão no banco de dados
   * @param {function} onProgress - Callback de progresso (0.0 a 1.0)
   * @returns {Promise<string>} - Caminho do arquivo baixado
   */
  async downloadAPK(versionId, onProgress) {
    console.log('📥 [downloadAPK] Iniciando download do APK...');
    console.log('📥 [downloadAPK] Version ID:', versionId);

    if (!versionId) {
      throw new Error('ID da versão não fornecido');
    }

    try {
      // Solicitar permissões
      console.log('🔐 [downloadAPK] Solicitando permissões...');
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        throw new Error('Permissões necessárias não foram concedidas');
      }

      // Verificar se react-native-fs está disponível
      let RNFS;
      try {
        RNFS = require('react-native-fs');
        if (!RNFS || typeof RNFS.DownloadDirectoryPath === 'undefined' || typeof RNFS.downloadFile !== 'function') {
          throw new Error('react-native-fs não está disponível');
        }
      } catch (fsError) {
        console.error('❌ [downloadAPK] react-native-fs não disponível:', fsError);
        throw new Error('A biblioteca de download não está configurada. Por favor, recompile o aplicativo.');
      }

      // URL do endpoint para baixar o APK
      const downloadUrl = `${API_BASE_PATH}/app/update/apk/${versionId}`;
      console.log('🌐 [downloadAPK] URL de download:', downloadUrl);

      // Caminho onde salvar o APK
      const fileName = `liga-do-bem-update-${Date.now()}.apk`;
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      console.log('📁 [downloadAPK] Salvando em:', downloadPath);

      // Configurar download
      const downloadOptions = {
        fromUrl: downloadUrl,
        toFile: downloadPath,
        background: false,
        progressDivider: 10,
        progress: (res) => {
          try {
            if (res && res.bytesWritten && res.contentLength) {
              const progress = res.bytesWritten / res.contentLength;
              console.log(`📊 [downloadAPK] Progresso: ${Math.round(progress * 100)}% (${res.bytesWritten}/${res.contentLength} bytes)`);
              if (onProgress && typeof onProgress === 'function') {
                onProgress(progress);
              }
            }
          } catch (progressError) {
            console.warn('⚠️ [downloadAPK] Erro ao processar progresso:', progressError);
          }
        },
      };

      console.log('🌐 [downloadAPK] Iniciando download...');

      // Iniciar download
      const downloadResult = RNFS.downloadFile(downloadOptions);

      // Aguardar conclusão
      const result = await downloadResult.promise;

      if (result.statusCode !== 200) {
        throw new Error(`Erro ao baixar: status ${result.statusCode}`);
      }

      // Verificar se arquivo existe
      const exists = await RNFS.exists(downloadPath);
      if (!exists) {
        throw new Error('Arquivo não foi salvo corretamente após o download');
      }

      // Notificar progresso completo
      if (onProgress) {
        onProgress(1.0);
      }

      console.log('✅ [downloadAPK] Download concluído! Arquivo salvo em:', downloadPath);
      return downloadPath;
    } catch (error) {
      console.error('❌ [downloadAPK] Erro:', error);
      throw error;
    }
  }

  /**
   * Instala o APK baixado
   * @param {string} filePath - Caminho do arquivo APK
   */
  async installAPK(filePath) {
    if (Platform.OS !== 'android') {
      throw new Error('Instalação de APK só é suportada no Android');
    }

    try {
      console.log('📦 [installAPK] Preparando instalação...');
      console.log('📁 [installAPK] Caminho:', filePath);

      // Para Android 7.0+ (API 24+), usar FileProvider via content URI
      if (Platform.Version >= 24) {
        const packageName = 'com.ligadobem.botucatu';
        const authority = `${packageName}.fileprovider`;

        // Extrair apenas o nome do arquivo do caminho completo
        const fileName = filePath.split('/').pop();

        // Construir content URI
        const contentUri = `content://${authority}/external_files/${fileName}`;

        console.log('📱 [installAPK] Usando content URI:', contentUri);

        try {
          await Linking.openURL(contentUri);
          console.log('✅ [installAPK] Instalação iniciada via content URI');
          return;
        } catch (contentError) {
          console.warn('⚠️ [installAPK] Erro com content URI, tentando file://:', contentError);
        }
      }

      // Fallback: usar file:// URI
      const fileUri = `file://${filePath}`;
      console.log('📱 [installAPK] Usando file URI:', fileUri);

      await Linking.openURL(fileUri);
      console.log('✅ [installAPK] Instalação iniciada via file URI');
    } catch (error) {
      console.error('❌ [installAPK] Erro:', error);
      throw error;
    }
  }
}

export default new UpdateService();
