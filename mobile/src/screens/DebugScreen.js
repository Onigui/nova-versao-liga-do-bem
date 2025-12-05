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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import remoteLogger, {logInfo, logError, logDebug} from '../services/RemoteLogger';
import { API_BASE_PATH } from '../config/apiConfig';
import {useAuth} from '../services/AuthService';

export default function DebugScreen({navigation}) {
  const {user} = useAuth();
  
  // Verificar se o usuário é administrador
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
  
  // Se não for admin, redirecionar
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Acesso Negado', 'Esta área é restrita apenas para administradores.', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    }
  }, [isAdmin, navigation]);
  
  if (!isAdmin) {
    return null; // Não renderizar nada se não for admin
  }
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    // Atualizar logs a cada segundo
    const interval = setInterval(() => {
      const localLogs = remoteLogger.getLocalLogs();
      setLogs(localLogs);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll && scrollViewRef.current && logs.length > 0) {
      scrollViewRef.current.scrollToEnd({animated: true});
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    remoteLogger.clearLogs();
    setLogs([]);
    Alert.alert('Logs Limpos', 'Todos os logs foram removidos.');
  };

  const testLog = () => {
    logInfo('🧪 Teste de log', {timestamp: new Date().toISOString()});
    logDebug('Debug test', {test: true});
    Alert.alert('Log de Teste', 'Um log de teste foi adicionado!');
  };

  const testConfig = async () => {
    try {
      logInfo('🔄 Testando carregamento de configurações...');
      const response = await fetch(`${API_BASE_PATH}/app/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const config = await response.json();
        logInfo('✅ Configurações carregadas com sucesso', config);
        Alert.alert(
          'Sucesso',
          `Configurações carregadas!\n\nLogo: ${config['app.logoUrl'] ? 'Configurado' : 'Não configurado'}\nNome: ${config['app.name'] || 'Padrão'}`,
        );
      } else {
        const errorText = await response.text();
        logError('❌ Erro ao carregar configurações', {status: response.status, error: errorText});
        Alert.alert('Erro', `Status: ${response.status}\n${errorText}`);
      }
    } catch (error) {
      logError('❌ Erro na requisição', error);
      Alert.alert('Erro', error.message);
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
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR');
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
          <TouchableOpacity onPress={clearLogs} style={styles.actionButton}>
            <Ionicons name="trash" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
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
          logs.map((log, index) => (
            <View key={index} style={styles.logEntry}>
              <View style={styles.logHeader}>
                <View
                  style={[styles.logLevelBadge, {backgroundColor: getLogColor(log.level)}]}>
                  <Text style={styles.logLevelText}>{log.level.toUpperCase()}</Text>
                </View>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
              </View>
              <Text style={styles.logMessage}>{log.message}</Text>
              {log.data && (
                <Text style={styles.logData} numberOfLines={5}>
                  {log.data}
                </Text>
              )}
            </View>
          ))
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
});

