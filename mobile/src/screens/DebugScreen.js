/**
 * Tela de Debug - Versão Simplificada e Segura
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
import { API_BASE_PATH } from '../config/apiConfig';
import {useAuth} from '../services/AuthService';

// Importação segura do RemoteLogger
let remoteLogger = null;
try {
  const logger = require('../services/RemoteLogger');
  remoteLogger = logger.default || logger;
} catch (e) {
  console.warn('RemoteLogger não disponível');
}

export default function DebugScreen({navigation}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(true);
  
  // Obter usuário de forma segura
  let user = null;
  try {
    const authContext = useAuth();
    user = authContext?.user || null;
  } catch (error) {
    console.warn('Erro ao obter usuário:', error.message);
  }
  
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
  
  // Verificar acesso e redirecionar se necessário
  useEffect(() => {
    if (!isAdmin && navigation) {
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
    return () => {
      setMounted(false);
    };
  }, [isAdmin, navigation]);
  
  if (!isAdmin) {
    return null;
  }

  // Carregar logs uma vez ao montar
  useEffect(() => {
    if (mounted) {
      loadLogs();
    }
  }, [mounted]);

  const loadLogs = () => {
    if (!mounted) return;
    
    try {
      setLoading(true);
      
      // Tentar carregar logs do RemoteLogger
      if (remoteLogger && typeof remoteLogger.getLocalLogs === 'function') {
        try {
          const localLogs = remoteLogger.getLocalLogs();
          if (Array.isArray(localLogs)) {
            // Limitar a 200 logs para não sobrecarregar
            const limitedLogs = localLogs.slice(-200);
            setLogs(limitedLogs);
          } else {
            setLogs([]);
          }
        } catch (loggerError) {
          console.error('Erro ao obter logs do RemoteLogger:', loggerError);
          setLogs([]);
        }
      } else {
        setLogs([]);
      }
      
      // Também tentar carregar logs salvos no AsyncStorage como backup
      try {
        AsyncStorage.getItem('app_logs').then(storedLogs => {
          if (storedLogs && mounted) {
            try {
              const parsed = JSON.parse(storedLogs);
              if (Array.isArray(parsed) && parsed.length > 0) {
                // Combinar com logs atuais, removendo duplicatas
                setLogs(prev => {
                  const combined = [...prev, ...parsed];
                  const unique = combined.filter((log, index, self) => 
                    index === self.findIndex(l => l.timestamp === log.timestamp && l.message === log.message)
                  );
                  return unique.slice(-200);
                });
              }
            } catch (e) {
              console.warn('Erro ao parsear logs do storage:', e);
            }
          }
        }).catch(e => {
          console.warn('Erro ao carregar logs do storage:', e);
        });
      } catch (e) {
        // Ignorar erros do AsyncStorage
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      setLogs([]);
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  const clearLogs = () => {
    try {
      if (remoteLogger && typeof remoteLogger.clearLogs === 'function') {
        remoteLogger.clearLogs();
      }
      setLogs([]);
      Alert.alert('Sucesso', 'Logs limpos com sucesso.');
    } catch (error) {
      console.error('Erro ao limpar logs:', error);
      Alert.alert('Erro', 'Não foi possível limpar os logs.');
    }
  };

  const testLog = () => {
    try {
      console.log('🧪 Teste de log manual');
      if (remoteLogger && typeof remoteLogger.logInfo === 'function') {
        remoteLogger.logInfo('🧪 Teste de log', {timestamp: new Date().toISOString()});
      }
      Alert.alert('Sucesso', 'Log de teste adicionado! Use "Atualizar" para ver.');
    } catch (error) {
      console.error('Erro ao criar log de teste:', error);
      Alert.alert('Erro', 'Não foi possível criar log de teste.');
    }
  };

  const testConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_PATH}/app/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const config = await response.json();
        Alert.alert(
          'Sucesso',
          `Configurações carregadas!\n\nNome: ${config['app.name'] || 'Padrão'}\nLogo: ${config['app.logoUrl'] ? 'Configurado' : 'Não configurado'}`,
        );
      } else {
        const errorText = await response.text();
        Alert.alert('Erro', `Status: ${response.status}\n${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      Alert.alert('Erro', error.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
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

  const handleBack = () => {
    try {
      if (navigation && navigation.goBack) {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Erro ao voltar:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug & Logs</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={loadLogs} 
            style={styles.actionButton}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={testLog} style={styles.actionButton}>
            <Ionicons name="bug" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={testConfig} style={styles.actionButton}>
            <Ionicons name="settings" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearLogs} style={styles.actionButton}>
            <Ionicons name="trash" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Text style={styles.logCount}>{logs.length} logs encontrados</Text>
        <TouchableOpacity onPress={loadLogs} style={styles.refreshButton}>
          <Ionicons name="refresh-circle" size={20} color="#8B5CF6" />
          <Text style={styles.refreshButtonText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      {/* Logs */}
      <ScrollView style={styles.logsContainer} contentContainerStyle={styles.logsContent}>
        {loading && logs.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.emptyText}>Carregando logs...</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Nenhum log ainda</Text>
            <Text style={styles.emptySubtext}>
              Os logs aparecerão aqui quando o app executar ações
            </Text>
            <TouchableOpacity onPress={testLog} style={styles.testButton}>
              <Text style={styles.testButtonText}>Criar Log de Teste</Text>
            </TouchableOpacity>
          </View>
        ) : (
          logs.filter(log => log && log.message).map((log, index) => {
            try {
              const level = log.level || 'info';
              const message = log.message || 'Log sem mensagem';
              const timestamp = log.timestamp ? formatTime(log.timestamp) : '--:--:--';
              
              return (
                <View key={index} style={styles.logEntry}>
                  <View style={styles.logHeader}>
                    <View
                      style={[styles.logLevelBadge, {backgroundColor: getLogColor(level)}]}>
                      <Text style={styles.logLevelText}>{level.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.logTime}>{timestamp}</Text>
                  </View>
                  <Text style={styles.logMessage}>{message}</Text>
                  {log.data && (
                    <Text style={styles.logData} numberOfLines={3}>
                      {typeof log.data === 'string' 
                        ? log.data 
                        : JSON.stringify(log.data).substring(0, 200)}
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
    minWidth: 36,
    alignItems: 'center',
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
  logCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600',
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
    paddingHorizontal: 32,
  },
  testButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
});
