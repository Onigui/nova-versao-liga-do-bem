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

      // SOLUÇÃO SIMPLIFICADA: Usar Linking.openURL para abrir a URL
      // O Android vai usar o DownloadManager nativo automaticamente
      // Isso é mais confiável que tentar usar bibliotecas externas problemáticas
      console.log('🌐 Abrindo URL no DownloadManager nativo do Android...');
      
      // Solicitar permissão de instalação (para depois instalar)
      console.log('🔐 Verificando permissões...');
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        console.warn('⚠️ Permissão negada, mas continuando...');
      }

      // Abrir URL - o Android vai baixar automaticamente usando DownloadManager
      const canOpen = await Linking.canOpenURL(apkUrl);
      if (!canOpen) {
        throw new Error('Não foi possível abrir a URL de download');
      }

      // Abrir a URL - isso vai iniciar o download no DownloadManager nativo
      await Linking.openURL(apkUrl);
      
      console.log('✅ Download iniciado no DownloadManager nativo do Android');
      
      // Simular progresso (já que não temos callback real do DownloadManager)
      if (onProgress && typeof onProgress === 'function') {
        // Simular progresso inicial
        setTimeout(() => onProgress(0.1), 100);
        setTimeout(() => onProgress(0.5), 500);
        setTimeout(() => onProgress(1.0), 1000);
      }

      // Retornar uma mensagem indicando que o download foi iniciado
      // O arquivo será salvo em Downloads/ pelo sistema Android
      return 'download_iniciado';
    } catch (error) {
      console.error('❌ Erro ao iniciar download:', error);
      throw error;
    }
  }

  async installAPK(filePath) {
    if (Platform.OS !== 'android') {
      throw new Error('Instalação de APK só é suportada no Android');
    }

    try {
      console.log('📦 Preparando para abrir instalador do Android...');
      
      // Se filePath for 'download_iniciado', significa que o download foi iniciado via Linking
      // Nesse caso, não precisamos fazer nada - o usuário vai instalar manualmente após o download
      if (filePath === 'download_iniciado') {
        console.log('✅ Download iniciado. O usuário poderá instalar após o download ser concluído.');
        return;
      }

      console.log('📁 Caminho do arquivo:', filePath);

      // SOLUÇÃO ULTRA-SIMPLIFICADA: Não usar actionViewIntent que está causando crash
      // Em vez disso, vamos apenas informar o usuário onde está o arquivo
      // OU usar uma abordagem mais segura com Intent nativo via NativeModules
      
      // Obter package name e authority do FileProvider
      const packageName = 'com.ligadobem.botucatu';
      const authority = `${packageName}.fileprovider`;
      
      // Tentar usar Linking com content URI (mais seguro que actionViewIntent)
      // Mas primeiro precisamos construir o URI correto
      
      // O DownloadManager salva o arquivo em Downloads, então vamos tentar abrir diretamente
      // usando o método mais simples possível
      
      try {
        // Método 1: Tentar abrir usando Intent nativo via NativeModules (se disponível)
        // Isso é mais seguro que actionViewIntent
        if (NativeModules && NativeModules.IntentAndroid) {
          console.log('📱 Tentando abrir via IntentAndroid nativo...');
          try {
            // Usar Intent nativo para abrir o instalador
            const Intent = NativeModules.IntentAndroid;
            if (Intent && Intent.openFile) {
              await Intent.openFile(filePath, 'application/vnd.android.package-archive');
              console.log('✅ Instalação iniciada via IntentAndroid');
              return; // Sucesso!
            }
          } catch (intentError) {
            console.warn('⚠️ IntentAndroid não funcionou:', intentError);
          }
        }
        
        // Método 2: Usar Linking com file:// (funciona em Android < 7.0)
        if (Platform.Version < 24) {
          console.log('📱 Tentando abrir via Linking (Android < 7.0)...');
          const fileUri = `file://${filePath}`;
          const canOpen = await Linking.canOpenURL(fileUri);
          if (canOpen) {
            await Linking.openURL(fileUri);
            console.log('✅ Instalação iniciada via Linking');
            return; // Sucesso!
          }
        }
        
        // Método 3: Se nada funcionou, lançar erro informativo
        throw new Error('Não foi possível abrir o instalador automaticamente. O arquivo foi baixado com sucesso na pasta Downloads. Por favor, abra-o manualmente para instalar.');
        
      } catch (openError) {
        console.error('❌ Erro ao tentar abrir instalador:', openError);
        // Retornar mensagem informativa em vez de erro fatal
        throw new Error(openError.message || 'O arquivo foi baixado. Por favor, abra-o manualmente na pasta Downloads para instalar.');
      }
    } catch (error) {
      console.error('❌ Erro ao processar instalação:', error);
      // Retornar mensagem amigável
      throw new Error(error.message || 'O download foi concluído. Por favor, abra o arquivo APK na pasta Downloads para instalar manualmente.');
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

