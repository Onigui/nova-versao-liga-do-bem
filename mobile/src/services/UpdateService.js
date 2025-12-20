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
    console.log('📥 [downloadAPK] Iniciando download...');
    
    try {
      // Validar URL
      if (!apkUrl || typeof apkUrl !== 'string') {
        throw new Error('URL do APK inválida');
      }
      
      const trimmedUrl = apkUrl.trim();
      console.log('📥 [downloadAPK] URL:', trimmedUrl);
      
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        throw new Error('URL do APK deve começar com http:// ou https://');
      }

      // Tentar usar react-native-fs, mas com fallback seguro
      let RNFS = null;
      try {
        RNFS = require('react-native-fs');
        // Verificar se a biblioteca está realmente disponível
        if (!RNFS || !RNFS.downloadFile || !RNFS.DownloadDirectoryPath) {
          throw new Error('react-native-fs não está disponível ou não está linkado');
        }
        console.log('✅ [downloadAPK] react-native-fs disponível');
      } catch (fsError) {
        console.error('❌ [downloadAPK] Erro ao carregar react-native-fs:', fsError);
        console.log('⚠️ [downloadAPK] Usando fallback: Linking.openURL');
        
        // FALLBACK: Usar Linking.openURL (abre no navegador)
        // Solicitar permissões (mesmo que não sejam necessárias para Linking)
        try {
          await this.requestStoragePermission();
        } catch (permError) {
          console.warn('⚠️ [downloadAPK] Erro ao solicitar permissões:', permError);
        }

        // Abrir URL no navegador/DownloadManager
        const canOpen = await Linking.canOpenURL(trimmedUrl);
        if (!canOpen) {
          throw new Error('Não foi possível abrir a URL de download');
        }

        await Linking.openURL(trimmedUrl);
        console.log('✅ [downloadAPK] URL aberta no navegador para download');
        
        // Simular progresso
        if (onProgress) {
          setTimeout(() => onProgress(0.1), 100);
          setTimeout(() => onProgress(0.5), 500);
          setTimeout(() => onProgress(1.0), 1000);
        }

        return 'download_iniciado'; // Indica que foi iniciado via navegador
      }

      // Se chegou aqui, react-native-fs está disponível
      // Solicitar permissões
      console.log('🔐 [downloadAPK] Solicitando permissões...');
      try {
        const hasPermission = await this.requestStoragePermission();
        if (!hasPermission) {
          console.warn('⚠️ [downloadAPK] Permissão negada, mas continuando...');
        }
      } catch (permError) {
        console.warn('⚠️ [downloadAPK] Erro ao solicitar permissões:', permError);
      }

      const downloadPath = `${RNFS.DownloadDirectoryPath}/liga-do-bem-update-${Date.now()}.apk`;
      
      console.log('📁 [downloadAPK] Salvando em:', downloadPath);
      console.log('🌐 [downloadAPK] Iniciando download...');

      // Configurar download
      const downloadOptions = {
        fromUrl: trimmedUrl,
        toFile: downloadPath,
        background: true, // Permite download em background
        discretionary: false,
        cacheable: false,
      };

      // Iniciar download
      const downloadResult = RNFS.downloadFile(downloadOptions);
      
      // Aguardar conclusão do download
      const result = await downloadResult.promise;
      
      if (result.statusCode !== 200) {
        throw new Error(`Erro ao baixar: status ${result.statusCode}`);
      }

      console.log('✅ [downloadAPK] Download concluído! Arquivo salvo em:', downloadPath);

      // Verificar se arquivo existe
      const exists = await RNFS.exists(downloadPath);
      if (!exists) {
        throw new Error('Arquivo não foi salvo corretamente');
      }

      // Notificar progresso completo
      if (onProgress) {
        onProgress(1.0);
      }

      return downloadPath;
    } catch (error) {
      console.error('❌ [downloadAPK] Erro:', error);
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

      // Se filePath for 'download_iniciado', significa que foi iniciado via navegador
      if (filePath === 'download_iniciado') {
        console.log('✅ [installAPK] Download iniciado via navegador. O usuário será instruído a instalar manualmente.');
        return;
      }

      // Tentar usar react-native-fs, mas com fallback seguro
      let RNFS = null;
      try {
        RNFS = require('react-native-fs');
        if (!RNFS || !RNFS.exists || !RNFS.openFile) {
          throw new Error('react-native-fs não está disponível ou não está linkado');
        }
        console.log('✅ [installAPK] react-native-fs disponível');
      } catch (fsError) {
        console.error('❌ [installAPK] Erro ao carregar react-native-fs:', fsError);
        console.log('⚠️ [installAPK] Usando fallback: Linking.openURL');
        
        // FALLBACK: Usar Linking com file:// URI
        try {
          const fileUri = `file://${filePath}`;
          const canOpen = await Linking.canOpenURL(fileUri);
          if (canOpen) {
            await Linking.openURL(fileUri);
            console.log('✅ [installAPK] Instalação iniciada via Linking (fallback)');
            return;
          } else {
            throw new Error('Não foi possível abrir o arquivo APK');
          }
        } catch (linkingError) {
          console.error('❌ [installAPK] Erro no fallback Linking:', linkingError);
          throw new Error('Não foi possível abrir o instalador. O arquivo foi baixado. Por favor, abra-o manualmente na pasta Downloads.');
        }
      }

      // Se chegou aqui, react-native-fs está disponível
      // Verificar se arquivo existe
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        throw new Error('Arquivo APK não encontrado: ' + filePath);
      }

      console.log('✅ [installAPK] Arquivo encontrado, abrindo instalador...');

      // Usar react-native-fs para abrir o instalador
      try {
        await RNFS.openFile(filePath);
        console.log('✅ [installAPK] Instalação iniciada via RNFS.openFile');
        return;
      } catch (openError) {
        console.warn('⚠️ [installAPK] RNFS.openFile falhou, tentando Linking:', openError);
        
        // Fallback: usar Linking com file:// URI
        const fileUri = `file://${filePath}`;
        console.log('📱 [installAPK] Tentando file URI:', fileUri);
        
        try {
          await Linking.openURL(fileUri);
          console.log('✅ [installAPK] Instalação iniciada via Linking');
        } catch (linkingError) {
          console.error('❌ [installAPK] Erro no Linking:', linkingError);
          throw new Error('Não foi possível abrir o instalador. O arquivo foi baixado. Por favor, abra-o manualmente na pasta Downloads.');
        }
      }
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

