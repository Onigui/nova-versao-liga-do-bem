import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NotificationService from './src/services/NotificationService';
import UpdateService from './src/services/UpdateService';
import UpdateModal from './src/components/UpdateModal';

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
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Verificar atualizações ao iniciar o app
    checkForUpdates();
    // Configurar captura global de erros (se disponível)
    try {
      const ErrorUtils = require('react-native').ErrorUtils;
      if (ErrorUtils) {
        const originalHandler = ErrorUtils.getGlobalHandler();
        
        ErrorUtils.setGlobalHandler((error, isFatal) => {
          try {
            const { captureError } = require('./src/services/RemoteLogger');
            captureError(error, {
              isFatal,
              timestamp: new Date().toISOString(),
              context: 'Global Error Handler',
            });
          } catch (logError) {
            console.error('Erro ao capturar erro global:', logError);
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

  const checkForUpdates = async () => {
    try {
      const info = await UpdateService.checkForUpdates();
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
        // Só mostrar modal se não estiver bloqueado (bloqueado mostra imediatamente)
        if (info.isBlocked) {
          setShowUpdateModal(true);
        } else {
          // Para atualizações não obrigatórias, verificar se já foi mostrado hoje
          const lastUpdateCheck = await AsyncStorage.getItem('lastUpdateCheck');
          const today = new Date().toDateString();
          if (lastUpdateCheck !== today) {
            setShowUpdateModal(true);
            await AsyncStorage.setItem('lastUpdateCheck', today);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
    }
  };

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
            </AuthProvider>
          </PaperProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }
}
