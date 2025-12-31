import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import UpdateService from '../services/UpdateService';

export default function UpdateModal({visible, updateInfo, onDismiss, onUpdateComplete}) {
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleUpdate = async () => {
    console.log('🔘 [handleUpdate] Iniciando atualização...');
    
    // Envolver tudo em um wrapper para capturar erros síncronos e assíncronos
    try {
      // Validar updateInfo ANTES de mudar qualquer estado
      if (!updateInfo?.latestVersion?.versionId) {
        console.error('❌ [handleUpdate] Version ID não disponível');
        Alert.alert('Erro', 'Informações de atualização inválidas');
        return;
      }

      const versionId = updateInfo.latestVersion.versionId;
      const apkUrl = updateInfo.latestVersion.apkUrl; // URL do GitHub Release ou backend
      console.log('📦 [handleUpdate] Version ID:', versionId);
      console.log('📦 [handleUpdate] APK URL:', apkUrl);

      // Resetar estados de forma segura
      try {
        setError(null);
        setDownloadProgress(0);
        setDownloading(true);
        setInstalling(false);
      } catch (stateError) {
        console.error('❌ [handleUpdate] Erro ao atualizar estado:', stateError);
        // Continuar mesmo assim
      }

      console.log('📥 [handleUpdate] Iniciando download...');
      
      // Fazer download - passar apkUrl se disponível (prioridade sobre versionId)
      let filePath;
      try {
        filePath = await UpdateService.downloadAPK(versionId, apkUrl, (progress) => {
          try {
            setDownloadProgress(progress);
            console.log(`📊 [handleUpdate] Progresso: ${Math.round(progress * 100)}%`);
          } catch (progressError) {
            console.warn('⚠️ [handleUpdate] Erro ao atualizar progresso:', progressError);
          }
        });
        console.log('✅ [handleUpdate] Download concluído:', filePath);
      } catch (downloadError) {
        console.error('❌ [handleUpdate] Erro no download:', downloadError);
        setDownloading(false);
        setError(downloadError?.message || 'Erro desconhecido no download');
        
        Alert.alert(
          'Erro no Download',
          `Não foi possível baixar a atualização.\n\n${downloadError?.message || 'Erro desconhecido'}\n\nPor favor, tente novamente.`,
          [
            {
              text: 'Tentar Novamente',
              onPress: () => handleUpdate(),
            },
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                if (!updateInfo.isMandatory) {
                  onDismiss();
                }
              },
            },
          ],
          { cancelable: !updateInfo.isMandatory }
        );
        return;
      }

      setDownloading(false);

      // Instalar APK
      setInstalling(true);
      
      // Pequeno delay para mostrar estado de instalação
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        console.log('📦 [handleUpdate] Iniciando instalação...');
        console.log('📁 [handleUpdate] Caminho do APK:', filePath);
        
        await UpdateService.installAPK(filePath);
        console.log('✅ [handleUpdate] Instalação iniciada!');

        // Pequeno delay para garantir que o Intent foi processado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setInstalling(false);
        
        Alert.alert(
          'Download Concluído!',
          'O instalador do Android foi aberto.\n\nPor favor, confirme a instalação na tela que apareceu.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (onUpdateComplete) {
                  onUpdateComplete();
                }
                if (!updateInfo.isMandatory) {
                  onDismiss();
                }
              },
            },
          ],
          { cancelable: false }
        );
      } catch (installError) {
        console.error('❌ [handleUpdate] Erro na instalação:', installError);
        console.error('❌ [handleUpdate] Tipo do erro:', installError?.constructor?.name);
        console.error('❌ [handleUpdate] Código:', installError?.code);
        console.error('❌ [handleUpdate] Mensagem:', installError?.message);
        console.error('❌ [handleUpdate] Stack:', installError?.stack);
        
        setInstalling(false);
        setError(installError?.message || 'Erro desconhecido na instalação');

        // Mensagem mais detalhada baseada no tipo de erro
        let errorMessage = installError?.message || 'Erro desconhecido';
        if (installError?.code === 'NO_ACTIVITY') {
          errorMessage = 'O app precisa estar em primeiro plano para instalar. Por favor, tente novamente.';
        } else if (installError?.code === 'FILE_NOT_FOUND' || installError?.code === 'FILE_NOT_READABLE') {
          errorMessage = 'O arquivo baixado não foi encontrado ou não pode ser lido. Por favor, tente baixar novamente.';
        } else if (installError?.code === 'NO_INSTALLER') {
          errorMessage = 'Nenhum aplicativo encontrado para instalar APKs. Verifique as configurações do dispositivo.';
        } else if (installError?.code === 'SECURITY_ERROR') {
          errorMessage = 'Erro de segurança. Verifique se o app tem permissão para instalar aplicativos nas configurações.';
        }

        Alert.alert(
          'Erro na Instalação',
          `O download foi concluído, mas não foi possível abrir o instalador automaticamente.\n\n${errorMessage}\n\nPor favor, verifique:\n• Se você tem permissão para instalar aplicativos de fontes desconhecidas\n• Se o app está em primeiro plano\n• Tente baixar novamente se o problema persistir`,
          [
            {
              text: 'Tentar Novamente',
              onPress: () => {
                setTimeout(() => handleUpdate(), 100);
              },
            },
            {
              text: 'OK',
              style: 'cancel',
              onPress: () => {
                if (onUpdateComplete) {
                  onUpdateComplete();
                }
                if (!updateInfo.isMandatory) {
                  onDismiss();
                }
              },
            },
          ],
          { cancelable: !updateInfo.isMandatory }
        );
      }
    } catch (error) {
      console.error('❌ [handleUpdate] Erro geral:', error);
      console.error('❌ [handleUpdate] Stack:', error.stack);
      setError(error?.message || 'Erro desconhecido');
      setDownloading(false);
      setInstalling(false);

      // Não fechar o app, apenas mostrar erro
      try {
        Alert.alert(
          'Erro na Atualização',
          `Não foi possível baixar ou instalar a atualização.\n\n${error?.message || 'Erro desconhecido'}\n\nPor favor, tente novamente.`,
          [
            {
              text: 'Tentar Novamente',
              onPress: () => {
                // Recursão segura com delay
                setTimeout(() => handleUpdate(), 100);
              },
            },
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                if (!updateInfo.isMandatory) {
                  onDismiss();
                }
              },
            },
          ],
          { cancelable: !updateInfo.isMandatory }
        );
      } catch (alertError) {
        console.error('❌ [handleUpdateInternal] Erro ao mostrar Alert:', alertError);
        // Se o Alert também falhar, apenas logar e não fazer nada
      }
    }
  };

  if (!updateInfo || !updateInfo.latestVersion) {
    return null;
  }

  const { latestVersion, isMandatory } = updateInfo;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isMandatory ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#4A90E2', '#357ABD']}
            style={styles.header}
          >
            <Ionicons name="cloud-download-outline" size={48} color="#FFF" />
            <Text style={styles.title}>Atualização Disponível</Text>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={styles.versionText}>
              Versão {latestVersion.version}
            </Text>

            {latestVersion.releaseNotes && (
              <View style={styles.releaseNotesContainer}>
                <Text style={styles.releaseNotesTitle}>O que há de novo:</Text>
                <Text style={styles.releaseNotes}>{latestVersion.releaseNotes}</Text>
              </View>
            )}

            {isMandatory && (
              <View style={styles.mandatoryBadge}>
                <Ionicons name="alert-circle" size={16} color="#E74C3C" />
                <Text style={styles.mandatoryText}>Atualização obrigatória</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#E74C3C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {downloading && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Baixando... {Math.round(downloadProgress * 100)}%
                </Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${downloadProgress * 100}%` }]} />
                </View>
              </View>
            )}

            {installing && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={styles.progressText}>Preparando instalação...</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            {!downloading && !installing && (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.updateButton]}
                  onPress={handleUpdate}
                >
                  <Ionicons name="download-outline" size={20} color="#FFF" />
                  <Text style={styles.buttonText}>Baixar e Instalar</Text>
                </TouchableOpacity>

                {!isMandatory && (
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={onDismiss}
                  >
                    <Text style={styles.cancelButtonText}>Depois</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
  },
  content: {
    padding: 20,
  },
  versionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  releaseNotesContainer: {
    marginBottom: 16,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  releaseNotes: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  mandatoryText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#E74C3C',
    flex: 1,
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 4,
  },
  footer: {
    padding: 20,
    paddingTop: 0,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  updateButton: {
    backgroundColor: '#4A90E2',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
