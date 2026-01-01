import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NotificationService from './src/services/NotificationService';
import UpdateChecker from './src/components/UpdateChecker';

// Navigation
import { AuthStack, AppStack } from './src/navigation/AppNavigator';

// Services
import { AuthProvider, useAuth } from './src/services/AuthService';
import ErrorBoundary from './src/components/ErrorBoundary';

const Stack = createStackNavigator();

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // ou um splash screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="App" component={AppStack} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  // Removido: updateInfo e showUpdateModal movidos para LoginScreen

  useEffect(() => {
    // Removido: Verificação de atualizações agora é feita na tela de login
    // Configurar captura global de erros (se disponível)
    try {
      const ErrorUtils = require('react-native').ErrorUtils;
      if (ErrorUtils) {
        const originalHandler = ErrorUtils.getGlobalHandler();
        
        ErrorUtils.setGlobalHandler((error, isFatal) => {
          try {
            const { captureError, logError } = require('./src/services/RemoteLogger');
            
            // Capturar erro com contexto adicional
            const errorContext = {
              isFatal: isFatal || false,
              timestamp: new Date().toISOString(),
              context: 'Global Error Handler',
              errorType: error?.name || 'Unknown',
              errorMessage: error?.message || String(error),
              stack: error?.stack || 'No stack trace',
            };
            
            // Logar erro crítico
            logError('🚨 CRASH - Global Error Handler capturou erro fatal', errorContext);
            
            // Capturar erro também
            captureError(error, errorContext);
            
            // Tentar salvar logs imediatamente para erros fatais
            if (isFatal) {
              try {
                const remoteLogger = require('./src/services/RemoteLogger').default;
                if (remoteLogger && remoteLogger.saveLogsToStorage) {
                  remoteLogger.saveLogsToStorage().catch(() => {});
                }
              } catch (saveError) {
                // Ignorar erros ao salvar
              }
            }
          } catch (logError) {
            console.error('Erro ao capturar erro global:', logError);
            // Tentar salvar pelo menos no console
            console.error('🚨 CRASH FATAL:', error);
          }
          
          // Chamar handler original também
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        });
      }
    } catch (error) {
      console.warn('ErrorUtils não disponível:', error);
    }

    // Configurar listeners de notificação
    let unsubscribe;
    try {
      unsubscribe = NotificationService.setupNotificationListeners();
    } catch (error) {
      console.warn('Erro ao configurar notificações:', error);
    }
    
    return () => {
      try {
        const ErrorUtils = require('react-native').ErrorUtils;
        if (ErrorUtils) {
          const originalHandler = ErrorUtils.getGlobalHandler();
          if (originalHandler) {
            ErrorUtils.setGlobalHandler(originalHandler);
          }
        }
      } catch (error) {
        // Ignorar
      }
      
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          // Ignorar
        }
      }
    };
  }, []);

  // Removido: checkForUpdates movido para LoginScreen

  try {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PaperProvider>
            <AuthProvider>
              <NavigationContainer>
                <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
                <RootNavigator />
              </NavigationContainer>
              <UpdateChecker />
            </AuthProvider>
          </PaperProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('Erro crítico no App:', error);
    // Retornar uma tela de erro simples
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PaperProvider>
            <AuthProvider>
              <NavigationContainer>
                <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
                <RootNavigator />
              </NavigationContainer>
              <UpdateChecker />
            </AuthProvider>
          </PaperProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }
}
