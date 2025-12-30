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
    const versionCode = parseInt(buildNumber, 10) || 0;
    
    console.log('📱 [getCurrentAppVersion] DeviceInfo:', {
      version,
      buildNumber,
      versionCode
    });
    
    return {
      version,
      versionCode,
    };
  } catch (error) {
    console.warn('⚠️ [getCurrentAppVersion] Erro ao obter versão do DeviceInfo:', error);
    // Fallback: usar app.json primeiro, depois package.json
    try {
      const appJson = require('../../app.json');
      if (appJson.versionCode) {
        console.log('📱 [getCurrentAppVersion] Usando app.json:', {
          version: appJson.version,
          versionCode: appJson.versionCode
        });
        return {
          version: appJson.version || '1.0.0',
          versionCode: parseInt(appJson.versionCode, 10) || 0,
        };
      }
    } catch (appJsonError) {
      console.warn('⚠️ [getCurrentAppVersion] Erro ao ler app.json:', appJsonError);
    }
    
    // Último fallback: package.json
    try {
      const packageJson = require('../../package.json');
      const versionCode = parseInt(packageJson.version?.split('.').join('') || '100', 10);
      console.log('📱 [getCurrentAppVersion] Usando package.json (fallback):', {
        version: packageJson.version || '1.0.0',
        versionCode
      });
      return {
        version: packageJson.version || '1.0.0',
        versionCode,
      };
    } catch {
      console.warn('⚠️ [getCurrentAppVersion] Todos os fallbacks falharam, usando valores padrão');
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
      console.log('📱 [UpdateService.checkForUpdates] Verificando atualizações...', { version, versionCode });

      const url = `${API_BASE_PATH}/app/update/check?version=${version}&versionCode=${versionCode}`;
      console.log('📱 [UpdateService.checkForUpdates] URL:', url);
      console.log('📱 [UpdateService.checkForUpdates] API_BASE_PATH:', API_BASE_PATH);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      console.log('📡 [UpdateService.checkForUpdates] Status da resposta:', response.status);
      console.log('📡 [UpdateService.checkForUpdates] Response OK:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('📱 [UpdateService.checkForUpdates] Resposta completa:', JSON.stringify(data, null, 2));

        if (data.hasUpdate && data.latestVersion) {
          // Garantir que versionCodes sejam números para comparação correta
          const currentVersionCodeNum = typeof versionCode === 'number' ? versionCode : parseInt(String(versionCode), 10) || 0;
          const latestVersionCodeNum = typeof data.latestVersion.versionCode === 'number' 
            ? data.latestVersion.versionCode 
            : parseInt(String(data.latestVersion.versionCode || 0), 10);
          
          console.log('🔍 [UpdateService.checkForUpdates] Comparando versões:', {
            currentVersionCode: currentVersionCodeNum,
            currentVersionCodeType: typeof currentVersionCodeNum,
            latestVersionCode: latestVersionCodeNum,
            latestVersionCodeType: typeof latestVersionCodeNum,
            isGreater: latestVersionCodeNum > currentVersionCodeNum,
            comparison: `${latestVersionCodeNum} > ${currentVersionCodeNum} = ${latestVersionCodeNum > currentVersionCodeNum}`
          });
          
          if (latestVersionCodeNum <= currentVersionCodeNum) {
            console.log('⚠️ [UpdateService.checkForUpdates] Backend retornou hasUpdate=true, mas versão não é maior. Corrigindo...');
            data.hasUpdate = false;
            data.latestVersion = null;
          } else {
            console.log('✅ [UpdateService.checkForUpdates] Atualização disponível!', {
              current: currentVersionCodeNum,
              latest: latestVersionCodeNum,
              latestVersion: data.latestVersion.version,
              apkUrl: data.latestVersion.apkUrl
            });
          }
        } else {
          console.log('ℹ️ [UpdateService.checkForUpdates] Nenhuma atualização disponível:', {
            hasUpdate: data.hasUpdate,
            hasLatestVersion: !!data.latestVersion,
            message: data.message
          });
        }

        return data;
      } else {
        const errorText = await response.text();
        console.error('❌ [UpdateService.checkForUpdates] Erro na resposta do servidor:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        return {
          hasUpdate: false,
          error: `Erro ${response.status}: ${errorText}`
        };
      }
    } catch (error) {
      console.error('❌ [UpdateService.checkForUpdates] Erro ao verificar atualizações:', error);
      console.error('❌ [UpdateService.checkForUpdates] Stack:', error.stack);
      return {
        hasUpdate: false,
        error: error.message || 'Erro desconhecido'
      };
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
   * Baixa o APK diretamente do GitHub Release ou do backend
   * @param {string} versionId - ID da versão no banco de dados (opcional se apkUrl for fornecido)
   * @param {string} apkUrl - URL direta do APK (GitHub Release ou backend)
   * @param {function} onProgress - Callback de progresso (0.0 a 1.0)
   * @returns {Promise<string>} - Caminho do arquivo baixado
   */
  async downloadAPK(versionId, apkUrl, onProgress) {
    console.log('📥 [downloadAPK] ========== INÍCIO ==========');
    console.log('📥 [downloadAPK] Version ID:', versionId);
    console.log('📥 [downloadAPK] APK URL:', apkUrl);

    // Se apkUrl não foi fornecido, construir URL do backend
    let downloadUrl = apkUrl;
    if (!downloadUrl) {
      if (!versionId) {
        throw new Error('ID da versão ou URL do APK deve ser fornecido');
      }
      // URL do endpoint para baixar o APK do backend
      downloadUrl = `${API_BASE_PATH}/app/update/apk/${versionId}`;
    }

    console.log('🌐 [downloadAPK] URL de download final:', downloadUrl);

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

      // Caminho onde salvar o APK - usar DocumentDirectoryPath (mais confiável com FileProvider)
      const fileName = `liga-do-bem-update-${Date.now()}.apk`;
      // Tentar usar ExternalDirectoryPath primeiro (mais acessível), senão usar DocumentDirectoryPath
      const basePath = RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath;
      const downloadPath = `${basePath}/${fileName}`;
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
   * Instala o APK baixado usando módulo nativo
   * @param {string} filePath - Caminho do arquivo APK
   */
  async installAPK(filePath) {
    if (Platform.OS !== 'android') {
      throw new Error('Instalação de APK só é suportada no Android');
    }

    try {
      console.log('📦 [installAPK] Preparando instalação...');
      console.log('📁 [installAPK] Caminho:', filePath);

      // Verificar se o arquivo existe
      let RNFS;
      try {
        RNFS = require('react-native-fs');
        const exists = await RNFS.exists(filePath);
        if (!exists) {
          throw new Error(`Arquivo APK não encontrado: ${filePath}`);
        }
        console.log('✅ [installAPK] Arquivo APK encontrado e válido');
      } catch (fsError) {
        console.error('❌ [installAPK] Erro ao verificar arquivo:', fsError);
        throw new Error(`Não foi possível verificar o arquivo APK: ${fsError.message}`);
      }

      // Tentar usar módulo nativo ApkInstaller
      try {
        const { NativeModules } = require('react-native');
        const ApkInstaller = NativeModules.ApkInstaller;
        
        if (!ApkInstaller) {
          console.error('❌ [installAPK] Módulo nativo ApkInstaller não encontrado');
          console.log('📋 [installAPK] Módulos disponíveis:', Object.keys(NativeModules));
          throw new Error('Módulo nativo ApkInstaller não encontrado. Por favor, recompile o aplicativo.');
        }

        console.log('📱 [installAPK] Usando módulo nativo ApkInstaller...');
        console.log('📁 [installAPK] Caminho do arquivo:', filePath);
        
        // Chamar o método nativo (ele retorna uma Promise)
        const result = await ApkInstaller.installApk(filePath);
        console.log('✅ [installAPK] Instalação iniciada via módulo nativo. Resultado:', result);
        return;
      } catch (nativeError) {
        console.error('❌ [installAPK] Erro ao usar módulo nativo:', nativeError);
        console.error('❌ [installAPK] Tipo do erro:', nativeError?.constructor?.name);
        console.error('❌ [installAPK] Código do erro:', nativeError?.code);
        console.error('❌ [installAPK] Mensagem:', nativeError?.message);
        console.error('❌ [installAPK] Stack:', nativeError?.stack);
        
        // Não tentar fallback - se o módulo nativo falhou, é melhor mostrar o erro
        throw new Error(
          `Erro ao iniciar instalação: ${nativeError?.message || 'Erro desconhecido'}. ` +
          `Código: ${nativeError?.code || 'N/A'}. ` +
          `Por favor, verifique se o app tem permissão para instalar aplicativos.`
        );
      }
    } catch (error) {
      console.error('❌ [installAPK] Erro geral:', error);
      console.error('❌ [installAPK] Stack:', error.stack);
      throw error;
    }
  }
}

export default new UpdateService();
