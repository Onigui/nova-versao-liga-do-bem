import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {logError as remoteLogError} from '../services/RemoteLogger';

const logError =
  typeof remoteLogError === 'function'
    ? remoteLogError
    : (message, data) => {
        console.error(message, data);
      };

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false, error: null, errorInfo: null};
  }

  static getDerivedStateFromError(error) {
    return {hasError: true};
  }

  componentDidCatch(error, errorInfo) {
    try {
      const errorDetails = {
        error: {
          message: error?.message || 'Erro desconhecido',
          stack: error?.stack || 'Sem stack trace',
          name: error?.name || 'Error',
        },
        errorInfo: {
          componentStack: errorInfo?.componentStack || 'Sem component stack',
        },
        timestamp: new Date().toISOString(),
        userAgent: 'React Native',
      };

      // Log do erro (com try-catch para não quebrar se o logger falhar)
      try {
        logError('🚨 ERRO CRÍTICO - ErrorBoundary capturou um erro', errorDetails);
      } catch (logErr) {
        console.error('Erro ao logar no ErrorBoundary:', logErr);
      }

      // Log no console também
      console.error('🚨 ErrorBoundary capturou um erro:', error);
      console.error('Error Info:', errorInfo);

      this.setState({
        error,
        errorInfo,
      });
    } catch (e) {
      // Se até o ErrorBoundary falhar, pelo menos logar no console
      console.error('Erro crítico no ErrorBoundary:', e);
      this.setState({
        error: error || e,
        errorInfo: errorInfo || {componentStack: 'Erro ao processar errorInfo'},
      });
    }
  }

  handleReset = () => {
    this.setState({hasError: false, error: null, errorInfo: null});
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.title}>Ops! Algo deu errado</Text>
            <Text style={styles.subtitle}>
              O aplicativo encontrou um erro inesperado
            </Text>
          </View>

          <ScrollView style={styles.errorContainer}>
            <View style={styles.errorSection}>
              <Text style={styles.sectionTitle}>Mensagem de Erro:</Text>
              <Text style={styles.errorText}>
                {this.state.error?.message || 'Erro desconhecido'}
              </Text>
            </View>

            {this.state.error?.stack && (
              <View style={styles.errorSection}>
                <Text style={styles.sectionTitle}>Stack Trace:</Text>
                <ScrollView style={styles.stackContainer}>
                  <Text style={styles.stackText}>
                    {this.state.error.stack}
                  </Text>
                </ScrollView>
              </View>
            )}

            {this.state.errorInfo?.componentStack && (
              <View style={styles.errorSection}>
                <Text style={styles.sectionTitle}>Component Stack:</Text>
                <ScrollView style={styles.stackContainer}>
                  <Text style={styles.stackText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
  },
  errorSection: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    fontFamily: 'monospace',
  },
  stackContainer: {
    maxHeight: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
  },
  stackText: {
    fontSize: 11,
    color: '#1F2937',
    fontFamily: 'monospace',
  },
  actions: {
    paddingVertical: 20,
  },
  button: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;

