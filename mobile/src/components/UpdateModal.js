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

  const handleUpdate = async () => {
    if (!updateInfo?.latestVersion?.apkUrl) {
      Alert.alert('Erro', 'URL do APK não disponível');
      return;
    }

    // SOLUÇÃO RADICAL: Não usar RNFetchBlob (causa crash)
    // Abrir URL diretamente no navegador/DownloadManager do sistema
    const { Linking } = require('react-native');
    
    Alert.alert(
      'Atualização Disponível',
      `Uma nova versão (${updateInfo.latestVersion.version}) está disponível.\n\n` +
      `O download será iniciado no navegador ou gerenciador de downloads do seu dispositivo.\n\n` +
      `Após o download:\n` +
      `1. Abra o arquivo baixado\n` +
      `2. Clique em "Instalar"\n` +
      `3. Volte ao aplicativo`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            if (!updateInfo.isMandatory) {
              onDismiss();
            }
          },
        },
        {
          text: 'Baixar Agora',
          onPress: async () => {
            try {
              // Abrir URL diretamente - o sistema Android vai gerenciar o download
              const canOpen = await Linking.canOpenURL(updateInfo.latestVersion.apkUrl);
              if (canOpen) {
                await Linking.openURL(updateInfo.latestVersion.apkUrl);
                // Fechar modal após abrir URL
                setTimeout(() => {
                  if (!updateInfo.isMandatory) {
                    onDismiss();
                  }
                }, 1000);
              } else {
                Alert.alert('Erro', 'Não foi possível abrir a URL de download');
              }
            } catch (error) {
              console.error('Erro ao abrir URL:', error);
              Alert.alert(
                'Erro',
                'Não foi possível iniciar o download. Tente copiar o link manualmente.',
                [
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
          },
        },
      ],
      { cancelable: !updateInfo.isMandatory },
    );
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

