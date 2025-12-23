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

      // Tentar usar react-native-fs para download interno
      // Se não estiver disponível, mostrar erro claro ao usuário
      console.log('🔍 [downloadAPK] Verificando se react-native-fs está disponível...');
      
      let RNFS = null;
      let downloadPath = null;
      
      try {
        // Tentar importar react-native-fs
        // Usar uma função wrapper para capturar erros de require
        const checkRNFS = () => {
          try {
            return require('react-native-fs');
          } catch (requireError) {
            console.warn('⚠️ [downloadAPK] Erro ao fazer require de react-native-fs:', requireError);
            return null;
          }
        };
        
        RNFS = checkRNFS();
        
        if (!RNFS) {
          throw new Error('react-native-fs não está disponível');
        }
        
        // Verificar se as propriedades necessárias existem
        if (typeof RNFS.DownloadDirectoryPath === 'undefined') {
          throw new Error('RNFS.DownloadDirectoryPath não está disponível');
        }
        
        if (typeof RNFS.downloadFile !== 'function') {
          throw new Error('RNFS.downloadFile não é uma função');
        }
        
        downloadPath = `${RNFS.DownloadDirectoryPath}/liga-do-bem-update-${Date.now()}.apk`;
        console.log('✅ [downloadAPK] react-native-fs disponível!');
        console.log('📁 [downloadAPK] Caminho de download:', downloadPath);
        
      } catch (fsError) {
        console.error('❌ [downloadAPK] react-native-fs não está disponível:', fsError);
        console.error('❌ [downloadAPK] Mensagem:', fsError?.message);
        throw new Error(
          'A biblioteca de download não está configurada. ' +
          'Por favor, recompile o aplicativo para habilitar downloads internos. ' +
          `Erro: ${fsError?.message || 'Biblioteca não encontrada'}`
        );
      }

      // Solicitar permissões
      console.log('🔐 [downloadAPK] Solicitando permissões de armazenamento...');
      try {
        await this.requestStoragePermission();
        console.log('✅ [downloadAPK] Permissões concedidas');
      } catch (permError) {
        console.warn('⚠️ [downloadAPK] Erro ao solicitar permissões (continuando mesmo assim):', permError);
      }

      // Configurar download
      console.log('⚙️ [downloadAPK] Configurando opções de download...');
      const downloadOptions = {
        fromUrl: trimmedUrl,
        toFile: downloadPath,
        background: false, // Download em foreground para ter progresso
        progressDivider: 10, // Notificar progresso a cada 10%
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

      console.log('🌐 [downloadAPK] Iniciando download interno...');
      
      // Iniciar download
      let downloadResult;
      try {
        downloadResult = RNFS.downloadFile(downloadOptions);
        console.log('✅ [downloadAPK] Download iniciado');
      } catch (startError) {
        console.error('❌ [downloadAPK] Erro ao iniciar download:', startError);
        throw new Error(`Não foi possível iniciar o download: ${startError?.message || 'Erro desconhecido'}`);
      }
      
      // Aguardar conclusão
      console.log('⏳ [downloadAPK] Aguardando conclusão do download...');
      let result;
      try {
        result = await downloadResult.promise;
        console.log('✅ [downloadAPK] Download concluído!');
        console.log('📊 [downloadAPK] Status:', result.statusCode);
        console.log('📊 [downloadAPK] Bytes escritos:', result.bytesWritten);
      } catch (promiseError) {
        console.error('❌ [downloadAPK] Erro durante o download:', promiseError);
        throw new Error(`Erro durante o download: ${promiseError?.message || 'Erro desconhecido'}`);
      }
      
      if (result.statusCode !== 200) {
        const error = new Error(`Erro ao baixar: status ${result.statusCode}`);
        console.error('❌ [downloadAPK]', error.message);
        throw error;
      }

      console.log('✅ [downloadAPK] Verificando se arquivo foi salvo...');
      
      // Verificar se arquivo existe
      let exists = false;
      try {
        exists = await RNFS.exists(downloadPath);
        console.log('📁 [downloadAPK] Arquivo existe?', exists);
      } catch (existsError) {
        console.warn('⚠️ [downloadAPK] Erro ao verificar existência do arquivo:', existsError);
      }
      
      if (!exists) {
        throw new Error('Arquivo não foi salvo corretamente após o download');
      }

      // Notificar progresso completo
      if (onProgress && typeof onProgress === 'function') {
        try {
          onProgress(1.0);
          console.log('📊 [downloadAPK] Progresso atualizado: 100%');
        } catch (progressError) {
          console.warn('⚠️ [downloadAPK] Erro ao atualizar progresso final:', progressError);
        }
      }

      console.log('✅ [downloadAPK] Download concluído com sucesso!');
      console.log('📁 [downloadAPK] Arquivo salvo em:', downloadPath);
      console.log('📥 [downloadAPK] ========== SUCESSO ==========');
      return downloadPath;
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

