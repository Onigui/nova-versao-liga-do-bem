import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import MembershipCardScreen from '../screens/MembershipCardScreen';
import PartnersScreen from '../screens/PartnersScreen';
import AdoptionsScreen from '../screens/AdoptionsScreen';
import DonationScreen from '../screens/DonationScreen';
import AboutScreen from '../screens/AboutScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

// Detail Screens
import SearchPartnerScreen from '../screens/SearchPartnerScreen';
import AnimalDetailScreen from '../screens/AnimalDetailScreen';
import PartnerDetailScreen from '../screens/PartnerDetailScreen';
import EventDetailScreen from '../screens/EventDetailScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Stack de Autenticação
export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

// Tabs Principais
export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Cartão') {
            iconName = focused ? 'card' : 'card-outline';
          } else if (route.name === 'Parceiros') {
            iconName = focused ? 'storefront' : 'storefront-outline';
          } else if (route.name === 'Adoções') {
            iconName = focused ? 'paw' : 'paw-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          borderBottomColor: '#E5E7EB',
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: '#1F2937',
        },
        headerTintColor: '#8B5CF6',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Início' }}
      />
      <Tab.Screen 
        name="Cartão" 
        component={MembershipCardScreen} 
        options={{ title: 'Meu Cartão' }}
      />
      <Tab.Screen 
        name="Parceiros" 
        component={PartnersScreen} 
        options={{ title: 'Parceiros' }}
      />
      <Tab.Screen 
        name="Adoções" 
        component={AdoptionsScreen} 
        options={{ title: 'Adoções' }}
      />
      <Tab.Screen 
        name="Perfil" 
        component={ProfileScreen} 
        options={{ title: 'Meu Perfil' }}
      />
    </Tab.Navigator>
  );
}

// Stack Principal com navegação para detalhes
export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen 
        name="SearchPartner" 
        component={SearchPartnerScreen}
        options={{
          headerShown: true,
          title: 'Buscar Parceiro',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="PartnerDetail" 
        component={PartnerDetailScreen}
        options={{
          headerShown: true,
          title: 'Parceiro',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="AnimalDetail" 
        component={AnimalDetailScreen}
        options={{
          headerShown: true,
          title: 'Detalhes do Animal',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="EventDetail" 
        component={EventDetailScreen}
        options={{
          headerShown: true,
          title: 'Detalhes do Evento',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          headerShown: true,
          title: 'Notificações',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="Donation" 
        component={DonationScreen}
        options={{
          headerShown: true,
          title: 'Fazer Doação',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="About" 
        component={AboutScreen}
        options={{
          headerShown: true,
          title: 'Sobre Nós',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
    </Stack.Navigator>
  );
}

