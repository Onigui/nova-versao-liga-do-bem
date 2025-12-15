/**
 * Tela de Debug - Versão Ultra Simplificada e Segura
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';

// Importação segura do RemoteLogger
let remoteLogger = null;
let getLocalLogs = () => [];
let clearLogs = () => {};
let logInfo = () => {};
let logError = () => {};
let captureError = () => {};

try {
  const logger = require('../services/RemoteLogger');
  remoteLogger = logger.default || logger;
  getLocalLogs = logger.getLocalLogs || (() => []);
  clearLogs = logger.clearLogs || (() => {});
  logInfo = logger.logInfo || (() => {});
  logError = logger.logError || (() => {});
  captureError = logger.captureError || (() => {});
} catch (e) {
  console.warn('RemoteLogger não disponível');
}

export default function DebugScreen({navigation}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const [filterLevel, setFilterLevel] = useState('all');
  
  // Obter usuário de forma segura
  let user = null;
  let isAdmin = false;
  try {
    const authContext = useAuth();
    user = authContext?.user || null;
    isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
  } catch (error) {
    console.warn('Erro ao obter usuário:', error.message);
  }
  
  // Verificar acesso e redirecionar se necessário
  useEffect(() => {
    mountedRef.current = true;
    
    if (!isAdmin && navigation) {
      setTimeout(() => {
        if (mountedRef.current) {
          Alert.alert('Acesso Negado', 'Esta área é restrita apenas para administradores.', [
            {text: 'OK', onPress: () => {
              try {
                if (navigation.goBack) navigation.goBack();
              } catch (e) {
                console.error('Erro ao voltar:', e);
              }
            }},
          ]);
        }
      }, 100);
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [isAdmin, navigation]);
  
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Debug & Logs</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Acesso Negado</Text>
        </View>
      </View>
    );
  }

  // Carregar logs uma vez ao montar
  useEffect(() => {
    if (mountedRef.current) {
      loadLogs();
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [filterLevel]);

  const loadLogs = () => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      
      // Tentar carregar logs do RemoteLogger de forma segura
      let localLogs = [];
      try {
        // Primeiro tentar usar a instância direta
        if (remoteLogger && typeof remoteLogger.getLocalLogs === 'function') {
          localLogs = remoteLogger.getLocalLogs() || [];
        } 
        // Se não funcionar, tentar importar novamente
        else {
          try {
            const logger = require('../services/RemoteLogger');
            const loggerInstance = logger.default || logger;
            if (loggerInstance && typeof loggerInstance.getLocalLogs === 'function') {
              localLogs = loggerInstance.getLocalLogs() || [];
            }
          } catch (reimportError) {
            console.warn('Erro ao reimportar RemoteLogger:', reimportError);
          }
        }
      } catch (loggerError) {
        console.error('Erro ao obter logs do RemoteLogger:', loggerError);
        localLogs = [];
      }
      
      // Garantir que é um array
      if (!Array.isArray(localLogs)) {
        localLogs = [];
      }
      
      // Filtrar logs se necessário
      if (filterLevel !== 'all') {
        localLogs = localLogs.filter(log => log && log.level === filterLevel);
      }
      
      // Limitar a 100 logs para não sobrecarregar
      const limitedLogs = localLogs.slice(-100);
      
      if (mountedRef.current) {
        setLogs(limitedLogs);
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      if (mountedRef.current) {
        setLogs([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleClearLogs = () => {
    try {
      Alert.alert(
        'Limpar Logs',
        'Tem certeza que deseja limpar todos os logs?',
        [
          {text: 'Cancelar', style: 'cancel'},
          {
            text: 'Limpar',
            style: 'destructive',
            onPress: () => {
              try {
                if (remoteLogger && typeof remoteLogger.clearLogs === 'function') {
                  remoteLogger.clearLogs();
                } else if (typeof clearLogs === 'function') {
                  clearLogs();
                }
                setLogs([]);
              } catch (e) {
                console.error('Erro ao limpar logs:', e);
                Alert.alert('Erro', 'Não foi possível limpar os logs.');
              }
            },
          },
        ],
      );
    } catch (e) {
      console.error('Erro no handleClearLogs:', e);
    }
  };

  const handleTestLog = () => {
    try {
      const testMessage = `Teste de log - ${new Date().toLocaleTimeString()}`;
      if (typeof logInfo === 'function') {
        logInfo(testMessage, {test: true});
      } else {
        console.log(testMessage);
      }
      setTimeout(() => {
        if (mountedRef.current) {
          loadLogs();
        }
      }, 500);
    } catch (e) {
      console.error('Erro no handleTestLog:', e);
    }
  };

  const handleTestError = () => {
    try {
      const testError = new Error(`Teste de erro - ${new Date().toLocaleTimeString()}`);
      if (typeof logError === 'function') {
        logError('Teste de erro', testError);
      } else if (typeof captureError === 'function') {
        captureError(testError, {test: true});
      } else {
        console.error('Teste de erro:', testError);
      }
      setTimeout(() => {
        if (mountedRef.current) {
          loadLogs();
        }
      }, 500);
    } catch (e) {
      console.error('Erro no handleTestError:', e);
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
        return '#6B7280';
      default:
        return '#9CA3AF';
    }
  };

  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return '--:--:--';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '--:--:--';
      return date.toLocaleTimeString('pt-BR');
    } catch (e) {
      return '--:--:--';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug & Logs</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={loadLogs} style={styles.actionButton}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleTestLog} style={styles.actionButton}>
            <Ionicons name="bug" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleTestError} style={styles.actionButton}>
            <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearLogs} style={styles.actionButton}>
            <Ionicons name="trash" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter buttons */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <ScrollView 
          style={styles.logsContainer} 
          contentContainerStyle={styles.logsContent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={20}>
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Nenhum log ainda</Text>
              <Text style={styles.emptySubtext}>
                Os logs aparecerão aqui quando o app executar ações
              </Text>
            </View>
          ) : (
            logs.slice(0, 50).map((log, index) => {
              if (!log || !log.message) return null;
              
              try {
                // Truncar dados muito grandes para evitar travamentos
                let displayData = log.data;
                if (displayData) {
                  const dataStr = typeof displayData === 'string' ? displayData : JSON.stringify(displayData);
                  if (dataStr.length > 500) {
                    displayData = dataStr.substring(0, 500) + '... (truncado)';
                  }
                }
                
                return (
                  <View
                    key={`log-${index}-${log.timestamp}`}
                    style={[styles.logEntry, {borderLeftColor: getLogColor(log.level || 'info')}]}>
                    <View style={styles.logHeader}>
                      <View
                        style={[styles.logLevelBadge, {backgroundColor: getLogColor(log.level || 'info')}]}>
                        <Text style={styles.logLevelText}>{(log.level || 'info').toUpperCase()}</Text>
                      </View>
                      <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                    </View>
                    <Text style={styles.logMessage} numberOfLines={5}>{log.message || 'Log sem mensagem'}</Text>
                    {displayData && (
                      <Text style={styles.logData} numberOfLines={3}>
                        {typeof displayData === 'string' ? displayData : JSON.stringify(displayData, null, 2)}
                      </Text>
                    )}
                  </View>
                );
              } catch (error) {
                console.error('Erro ao renderizar log:', error);
                return null;
              }
            })
          )}
        </ScrollView>
      )}
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
    fontSize: 20,
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
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logsContainer: {
    flex: 1,
  },
  logsContent: {
    padding: 16,
  },
  logEntry: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    fontSize: 10,
    color: '#6B7280',
  },
  logMessage: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 4,
  },
  logData: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginTop: 4,
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
    paddingHorizontal: 32,
  },
});
