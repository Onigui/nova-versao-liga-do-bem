import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Provider as PaperProvider } from 'react-native-paper';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import MembershipCardScreen from './src/screens/MembershipCardScreen';
import PartnersScreen from './src/screens/PartnersScreen';
import AdoptionsScreen from './src/screens/AdoptionsScreen';
import DonationScreen from './src/screens/DonationScreen';
import AboutScreen from './src/screens/AboutScreen';

// Services
import { AuthProvider } from './src/services/AuthService';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" backgroundColor="#ffffff" />
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
                } else if (route.name === 'Doação') {
                  iconName = focused ? 'heart' : 'heart-outline';
                } else if (route.name === 'Sobre') {
                  iconName = focused ? 'information-circle' : 'information-circle-outline';
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
              name="Doação" 
              component={DonationScreen} 
              options={{ title: 'Doar' }}
            />
            <Tab.Screen 
              name="Sobre" 
              component={AboutScreen} 
              options={{ title: 'Sobre Nós' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </PaperProvider>
  );
}