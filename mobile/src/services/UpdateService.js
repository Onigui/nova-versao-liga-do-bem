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
      version: version || '1.2.3',
      versionCode: parseInt(buildNumber || '5', 10),
    };
  } catch (error) {
    console.warn('⚠️ Erro ao obter versão do DeviceInfo, usando valores padrão:', error);
    // Fallback: tentar ler do app.json
    try {
      const appConfig = require('../../app.json');
      return {
        version: appConfig?.version || '1.2.3',
        versionCode: appConfig?.versionCode || 5,
      };
    } catch (jsonError) {
      console.warn('⚠️ Erro ao ler app.json, usando valores hardcoded');
      return {
        version: '1.2.3',
        versionCode: 5,
      };
    }
  }
}

// Valores padrão (serão sobrescritos na primeira chamada)
let CURRENT_VERSION = '1.2.3';
let CURRENT_VERSION_CODE = 5;

// Inicializar versão ao carregar o módulo
getCurrentAppVersion().then(({ version, versionCode }) => {
  CURRENT_VERSION = version;
  CURRENT_VERSION_CODE = versionCode;
  console.log('📱 Versão do app detectada:', { version, versionCode });
});

class UpdateService {
  async checkForUpdates() {
    try {
      // Obter versão atual do app (sempre atualizada)
      const { version, versionCode } = await getCurrentAppVersion();
      
      console.log('🔍 Verificando atualizações...', {
        currentVersion: version,
        currentVersionCode: versionCode,
      });

      const url = `${API_BASE_PATH}/app/version?platform=android&version=${version}&versionCode=${versionCode}`;
      console.log('📡 URL da verificação:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Forçar buscar sempre da API
      });

      console.log('📡 Status da resposta:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('📱 Resposta completa da verificação:', JSON.stringify(data, null, 2));
        
        // Garantir que hasUpdate só seja true se realmente houver atualização
        if (data.hasUpdate && data.latestVersion) {
          const latestVersionCode = data.latestVersion.versionCode || 0;
          // Verificar novamente no cliente para garantir
          if (latestVersionCode <= versionCode) {
            console.log('⚠️ Backend retornou hasUpdate=true, mas versão não é maior. Corrigindo...', {
              latestVersionCode,
              currentVersionCode: versionCode,
            });
            data.hasUpdate = false;
            data.latestVersion = null;
          } else {
            console.log('✅ Atualização disponível:', {
              current: versionCode,
              latest: latestVersionCode,
            });
          }
        } else {
          console.log('✅ App está atualizado. Sem atualizações disponíveis.');
        }
        
        return data;
      } else {
        const errorText = await response.text();
        console.error('❌ Erro na resposta do servidor:', response.status, errorText);
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao verificar atualizações:', error);
      console.error('❌ Stack trace:', error.stack);
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
    console.log('📥 [downloadAPK] ========== INÍCIO ==========');
    console.log('📥 [downloadAPK] Parâmetros recebidos:');
    console.log('   - apkUrl:', apkUrl);
    console.log('   - onProgress:', typeof onProgress);
    
    try {
      // Validar URL
      console.log('🔍 [downloadAPK] Validando URL...');
      if (!apkUrl) {
        const error = new Error('URL do APK não fornecida (null/undefined)');
        console.error('❌ [downloadAPK]', error.message);
        throw error;
      }
      
      if (typeof apkUrl !== 'string') {
        const error = new Error(`URL do APK deve ser uma string, recebido: ${typeof apkUrl}`);
        console.error('❌ [downloadAPK]', error.message);
        throw error;
      }
      
      const trimmedUrl = apkUrl.trim();
      console.log('📥 [downloadAPK] URL após trim:', trimmedUrl);
      console.log('📥 [downloadAPK] Tamanho da URL:', trimmedUrl.length);
      
      if (!trimmedUrl) {
        const error = new Error('URL do APK está vazia após remover espaços');
        console.error('❌ [downloadAPK]', error.message);
        throw error;
      }
      
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        const error = new Error(`URL do APK deve começar com http:// ou https://. Recebido: ${trimmedUrl.substring(0, 20)}...`);
        console.error('❌ [downloadAPK]', error.message);
        throw error;
      }

      // SOLUÇÃO ULTRA-SIMPLES: Usar apenas Linking.openURL (100% nativo, ZERO chance de crash)
      // O Android DownloadManager vai gerenciar tudo automaticamente
      console.log('🌐 [downloadAPK] Usando DownloadManager nativo do Android via Linking.openURL...');
      
      // Simular progresso (já que não temos callback real do DownloadManager)
      if (onProgress && typeof onProgress === 'function') {
        console.log('📊 [downloadAPK] Simulando progresso...');
        try {
          setTimeout(() => {
            try {
              onProgress(0.1);
              console.log('📊 [downloadAPK] Progresso: 10%');
            } catch (e) {
              console.warn('⚠️ [downloadAPK] Erro ao atualizar progresso:', e);
            }
          }, 100);
          setTimeout(() => {
            try {
              onProgress(0.5);
              console.log('📊 [downloadAPK] Progresso: 50%');
            } catch (e) {
              console.warn('⚠️ [downloadAPK] Erro ao atualizar progresso:', e);
            }
          }, 500);
          setTimeout(() => {
            try {
              onProgress(1.0);
              console.log('📊 [downloadAPK] Progresso: 100%');
            } catch (e) {
              console.warn('⚠️ [downloadAPK] Erro ao atualizar progresso:', e);
            }
          }, 1000);
        } catch (progressError) {
          console.warn('⚠️ [downloadAPK] Erro ao configurar progresso:', progressError);
        }
      }

      // Abrir URL - Android vai usar DownloadManager nativo (NÃO CRASHA)
      console.log('🌐 [downloadAPK] Abrindo URL com Linking.openURL...');
      try {
        await Linking.openURL(trimmedUrl);
        console.log('✅ [downloadAPK] Download iniciado via DownloadManager do Android');
        console.log('📥 [downloadAPK] ========== SUCESSO ==========');
        return 'download_iniciado';
      } catch (openError) {
        console.error('❌ [downloadAPK] Erro ao abrir URL:', openError);
        console.error('❌ [downloadAPK] Tipo:', typeof openError);
        console.error('❌ [downloadAPK] Mensagem:', openError?.message);
        console.error('❌ [downloadAPK] Stack:', openError?.stack);
        throw new Error(`Não foi possível iniciar o download: ${openError?.message || openError?.toString() || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('❌ [downloadAPK] ========== ERRO ==========');
      console.error('❌ [downloadAPK] Tipo do erro:', typeof error);
      console.error('❌ [downloadAPK] Mensagem:', error?.message);
      console.error('❌ [downloadAPK] Stack:', error?.stack);
      console.error('❌ [downloadAPK] Erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw error;
    }
  }


  async installAPK(filePath) {
    if (Platform.OS !== 'android') {
      throw new Error('Instalação de APK só é suportada no Android');
    }

    try {
      console.log('📦 [installAPK] Preparando instalação...');
      console.log('📁 [installAPK] Caminho:', filePath);

      // Se filePath for 'download_iniciado', significa que o download foi iniciado via DownloadManager
      // O usuário precisa instalar manualmente após o download terminar
      if (filePath === 'download_iniciado') {
        console.log('✅ [installAPK] Download iniciado via DownloadManager. O usuário será instruído a instalar manualmente.');
        return;
      }

      // Se chegou aqui, temos um caminho de arquivo real (não deveria acontecer com a implementação atual)
      console.warn('⚠️ [installAPK] Tentando instalar com filePath:', filePath);
      
      // Tentar usar file:// URI
      const fileUri = `file://${filePath}`;
      console.log('📱 [installAPK] Usando file URI:', fileUri);
      
      await Linking.openURL(fileUri);
      console.log('✅ [installAPK] Instalação iniciada via file URI');
    } catch (error) {
      console.error('❌ [installAPK] Erro:', error);
      throw error;
    }
  }

  // Novo método: Abrir pasta Downloads sem tentar instalar APK
  async openDownloadsFolder() {
    try {
      if (Platform.OS !== 'android') {
        throw new Error('Apenas Android suportado');
      }
      
      // Tentar abrir a pasta Downloads usando content:// URI
      try {
        // Usar content:// URI para abrir o gerenciador de arquivos na pasta Downloads
        await Linking.openURL('content://com.android.externalstorage.documents/document/primary:Download');
      } catch (linkingError) {
        console.warn('Não foi possível abrir pasta Downloads automaticamente:', linkingError);
        // Não lançar erro, apenas logar
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

