import { Alert, Linking, Platform, NativeModules } from 'react-native';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFetchBlob from 'rn-fetch-blob';
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
    console.log('📥 Iniciando download do APK...');
    console.log('📥 URL:', apkUrl);
    
    try {
      // Validar URL
      if (!apkUrl || typeof apkUrl !== 'string') {
        throw new Error('URL do APK inválida');
      }
      
      if (!apkUrl.startsWith('http://') && !apkUrl.startsWith('https://')) {
        throw new Error('URL do APK deve começar com http:// ou https://');
      }

      console.log('🔐 Solicitando permissão de armazenamento...');
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        throw new Error('Permissão de armazenamento negada');
      }
      console.log('✅ Permissão concedida');

      const { config, fs } = RNFetchBlob;
      const downloads = fs.dirs.DownloadDir;
      const fileName = `liga-do-bem-update-${Date.now()}.apk`;
      const filePath = `${downloads}/${fileName}`;

      console.log('📁 Caminho do arquivo:', filePath);
      console.log('📁 Pasta Downloads:', downloads);

      console.log('⚙️ Configurando download...');
      const downloadConfig = config({
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
      });

      console.log('🌐 Iniciando requisição HTTP...');
      const downloadTask = downloadConfig.fetch('GET', apkUrl);

      console.log('📊 Configurando callback de progresso...');
      downloadTask.progress((received, total) => {
        const progress = received / total;
        const percent = Math.round(progress * 100);
        console.log(`📊 Progresso: ${percent}% (${received}/${total} bytes)`);
        if (onProgress) {
          onProgress(progress);
        }
      });

      console.log('⏳ Aguardando conclusão do download...');
      const res = await downloadTask;
      const finalPath = res.path();
      
      console.log('✅ Download concluído!');
      console.log('📁 Arquivo salvo em:', finalPath);
      
      // Verificar se arquivo existe
      const fileExists = await fs.exists(finalPath);
      if (!fileExists) {
        throw new Error('Arquivo não foi salvo corretamente');
      }
      
      const fileInfo = await fs.stat(finalPath);
      console.log('📊 Tamanho do arquivo:', fileInfo.size, 'bytes');
      
      return finalPath;
    } catch (error) {
      console.error('❌ Erro ao baixar APK:', error);
      console.error('❌ Tipo do erro:', error.constructor.name);
      console.error('❌ Mensagem:', error.message);
      console.error('❌ Stack:', error.stack);
      
      // Log adicional se for erro de rede
      if (error.message?.includes('Network') || error.message?.includes('fetch')) {
        console.error('❌ Erro de rede detectado. Verifique a conexão e a URL.');
      }
      
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

