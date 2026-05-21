import React, { useEffect } from 'react';
import { StatusBar, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NotificationService from './src/services/NotificationService';
import UpdateChecker from './src/components/UpdateChecker';

import { AuthStack, AppStack } from './src/navigation/AppNavigator';
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

/** Splash fora do NavigationContainer — evita crash com filho null no Android. */
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
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  useEffect(() => {
    try {
      const ErrorUtils = require('react-native').ErrorUtils;
      if (ErrorUtils) {
        const originalHandler = ErrorUtils.getGlobalHandler();

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
                if (remoteLogger?.saveLogsToStorage) {
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
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        });
      }
    } catch (error) {
      console.warn('ErrorUtils não disponível:', error);
    }

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

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider>
          <AuthProvider>
            <NavigationContainer>
              <AppNavigation />
            </NavigationContainer>
            <UpdateChecker />
          </AuthProvider>
        </PaperProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
