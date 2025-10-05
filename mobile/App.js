import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import AdoptionScreen from './src/screens/AdoptionScreen';
import VolunteersScreen from './src/screens/VolunteersScreen';
import EventsScreen from './src/screens/EventsScreen';
import TransparencyScreen from './src/screens/TransparencyScreen';
import DonationScreen from './src/screens/DonationScreen';
import AboutScreen from './src/screens/AboutScreen';
import ContactScreen from './src/screens/ContactScreen';
import PartnerDetailScreen from './src/screens/PartnerDetailScreen';
import MembershipCardScreen from './src/screens/MembershipCardScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="HomeMain" 
        component={HomeScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PartnerDetail" 
        component={PartnerDetailScreen}
        options={{ 
          title: 'Parceiro',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff'
        }}
      />
      <Stack.Screen 
        name="MembershipCard" 
        component={MembershipCardScreen}
        options={{ 
          title: 'Carteirinha',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff'
        }}
      />
      <Stack.Screen 
        name="QRScanner" 
        component={QRScannerScreen}
        options={{ 
          title: 'Escanear QR Code',
          headerStyle: { backgroundColor: '#4CAF50' },
          headerTintColor: '#fff'
        }}
      />
    </Stack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Adoção') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Voluntários') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Eventos') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Transparência') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'Doação') {
            iconName = focused ? 'card' : 'card-outline';
          } else if (route.name === 'Sobre') {
            iconName = focused ? 'information-circle' : 'information-circle-outline';
          } else if (route.name === 'Contato') {
            iconName = focused ? 'call' : 'call-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#4CAF50',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStack}
        options={{ title: 'Início' }}
      />
      <Tab.Screen 
        name="Adoção" 
        component={AdoptionScreen}
        options={{ title: 'Adoção' }}
      />
      <Tab.Screen 
        name="Voluntários" 
        component={VolunteersScreen}
        options={{ title: 'Voluntários' }}
      />
      <Tab.Screen 
        name="Eventos" 
        component={EventsScreen}
        options={{ title: 'Eventos' }}
      />
      <Tab.Screen 
        name="Transparência" 
        component={TransparencyScreen}
        options={{ title: 'Transparência' }}
      />
      <Tab.Screen 
        name="Doação" 
        component={DonationScreen}
        options={{ title: 'Doação' }}
      />
      <Tab.Screen 
        name="Sobre" 
        component={AboutScreen}
        options={{ title: 'Sobre' }}
      />
      <Tab.Screen 
        name="Contato" 
        component={ContactScreen}
        options={{ title: 'Contato' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        await Font.loadAsync({
          'Roboto': require('./assets/fonts/Roboto-Regular.ttf'),
          'Roboto-Bold': require('./assets/fonts/Roboto-Bold.ttf'),
        });
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <NavigationContainer>
      <MainTabNavigator />
      <StatusBar style="light" backgroundColor="#4CAF50" />
    </NavigationContainer>
  );
}
