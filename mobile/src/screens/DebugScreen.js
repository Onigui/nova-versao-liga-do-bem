/**
 * Tela de Debug - Mostra logs do app
 * Acesse via navegação ou adicione um botão secreto
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';
import {useAuth} from '../services/AuthService';

// Importação segura do RemoteLogger
let remoteLogger = null;
let logInfo, logError, logDebug, captureError;
try {
  const logger = require('../services/RemoteLogger');
  remoteLogger = logger.default || logger;
  logInfo = logger.logInfo || (() => {});
  logError = logger.logError || (() => {});
  logDebug = logger.logDebug || (() => {});
  captureError = logger.captureError || (() => {});
} catch (e) {
  console.warn('RemoteLogger não disponível:', e);
  logInfo = () => {};
  logError = () => {};
  logDebug = () => {};
  captureError = () => {};
}

export default function DebugScreen({navigation}) {
  if (!navigation) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>Erro: Navegação não disponível</Text>
      </View>
    );
  }

  let user;
  try {
    const authContext = useAuth();
    user = authContext?.user || null;
  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    user = null;
  }
  
  // Verificar se o usuário é administrador
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
  
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showLogDetail, setShowLogDetail] = useState(false);
  const [filterLevel, setFilterLevel] = useState('all');
  const scrollViewRef = useRef(null);

  // Se não for admin, redirecionar
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Acesso Negado', 'Esta área é restrita apenas para administradores.', [
        {text: 'OK', onPress: () => {
          if (navigation && navigation.goBack) {
            navigation.goBack();
          }
        }},
      ]);
    }
  }, [isAdmin, navigation]);
  
  if (!isAdmin) {
    return null;
  }

  useEffect(() => {
    // Atualizar logs a cada segundo
    const interval = setInterval(() => {
      try {
        if (remoteLogger && typeof remoteLogger.getLocalLogs === 'function') {
          const localLogs = remoteLogger.getLocalLogs();
          // Filtrar logs se necessário
          const filteredLogs = filterLevel === 'all' 
            ? localLogs 
            : localLogs.filter(log => log && log.level === filterLevel);
          setLogs(filteredLogs || []);
        } else {
          setLogs([]);
        }
      } catch (error) {
        console.error('Erro ao buscar logs:', error);
        setLogs([]);
      }
    }, 2000); // Atualizar a cada 2 segundos para não sobrecarregar

    return () => clearInterval(interval);
  }, [filterLevel]);

  useEffect(() => {
    if (autoScroll && scrollViewRef.current && logs.length > 0) {
      scrollViewRef.current.scrollToEnd({animated: true});
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    try {
      if (remoteLogger && typeof remoteLogger.clearLogs === 'function') {
        remoteLogger.clearLogs();
      }
      setLogs([]);
      Alert.alert('Logs Limpos', 'Todos os logs foram removidos.');
    } catch (error) {
      console.error('Erro ao limpar logs:', error);
      setLogs([]);
    }
  };

  const testLog = () => {
    try {
      if (logInfo) logInfo('🧪 Teste de log', {timestamp: new Date().toISOString()});
      if (logDebug) logDebug('Debug test', {test: true});
      if (logError) logError('Teste de erro', new Error('Este é um erro de teste'));
      Alert.alert('Log de Teste', 'Logs de teste foram adicionados!');
    } catch (error) {
      console.error('Erro ao criar log de teste:', error);
      Alert.alert('Erro', 'Não foi possível criar log de teste');
    }
  };

  const testError = () => {
    try {
      // Simular um erro
      throw new Error('Erro de teste para verificar captura');
    } catch (error) {
      try {
        if (captureError) {
          captureError(error, {
            context: 'Teste manual de erro',
            screen: 'DebugScreen',
          });
        }
        Alert.alert('Erro de Teste', 'Um erro de teste foi capturado e logado!');
      } catch (e) {
        console.error('Erro ao capturar erro de teste:', e);
      }
    }
  };

  const viewLogDetail = (log) => {
    setSelectedLog(log);
    setShowLogDetail(true);
  };

  const testConfig = async () => {
    try {
      if (logInfo) logInfo('🔄 Testando carregamento de configurações...');
      const response = await fetch(`${API_BASE_PATH}/app/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const config = await response.json();
        if (logInfo) logInfo('✅ Configurações carregadas com sucesso', config);
        Alert.alert(
          'Sucesso',
          `Configurações carregadas!\n\nLogo: ${config['app.logoUrl'] ? 'Configurado' : 'Não configurado'}\nNome: ${config['app.name'] || 'Padrão'}`,
        );
      } else {
        const errorText = await response.text();
        if (logError) logError('❌ Erro ao carregar configurações', {status: response.status, error: errorText});
        Alert.alert('Erro', `Status: ${response.status}\n${errorText}`);
      }
    } catch (error) {
      if (logError) logError('❌ Erro na requisição', error);
      Alert.alert('Erro', error.message || 'Erro desconhecido');
    }
  };

  const getLogColor = (level) => {
    switch (level) {
      case 'error':
        return '#EF4444';
      case 'warn':
        return '#F59E0B';
      case 'info':
        return '#3B82F6';
      case 'debug':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return '--:--:--';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '--:--:--';
      return date.toLocaleTimeString('pt-BR');
    } catch (error) {
      return '--:--:--';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug & Logs</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={testConfig} style={styles.actionButton}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={testLog} style={styles.actionButton}>
            <Ionicons name="bug" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={testError} style={styles.actionButton}>
            <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearLogs} style={styles.actionButton}>
            <Ionicons name="trash" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={() => setAutoScroll(!autoScroll)}
            style={[styles.toggleButton, autoScroll && styles.toggleButtonActive]}>
            <Ionicons
              name={autoScroll ? 'lock-closed' : 'lock-open'}
              size={16}
              color={autoScroll ? '#10B981' : '#6B7280'}
            />
            <Text style={styles.toggleText}>
              {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.logCount}>{logs.length} logs</Text>
        </View>
        
        {/* Filter buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {['all', 'error', 'warn', 'info', 'debug'].map(level => (
            <TouchableOpacity
              key={level}
              onPress={() => setFilterLevel(level)}
              style={[
                styles.filterButton,
                filterLevel === level && styles.filterButtonActive,
              ]}>
              <Text style={[
                styles.filterButtonText,
                filterLevel === level && styles.filterButtonTextActive,
              ]}>
                {level.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Logs */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.logsContainer}
        contentContainerStyle={styles.logsContent}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Nenhum log ainda</Text>
            <Text style={styles.emptySubtext}>
              Os logs aparecerão aqui quando o app executar ações
            </Text>
          </View>
        ) : (
          logs.filter(log => log && log.message).map((log, index) => {
            try {
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.logEntry}
                  onPress={() => viewLogDetail(log)}>
                  <View style={styles.logHeader}>
                    <View
                      style={[styles.logLevelBadge, {backgroundColor: getLogColor(log.level || 'info')}]}>
                      <Text style={styles.logLevelText}>{(log.level || 'info').toUpperCase()}</Text>
                    </View>
                    <Text style={styles.logTime}>{log.timestamp ? formatTime(log.timestamp) : '--:--:--'}</Text>
                    {(log.stackTrace || log.data) && (
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{marginLeft: 'auto'}} />
                    )}
                  </View>
                  <Text style={styles.logMessage}>{log.message || 'Log sem mensagem'}</Text>
                  {log.data && (
                    <Text style={styles.logData} numberOfLines={2}>
                      {typeof log.data === 'string' ? log.data : JSON.stringify(log.data)}
                    </Text>
                  )}
                  {log.stackTrace && (
                    <View style={styles.stackTraceBadge}>
                      <Ionicons name="code" size={12} color="#EF4444" />
                      <Text style={styles.stackTraceText}>Stack Trace disponível</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            } catch (error) {
              console.error('Erro ao renderizar log:', error);
              return null;
            }
          })
        )}
      </ScrollView>

      {/* Modal de detalhes do log */}
      <Modal
        visible={showLogDetail}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLogDetail(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalhes do Log</Text>
            <TouchableOpacity
              onPress={() => setShowLogDetail(false)}
              style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>
          
          {selectedLog && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Nível:</Text>
                <View style={[styles.logLevelBadge, {backgroundColor: getLogColor(selectedLog.level)}]}>
                  <Text style={styles.logLevelText}>{selectedLog.level.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Mensagem:</Text>
                <Text style={styles.detailValue}>{selectedLog.message}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Timestamp:</Text>
                <Text style={styles.detailValue}>{selectedLog.timestamp}</Text>
              </View>

              {selectedLog.data && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Dados:</Text>
                  <ScrollView style={styles.detailDataContainer}>
                    <Text style={styles.detailDataText}>
                      {typeof selectedLog.data === 'string' 
                        ? selectedLog.data 
                        : JSON.stringify(selectedLog.data, null, 2)}
                    </Text>
                  </ScrollView>
                </View>
              )}

              {selectedLog.stackTrace && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Stack Trace:</Text>
                  <ScrollView style={styles.detailDataContainer}>
                    <Text style={styles.detailDataText}>{selectedLog.stackTrace}</Text>
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#8B5CF6',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  toggleButtonActive: {
    backgroundColor: '#ECFDF5',
  },
  toggleText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  logCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  logsContainer: {
    flex: 1,
  },
  logsContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  logEntry: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  logLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  logLevelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logMessage: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    marginBottom: 4,
  },
  logData: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  stackTraceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    gap: 4,
  },
  stackTraceText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  filterContainer: {
    marginTop: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'monospace',
  },
  detailDataContainer: {
    maxHeight: 300,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  detailDataText: {
    fontSize: 11,
    color: '#1F2937',
    fontFamily: 'monospace',
  },
});

