import React, { useEffect } from 'react';
import {
  StatusBar,
  View,
  ActivityIndicator,
  StyleSheet,
  InteractionManager,
} from 'react-native';
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

const styles = StyleSheet.create({
  bootSplash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});

function RootNavigator() {
  const { isAuthenticated } = useAuth();

  // Nunca montar só um Stack.Screen condicional — quebra o React Navigation / screens no Android.
  return (
    <Stack.Navigator
      key={isAuthenticated ? 'signed-in' : 'signed-out'}
      initialRouteName={isAuthenticated ? 'App' : 'Auth'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Auth" component={AuthStack} />
      <Stack.Screen name="App" component={AppStack} />
    </Stack.Navigator>
  );
}

/**
 * Nunca renderizar NavigationContainer sem um Navigator filho.
 * Retornar `null` durante loading quebrava o app na abertura (crash imediato).
 */
function AppNavigation() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.bootSplash}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  // Removido: updateInfo e showUpdateModal movidos para LoginScreen

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;
    let deferredTimer;
    /** Referência ao handler global anterior, para restaurar no unmount sem circularidade. */
    let globalHandlerToRestore = null;

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }
      deferredTimer = setTimeout(() => {
        if (cancelled) {
          return;
        }
        try {
          const ErrorUtils = require('react-native').ErrorUtils;
          if (ErrorUtils) {
            globalHandlerToRestore = ErrorUtils.getGlobalHandler();

            ErrorUtils.setGlobalHandler((error, isFatal) => {
              try {
                const { captureError, logError } = require('./src/services/RemoteLogger');
                const errorContext = {
                  isFatal: isFatal || false,
                  timestamp: new Date().toISOString(),
                  context: 'Global Error Handler',
                  errorType: error?.name || 'Unknown',
                  errorMessage: error?.message || String(error),
                  stack: error?.stack || 'No stack trace',
                };
                logError('🚨 CRASH - Global Error Handler capturou erro fatal', errorContext);
                captureError(error, errorContext);
                if (isFatal) {
                  try {
                    const remoteLogger = require('./src/services/RemoteLogger').default;
                    if (remoteLogger && remoteLogger.saveLogsToStorage) {
                      remoteLogger.saveLogsToStorage().catch(() => {});
                    }
                  } catch (saveError) {
                    /* noop */
                  }
                }
              } catch (logError) {
                console.error('Erro ao capturar erro global:', logError);
                console.error('🚨 CRASH FATAL:', error);
              }
              if (globalHandlerToRestore) {
                globalHandlerToRestore(error, isFatal);
              }
            });
          }
        } catch (error) {
          console.warn('ErrorUtils não disponível:', error);
        }

        try {
          unsubscribe = NotificationService.setupNotificationListeners();
        } catch (error) {
          console.warn('Erro ao configurar notificações:', error);
        }
      }, 120);
    });

    return () => {
      cancelled = true;
      if (deferredTimer) {
        clearTimeout(deferredTimer);
      }
      if (typeof interactionHandle?.cancel === 'function') {
        interactionHandle.cancel();
      }
      try {
        const ErrorUtils = require('react-native').ErrorUtils;
        if (ErrorUtils && globalHandlerToRestore) {
          ErrorUtils.setGlobalHandler(globalHandlerToRestore);
        }
      } catch (error) {
        /* noop */
      }
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          /* noop */
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
              <AppNavigation />
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
              <AppNavigation />
              <UpdateChecker />
            </AuthProvider>
          </PaperProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }
}
