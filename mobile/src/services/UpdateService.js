import { Alert, Linking, Platform, NativeModules } from 'react-native';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Importar RNFetchBlob com tratamento de erro
let RNFetchBlob;
try {
  RNFetchBlob = require('rn-fetch-blob');
  if (!RNFetchBlob) {
    console.warn('⚠️ RNFetchBlob não foi carregado corretamente');
  }
} catch (importError) {
  console.error('❌ Erro ao importar RNFetchBlob:', importError);
  RNFetchBlob = null;
}

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
    console.log('📥 Iniciando download do APK em background...');
    console.log('📥 URL:', apkUrl);
    
    try {
      // Validar URL
      if (!apkUrl || typeof apkUrl !== 'string') {
        throw new Error('URL do APK inválida');
      }
      
      if (!apkUrl.startsWith('http://') && !apkUrl.startsWith('https://')) {
        throw new Error('URL do APK deve começar com http:// ou https://');
      }

      // VERIFICAÇÃO CRÍTICA: Verificar se RNFetchBlob está disponível ANTES de usar
      if (!RNFetchBlob) {
        console.error('❌ RNFetchBlob não está disponível');
        throw new Error('Módulo de download não está disponível. Por favor, reinicie o aplicativo.');
      }

      // Verificar se RNFetchBlob está realmente funcional
      try {
        // Teste simples para verificar se o módulo está funcionando
        if (typeof RNFetchBlob !== 'object') {
          throw new Error('RNFetchBlob não é um objeto válido');
        }
      } catch (testError) {
        console.error('❌ Erro ao testar RNFetchBlob:', testError);
        throw new Error('Módulo de download não está funcionando corretamente. Por favor, reinicie o aplicativo.');
      }

      // Verificar se config e fs existem
      if (!RNFetchBlob.config || !RNFetchBlob.fs) {
        throw new Error('RNFetchBlob não está inicializado corretamente. Por favor, reinicie o aplicativo.');
      }

      const { config, fs } = RNFetchBlob;

      // Verificar se fs.dirs existe
      if (!fs || !fs.dirs) {
        throw new Error('RNFetchBlob.fs.dirs não está disponível.');
      }

      // Verificar DownloadDir
      if (!fs.dirs.DownloadDir) {
        throw new Error('Pasta Downloads não está disponível.');
      }

      const downloads = fs.dirs.DownloadDir;
      
      if (!downloads || typeof downloads !== 'string') {
        throw new Error('Caminho da pasta Downloads inválido.');
      }

      const fileName = `liga-do-bem-update-${Date.now()}.apk`;
      const filePath = `${downloads}/${fileName}`;

      console.log('📁 Caminho do arquivo:', filePath);
      console.log('📁 Pasta Downloads:', downloads);

      // Solicitar permissão DEPOIS de verificar RNFetchBlob (para evitar crash se RNFetchBlob falhar)
      console.log('🔐 Solicitando permissão de armazenamento...');
      let hasPermission = false;
      try {
        hasPermission = await this.requestStoragePermission();
      } catch (permError) {
        console.error('❌ Erro ao solicitar permissão:', permError);
        throw new Error('Erro ao solicitar permissão de armazenamento: ' + permError.message);
      }

      if (!hasPermission) {
        throw new Error('Permissão de armazenamento negada');
      }
      console.log('✅ Permissão concedida');

      // Usar DownloadManager do Android para download em background
      console.log('⚙️ Configurando download em background...');
      
      let downloadConfig;
      try {
        downloadConfig = config({
          fileCache: false,
          path: filePath,
          addAndroidDownloads: {
            useDownloadManager: true, // DownloadManager nativo (funciona em background)
            notification: true, // Mostra notificação durante download
            title: 'Liga do Bem - Atualização',
            description: 'Baixando nova versão do aplicativo...',
            mime: 'application/vnd.android.package-archive',
            mediaScannable: true,
            path: filePath,
            // Importante: permitir download em background
            showNotification: true,
          },
        });
      } catch (configError) {
        console.error('❌ Erro ao configurar download:', configError);
        throw new Error('Erro ao configurar download: ' + configError.message);
      }

      if (!downloadConfig || typeof downloadConfig.fetch !== 'function') {
        throw new Error('Configuração de download inválida.');
      }

      console.log('🌐 Iniciando download...');
      
      let downloadTask;
      try {
        downloadTask = downloadConfig.fetch('GET', apkUrl);
      } catch (fetchError) {
        console.error('❌ Erro ao iniciar download:', fetchError);
        throw new Error('Erro ao iniciar download: ' + fetchError.message);
      }

      if (!downloadTask) {
        throw new Error('Falha ao criar tarefa de download.');
      }

      // Configurar progresso
      if (onProgress && typeof onProgress === 'function') {
        try {
          downloadTask.progress((received, total) => {
            const progress = total > 0 ? received / total : 0;
            const percent = Math.round(progress * 100);
            console.log(`📊 Progresso: ${percent}% (${received}/${total} bytes)`);
            
            // Atualizar progresso (throttle para não sobrecarregar UI)
            if (percent % 5 === 0 || progress === 1) {
              try {
                onProgress(progress);
              } catch (progressError) {
                console.warn('Erro ao atualizar progresso:', progressError);
              }
            }
          });
        } catch (progressError) {
          console.warn('Erro ao configurar progresso (continuando mesmo assim):', progressError);
        }
      }

      console.log('⏳ Aguardando conclusão do download...');
      
      // Aguardar download com timeout (10 minutos para arquivos grandes)
      const downloadPromise = downloadTask;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout no download (10 minutos)')), 10 * 60 * 1000);
      });
      
      const res = await Promise.race([downloadPromise, timeoutPromise]);
      const finalPath = res.path();

      console.log('✅ Download concluído!');
      console.log('📁 Arquivo salvo em:', finalPath);
      
      // Verificar se arquivo existe (com retry)
      let fileExists = false;
      for (let i = 0; i < 5; i++) {
        try {
          fileExists = await fs.exists(finalPath);
          if (fileExists) break;
          console.log(`⏳ Aguardando arquivo... (tentativa ${i + 1}/5)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (checkError) {
          console.warn(`Tentativa ${i + 1} de verificar arquivo falhou:`, checkError);
        }
      }
      
      if (!fileExists) {
        throw new Error('Arquivo não foi salvo corretamente');
      }
      
      const fileInfo = await fs.stat(finalPath);
      console.log('📊 Tamanho do arquivo:', fileInfo.size, 'bytes');
      
      // Notificar progresso completo
      if (onProgress && typeof onProgress === 'function') {
        onProgress(1.0);
      }
      
      return finalPath;
    } catch (error) {
      console.error('❌ Erro ao baixar APK:', error);
      console.error('❌ Tipo do erro:', error.constructor.name);
      console.error('❌ Mensagem:', error.message);
      if (error.stack) {
        console.error('❌ Stack:', error.stack);
      }
      
      throw error;
    }
  }

  async installAPK(filePath) {
    if (Platform.OS !== 'android') {
      throw new Error('Instalação de APK só é suportada no Android');
    }

    try {
      console.log('📦 Preparando para abrir instalador do Android...');
      console.log('📁 Caminho do arquivo:', filePath);

      // Verificar se arquivo existe
      const { fs } = RNFetchBlob;
      const fileExists = await fs.exists(filePath);
      if (!fileExists) {
        throw new Error('Arquivo APK não encontrado no caminho: ' + filePath);
      }

      console.log('✅ Arquivo encontrado');

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

