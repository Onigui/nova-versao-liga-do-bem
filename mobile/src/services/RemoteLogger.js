/**
 * Serviço de Logging Remoto
 * Envia logs para o backend para análise
 */

import { API_BASE_PATH } from '../config/apiConfig';

class RemoteLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100; // Manter últimos 100 logs em memória
    this.sendInterval = 30000; // Enviar logs a cada 30 segundos
    this.isEnabled = true;
    this.startSending();
  }

  // Adicionar log
  log(level, message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level, // 'info', 'warn', 'error', 'debug'
      message,
      data: data ? JSON.stringify(data) : null,
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

  // Limpar logs locais
  clearLogs() {
    this.logs = [];
  }
}

// Instância singleton
const remoteLogger = new RemoteLogger();

// Funções de conveniência
export const logInfo = (message, data) => remoteLogger.log('info', message, data);
export const logWarn = (message, data) => remoteLogger.log('warn', message, data);
export const logError = (message, data) => remoteLogger.log('error', message, data);
export const logDebug = (message, data) => remoteLogger.log('debug', message, data);

export default remoteLogger;

