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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import UpdateService from '../services/UpdateService';

export default function UpdateModal({visible, updateInfo, onDismiss, onUpdateComplete}) {

  const handleUpdate = async () => {
    if (!updateInfo?.latestVersion?.apkUrl) {
      Alert.alert('Erro', 'URL do APK não disponível');
      return;
    }

    const apkUrl = updateInfo.latestVersion.apkUrl.trim();
    console.log('🔗 Tentando abrir URL:', apkUrl);

    // Validar URL
    if (!apkUrl.startsWith('http://') && !apkUrl.startsWith('https://')) {
      Alert.alert(
        'URL Inválida',
        'A URL do APK não está no formato correto. Por favor, verifique no painel administrativo.',
        [{ text: 'OK' }],
      );
      return;
    }

    try {
      // Método 1: Tentar abrir diretamente
      console.log('📱 Tentando abrir URL com Linking.openURL...');
      const canOpen = await Linking.canOpenURL(apkUrl);
      console.log('✅ canOpenURL result:', canOpen);

      if (canOpen) {
        try {
          await Linking.openURL(apkUrl);
          console.log('✅ URL aberta com sucesso');
          
          // Fechar modal após abrir URL
          setTimeout(() => {
            if (!updateInfo.isMandatory) {
              onDismiss();
            }
          }, 1000);
          return;
        } catch (openError) {
          console.error('❌ Erro ao abrir URL:', openError);
          // Continuar para método alternativo
        }
      }

      // Método 2: Se falhar, tentar com Intent explícito (Android)
      if (Platform.OS === 'android') {
        try {
          console.log('📱 Tentando método alternativo (Intent)...');
          // Tentar abrir com intent ACTION_VIEW
          const intentUrl = `intent://${apkUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
          const canOpenIntent = await Linking.canOpenURL(intentUrl);
          
          if (canOpenIntent) {
            await Linking.openURL(intentUrl);
            console.log('✅ URL aberta com Intent');
            setTimeout(() => {
              if (!updateInfo.isMandatory) {
                onDismiss();
              }
            }, 1000);
            return;
          }
        } catch (intentError) {
          console.error('❌ Erro com Intent:', intentError);
        }
      }

      // Método 3: Se tudo falhar, oferecer copiar link
      Alert.alert(
        'Não foi possível abrir automaticamente',
        `A URL não pôde ser aberta automaticamente.\n\n` +
        `Opções:\n` +
        `1. Copiar o link e colar no navegador\n` +
        `2. Abrir manualmente: ${apkUrl.substring(0, 50)}...`,
        [
          {
            text: 'Copiar Link',
            onPress: async () => {
              try {
                await Clipboard.setString(apkUrl);
                Alert.alert('Sucesso', 'Link copiado para a área de transferência! Cole no navegador.');
              } catch (clipError) {
                console.error('Erro ao copiar:', clipError);
                Alert.alert('Erro', 'Não foi possível copiar o link.');
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
    } catch (error) {
      console.error('❌ Erro geral ao processar URL:', error);
      Alert.alert(
        'Erro',
        `Não foi possível iniciar o download.\n\nErro: ${error.message}\n\n` +
        `Por favor, copie o link manualmente:\n${apkUrl}`,
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
            text: 'OK',
            onPress: () => {
              if (!updateInfo.isMandatory) {
                onDismiss();
              }
            },
          },
        ],
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

            <View style={styles.buttons}>
              {!updateInfo.isMandatory && (
                <TouchableOpacity
                  style={styles.buttonSecondary}
                  onPress={handleLater}>
                  <Text style={styles.buttonSecondaryText}>Depois</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.buttonPrimary, updateInfo.isMandatory && styles.buttonPrimaryFull]}
                onPress={handleUpdate}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.buttonPrimaryGradient}>
                  <Text style={styles.buttonPrimaryText}>Baixar Atualização</Text>
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

