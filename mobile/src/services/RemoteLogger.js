/**
 * Serviço de Logging Remoto
 * Envia logs para o backend para análise
 */

import { API_BASE_PATH } from '../config/apiConfig';

class RemoteLogger {
  constructor() {
    try {
      this.logs = [];
      this.maxLogs = 100; // Manter últimos 100 logs em memória
      this.sendInterval = 30000; // Enviar logs a cada 30 segundos
      this.isEnabled = true;
      this.intervalId = null;
      // Não iniciar envio automático na inicialização para evitar problemas
      // this.startSending();
    } catch (error) {
      console.error('Erro ao inicializar RemoteLogger:', error);
      this.logs = [];
      this.isEnabled = false;
    }
  }

  // Adicionar log
  log(level, message, data = null) {
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

    // Log local também
    if (level === 'error') {
      console.error(`[${level.toUpperCase()}]`, message, data);
      if (stackTrace) {
        console.error('Stack Trace:', stackTrace);
      }
    } else if (level === 'warn') {
      console.warn(`[${level.toUpperCase()}]`, message, data);
    } else {
      console.log(`[${level.toUpperCase()}]`, message, data);
    }
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

