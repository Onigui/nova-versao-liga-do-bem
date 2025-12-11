import React, { useEffect } from 'react';
import { StatusBar, ErrorUtils } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NotificationService from './src/services/NotificationService';

// Navigation
import { AuthStack, AppStack } from './src/navigation/AppNavigator';

// Services
import { AuthProvider, useAuth } from './src/services/AuthService';
import ErrorBoundary from './src/components/ErrorBoundary';
import { captureError } from './src/services/RemoteLogger';

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
  useEffect(() => {
    // Configurar captura global de erros
    const originalHandler = ErrorUtils.getGlobalHandler();
    
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      captureError(error, {
        isFatal,
        timestamp: new Date().toISOString(),
        context: 'Global Error Handler',
      });
      
      // Chamar handler original também
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });

    // Configurar listeners de notificação
    const unsubscribe = NotificationService.setupNotificationListeners();
    
    return () => {
      // Restaurar handler original
      if (originalHandler) {
        ErrorUtils.setGlobalHandler(originalHandler);
      }
      
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

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
