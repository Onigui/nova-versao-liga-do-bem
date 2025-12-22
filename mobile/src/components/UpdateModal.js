import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Clipboard,
  Platform,
  InteractionManager,
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
    console.log('🔘 [handleUpdate] Botão clicado');
    
    try {
      // Validar updateInfo primeiro
      if (!updateInfo?.latestVersion?.apkUrl) {
        console.error('❌ [handleUpdate] URL não disponível');
        Alert.alert('Erro', 'URL do APK não disponível');
        return;
      }

      const apkUrl = updateInfo.latestVersion.apkUrl?.trim();
      console.log('🔗 [handleUpdate] URL do APK:', apkUrl);

      if (!apkUrl) {
        console.error('❌ [handleUpdate] URL vazia após trim');
        Alert.alert('Erro', 'URL do APK inválida');
        return;
      }

      // Validar URL
      if (!apkUrl.startsWith('http://') && !apkUrl.startsWith('https://')) {
        console.error('❌ [handleUpdate] URL não começa com http:// ou https://');
        Alert.alert(
          'URL Inválida',
          'A URL do APK não está no formato correto. Por favor, verifique no painel administrativo.',
          [{ text: 'OK' }],
        );
        return;
      }

      // Atualizar estados de forma segura
      try {
        setError(null);
        setDownloadProgress(0);
        setDownloading(true);
      } catch (stateError) {
        console.error('❌ [handleUpdate] Erro ao atualizar estado:', stateError);
      }

      console.log('📥 [handleUpdate] Chamando UpdateService.downloadAPK...');
      
      // Fazer download com tratamento de erro robusto
      let filePath;
      try {
        filePath = await UpdateService.downloadAPK(apkUrl, (progress) => {
          try {
            setDownloadProgress(progress);
            console.log(`📊 [handleUpdate] Progresso: ${Math.round(progress * 100)}%`);
          } catch (progressError) {
            console.warn('⚠️ [handleUpdate] Erro ao atualizar progresso:', progressError);
          }
        });
        console.log('✅ [handleUpdate] Download concluído, resultado:', filePath);
      } catch (downloadError) {
        console.error('❌ [handleUpdate] Erro no download:', downloadError);
        setDownloading(false);
        setError(downloadError?.message || 'Erro desconhecido no download');
        
        Alert.alert(
          'Erro no Download',
          `Não foi possível baixar a atualização.\n\n${downloadError?.message || 'Erro desconhecido'}\n\nTente novamente ou use o link manual.`,
          [
            {
              text: 'Copiar Link',
              onPress: async () => {
                try {
                  await Clipboard.setString(apkUrl);
                  Alert.alert('Sucesso', 'Link copiado! Cole no navegador para baixar.');
                } catch (e) {
                  console.error('Erro ao copiar:', e);
                }
              },
            },
            { text: 'OK', onPress: () => {
              if (!updateInfo.isMandatory) {
                onDismiss();
              }
            }},
          ],
        );
        return;
      }

      setDownloading(false);

      // Se filePath for 'download_iniciado', significa que foi iniciado via DownloadManager
      if (filePath === 'download_iniciado') {
        console.log('✅ [handleUpdate] Download iniciado via DownloadManager');
        Alert.alert(
          'Download Iniciado!',
          'O download da atualização foi iniciado.\n\n' +
          'Uma notificação aparecerá quando o download estiver completo.\n\n' +
          'Após o download, toque na notificação ou abra o arquivo na pasta Downloads para instalar.',
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
        );
        return;
      }

      // Se chegou aqui, temos um caminho de arquivo real
      console.log('📦 [handleUpdate] Tentando instalar APK...');
      setInstalling(true);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('📦 [handleUpdate] Chamando UpdateService.installAPK...');
        await UpdateService.installAPK(filePath);
        console.log('✅ [handleUpdate] Instalação iniciada!');
        
        setInstalling(false);
        Alert.alert(
          'Download Concluído!',
          'O instalador do Android foi aberto.\n\n' +
          'Por favor, confirme a instalação na tela que apareceu.',
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
        );
      } catch (installError) {
        console.error('❌ [handleUpdate] Erro na instalação:', installError);
        console.error('❌ [handleUpdate] Tipo do erro:', typeof installError);
        console.error('❌ [handleUpdate] Mensagem:', installError?.message);
        console.error('❌ [handleUpdate] Stack:', installError?.stack);
        
        setInstalling(false);
        const installErrorMessage = installError?.message || installError?.toString() || 'Erro desconhecido na instalação';
        setError(installErrorMessage);
        
        Alert.alert(
          'Download Concluído',
          `O download foi concluído, mas não foi possível abrir o instalador automaticamente.\n\n` +
          `Por favor, abra o arquivo na pasta Downloads para instalar manualmente.\n\n` +
          `Erro: ${installErrorMessage}`,
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
        );
      }
    } catch (error) {
      // Catch ALL - captura qualquer erro não tratado
      console.error('❌ [handleUpdate] ERRO CRÍTICO não tratado:', error);
      console.error('❌ [handleUpdate] Tipo:', typeof error);
      console.error('❌ [handleUpdate] Mensagem:', error?.message);
      console.error('❌ [handleUpdate] Stack:', error?.stack);
      console.error('❌ [handleUpdate] Erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      setDownloading(false);
      setInstalling(false);
      const errorMessage = error?.message || error?.toString() || 'Erro desconhecido ao processar atualização';
      setError(errorMessage);
      
      Alert.alert(
        'Erro na Atualização',
        `Ocorreu um erro ao processar a atualização.\n\nErro: ${errorMessage}\n\nPor favor, tente novamente ou entre em contato com o suporte.`,
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
      );
      
      Alert.alert(
        'Erro na Atualização',
        `Não foi possível baixar ou instalar a atualização.\n\n` +
        `Erro: ${error.message}\n\n` +
        `Tente novamente ou copie o link para baixar manualmente.`,
        [
          {
            text: 'Copiar Link',
            onPress: async () => {
              try {
                await Clipboard.setString(apkUrl);
                Alert.alert('Sucesso', 'Link copiado! Cole no navegador para baixar.');
              } catch (clipError) {
                console.error('Erro ao copiar:', clipError);
              }
            },
          },
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
        { cancelable: !updateInfo.isMandatory },
      );
    }
  };

  const handleLater = () => {
    if (!updateInfo?.isMandatory) {
      onDismiss();
    }
  };

  if (!visible || !updateInfo?.hasUpdate) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={updateInfo.isMandatory ? undefined : onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.modalHeader}>
            <Ionicons name="download" size={48} color="#FFFFFF" />
            <Text style={styles.modalTitle}>
              {updateInfo.isMandatory ? 'Atualização Obrigatória' : 'Nova Versão Disponível'}
            </Text>
          </LinearGradient>

          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>
              Uma nova versão ({updateInfo.latestVersion.version}) está disponível.
            </Text>

            {updateInfo.latestVersion.releaseNotes && (
              <View style={styles.releaseNotes}>
                <Text style={styles.releaseNotesTitle}>O que há de novo:</Text>
                <Text style={styles.releaseNotesText}>
                  {updateInfo.latestVersion.releaseNotes}
                </Text>
              </View>
            )}

            {updateInfo.isMandatory && (
              <View style={styles.mandatoryBadge}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text style={styles.mandatoryText}>
                  Esta atualização é obrigatória para continuar usando o app.
                </Text>
              </View>
            )}

            {/* Progresso do Download */}
            {downloading && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Baixando atualização... {Math.round(downloadProgress * 100)}%
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressBarFill, { width: `${downloadProgress * 100}%` }]} />
                </View>
              </View>
            )}

            {/* Status de Instalação */}
            {installing && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={styles.progressText}>
                  Preparando instalação...
                </Text>
              </View>
            )}

            {/* Mensagem de Erro */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.buttons}>
              {!updateInfo.isMandatory && !downloading && !installing && (
                <TouchableOpacity
                  style={styles.buttonSecondary}
                  onPress={handleLater}>
                  <Text style={styles.buttonSecondaryText}>Depois</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.buttonPrimary, 
                  (updateInfo.isMandatory || downloading || installing) && styles.buttonPrimaryFull,
                  (downloading || installing) && styles.buttonDisabled
                ]}
                onPress={() => {
                  // Envolver em InteractionManager para garantir que UI está pronta
                  InteractionManager.runAfterInteractions(() => {
                    // Adicionar try-catch no nível mais alto
                    try {
                      handleUpdate().catch(err => {
                        console.error('❌ [onPress] Erro não capturado:', err);
                        setDownloading(false);
                        setInstalling(false);
                        Alert.alert(
                          'Erro',
                          'Ocorreu um erro ao iniciar o download. Por favor, tente novamente.',
                          [{ text: 'OK' }]
                        );
                      });
                    } catch (syncErr) {
                      console.error('❌ [onPress] Erro síncrono:', syncErr);
                      setDownloading(false);
                      setInstalling(false);
                      Alert.alert(
                        'Erro',
                        'Ocorreu um erro ao processar a solicitação. Por favor, tente novamente.',
                        [{ text: 'OK' }]
                      );
                    }
                  });
                }}
                disabled={downloading || installing}>
                <LinearGradient
                  colors={downloading || installing ? ['#9CA3AF', '#6B7280'] : ['#8B5CF6', '#7C3AED']}
                  style={styles.buttonPrimaryGradient}>
                  {downloading ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.buttonPrimaryText}>Baixando...</Text>
                    </>
                  ) : installing ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.buttonPrimaryText}>Instalando...</Text>
                    </>
                  ) : (
                    <Text style={styles.buttonPrimaryText}>Baixar e Instalar</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
  },
  modalContent: {
    padding: 24,
  },
  modalMessage: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  releaseNotes: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  releaseNotesText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  mandatoryText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  buttonSecondary: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  buttonPrimary: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonPrimaryFull: {
    flex: 1,
  },
  buttonPrimaryGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

