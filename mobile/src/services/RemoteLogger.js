/**
 * Serviço de Logging Remoto
 * Envia logs para o backend para análise
 */

import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

class RemoteLogger {
  constructor() {
    try {
      this.logs = [];
      this.maxLogs = 200; // Manter últimos 200 logs em memória
      this.sendInterval = 30000; // Enviar logs a cada 30 segundos
      this.isEnabled = true;
      this.intervalId = null;
      this.storageKey = 'app_logs';
      // Carregar logs salvos do storage
      this.loadStoredLogs();
      // Não iniciar envio automático na inicialização para evitar problemas
      // this.startSending();
    } catch (error) {
      console.error('Erro ao inicializar RemoteLogger:', error);
      this.logs = [];
      this.isEnabled = false;
    }
  }

  // Carregar logs salvos do AsyncStorage
  async loadStoredLogs() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.logs = parsed.slice(-this.maxLogs);
        }
      }
    } catch (error) {
      console.warn('Erro ao carregar logs do storage:', error);
    }
  }

  // Salvar logs no AsyncStorage de forma síncrona quando possível (para crashes)
  async saveLogsToStorage() {
    try {
      const logsToSave = this.logs.slice(-100); // Salvar últimos 100 no storage
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(logsToSave));
      
      // Também salvar logs críticos (erros) em uma chave separada para recuperação rápida
      const criticalLogs = logsToSave.filter(log => log.level === 'error');
      if (criticalLogs.length > 0) {
        await AsyncStorage.setItem('app_critical_logs', JSON.stringify(criticalLogs.slice(-50)));
      }
    } catch (error) {
      console.warn('Erro ao salvar logs no storage:', error);
      // Tentar salvar pelo menos uma versão simplificada em caso de erro
      try {
        const simpleLogs = this.logs.slice(-20).map(log => ({
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
        }));
        await AsyncStorage.setItem(this.storageKey + '_backup', JSON.stringify(simpleLogs));
      } catch (backupError) {
        // Se até o backup falhar, apenas logar
        console.error('Erro ao salvar backup de logs:', backupError);
      }
    }
  }

  // Adicionar log
  log(level, message, data = null) {
    try {
      // Capturar stack trace para erros
      let stackTrace = null;
      if (level === 'error' && data) {
        try {
          if (data instanceof Error) {
            stackTrace = data.stack || null;
            data = {
              message: data.message,
              name: data.name,
              stack: data.stack,
              ...(data.other && typeof data.other === 'object' ? data.other : {}),
            };
          } else if (data?.error?.stack) {
            stackTrace = data.error.stack;
          } else if (data?.stack) {
            stackTrace = data.stack;
          }
        } catch (e) {
          // Ignorar erros ao processar stack trace
        }
      }

      // Capturar stack trace do contexto atual se for erro
      if (level === 'error' && !stackTrace) {
        try {
          const error = new Error();
          if (error.stack) {
            stackTrace = error.stack;
          }
        } catch (e) {
          // Ignorar
        }
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        level, // 'info', 'warn', 'error', 'debug'
        message,
        data: data ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) : null,
        stackTrace,
        platform: 'mobile',
      };

      this.logs.push(logEntry);

      // Manter apenas os últimos N logs
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }

      // Para erros críticos, tentar salvar imediatamente de forma mais agressiva
      if (level === 'error') {
        // Salvar síncrono quando possível (para crashes)
        this.saveLogsToStorageSync().catch(() => {
          // Se falhar, tentar async como fallback
          this.saveLogsToStorage().catch(e => {
            // Ignorar erros de salvamento
          });
        });
      } else {
        // Salvar no storage (async, não bloquear)
        this.saveLogsToStorage().catch(e => {
          // Ignorar erros de salvamento
        });
      }

      // Log local também — NÃO usar console.error (no RN isso vira overlay/crash)
      if (level === 'error') {
        console.warn(`[${level.toUpperCase()}]`, message, data);
        if (stackTrace) {
          console.warn('Stack Trace:', stackTrace);
        }
      } else if (level === 'warn') {
        console.warn(`[${level.toUpperCase()}]`, message, data);
      } else {
        console.log(`[${level.toUpperCase()}]`, message, data);
      }
    } catch (e) {
      // Se até o log falhar, pelo menos tentar console
      console.error('Erro ao processar log:', e);
      console.log(`[${level?.toUpperCase() || 'LOG'}]`, message);
    }
  }

  // Salvar logs de forma síncrona (usando Promise.resolve para erros críticos)
  async saveLogsToStorageSync() {
    return this.saveLogsToStorage();
  }

  // Enviar logs para o backend
  async sendLogs() {
    if (!this.isEnabled || this.logs.length === 0) {
      return;
    }

    try {
      const logsToSend = [...this.logs];
      this.logs = []; // Limpar após copiar

      const response = await fetch(`${API_BASE_PATH}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToSend }),
      });

      if (!response.ok) {
        // Se falhar, recolocar os logs de volta
        this.logs.unshift(...logsToSend);
        if (this.logs.length > this.maxLogs) {
          this.logs = this.logs.slice(0, this.maxLogs);
        }
      }
    } catch (error) {
      // Em caso de erro, recolocar os logs
      console.error('Erro ao enviar logs remotos:', error);
    }
  }

  // Iniciar envio periódico
  startSending() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      this.sendLogs();
    }, this.sendInterval);
  }

  // Parar envio
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.sendLogs(); // Enviar logs restantes antes de parar
  }

  // Obter logs locais (para debug screen)
  getLocalLogs() {
    return [...this.logs];
  }

  // Carregar logs críticos salvos
  async getCriticalLogs() {
    try {
      const stored = await AsyncStorage.getItem('app_critical_logs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Erro ao carregar logs críticos:', error);
    }
    return [];
  }

  // Obter todos os logs (incluindo críticos salvos)
  async getAllLogs() {
    try {
      const criticalLogs = await this.getCriticalLogs();
      const currentLogs = this.getLocalLogs();
      // Combinar e ordenar por timestamp
      const allLogs = [...criticalLogs, ...currentLogs].sort((a, b) => {
        return new Date(a.timestamp) - new Date(b.timestamp);
      });
      return allLogs;
    } catch (error) {
      console.warn('Erro ao obter todos os logs:', error);
      return this.getLocalLogs();
    }
  }

  // Capturar erro com contexto adicional
  captureError(error, context = {}) {
    const errorData = {
      error: {
        message: error?.message || 'Erro desconhecido',
        name: error?.name || 'Error',
        stack: error?.stack || null,
      },
      context,
      timestamp: new Date().toISOString(),
    };
    this.log('error', '🚨 Erro capturado', errorData);
  }

  // Limpar logs locais
  clearLogs() {
    this.logs = [];
  }
}

// Instância singleton
let remoteLogger = null;
try {
  remoteLogger = new RemoteLogger();
} catch (error) {
  console.error('Erro ao criar instância do RemoteLogger:', error);
  // Criar uma instância mínima em caso de erro
  remoteLogger = {
    log: (level, message, data) => {
      console.log(`[${level.toUpperCase()}]`, message, data);
    },
    captureError: (error, context) => {
      console.error('Erro capturado:', error, context);
    },
  };
}

// Funções de conveniência com fallback seguro
export const logInfo = (message, data) => {
  try {
    if (remoteLogger && remoteLogger.log) {
      remoteLogger.log('info', message, data);
    } else {
      console.log('[INFO]', message, data);
    }
  } catch (e) {
    console.log('[INFO]', message, data);
  }
};

export const logWarn = (message, data) => {
  try {
    if (remoteLogger && remoteLogger.log) {
      remoteLogger.log('warn', message, data);
    } else {
      console.warn('[WARN]', message, data);
    }
  } catch (e) {
    console.warn('[WARN]', message, data);
  }
};

export const logError = (message, data) => {
  try {
    if (remoteLogger && remoteLogger.log) {
      remoteLogger.log('error', message, data);
    } else {
      console.error('[ERROR]', message, data);
    }
  } catch (e) {
    console.error('[ERROR]', message, data);
  }
};

export const logDebug = (message, data) => {
  try {
    if (remoteLogger && remoteLogger.log) {
      remoteLogger.log('debug', message, data);
    } else {
      console.log('[DEBUG]', message, data);
    }
  } catch (e) {
    console.log('[DEBUG]', message, data);
  }
};

export const captureError = (error, context) => {
  try {
    if (remoteLogger && remoteLogger.captureError) {
      remoteLogger.captureError(error, context);
    } else {
      console.error('Erro capturado:', error, context);
    }
  } catch (e) {
    console.error('Erro capturado:', error, context);
  }
};

export default remoteLogger;

