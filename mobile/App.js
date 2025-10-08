import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
// import NotificationService from './src/services/NotificationService';

// Navigation
import { AuthStack, AppStack } from './src/navigation/AppNavigator';

// Services
import { AuthProvider, useAuth } from './src/services/AuthService';

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
    // Configurar listeners de notificação
    const unsubscribe = NotificationService.setupNotificationListeners();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <PaperProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" backgroundColor="#ffffff" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}