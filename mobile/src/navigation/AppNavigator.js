import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import MembershipCardScreen from '../screens/MembershipCardScreen';
import MembershipCheckoutScreen from '../screens/MembershipCheckoutScreen';
import PartnersScreen from '../screens/PartnersScreen';
import AdoptionsScreen from '../screens/AdoptionsScreen';
import DonationScreen from '../screens/DonationScreen';
import AboutScreen from '../screens/AboutScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import VolunteerScreen from '../screens/VolunteerScreen';
import TransparencyScreen from '../screens/TransparencyScreen';
import EventsCalendarScreen from '../screens/EventsCalendarScreen';
import LegalScreen from '../screens/LegalScreen';

// Detail Screens
import SearchPartnerScreen from '../screens/SearchPartnerScreen';
import AnimalDetailScreen from '../screens/AnimalDetailScreen';
import PartnerDetailScreen from '../screens/PartnerDetailScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import DebugScreen from '../screens/DebugScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MyDonationsScreen from '../screens/MyDonationsScreen';
import MyAdoptionsScreen from '../screens/MyAdoptionsScreen';
import MyEventsScreen from '../screens/MyEventsScreen';
import InfoScreen from '../screens/InfoScreen';
import PetsListScreen from '../screens/PetsListScreen';
import VaccinationCardScreen from '../screens/VaccinationCardScreen';
import AddPetScreen from '../screens/AddPetScreen';
import AddVaccinationScreen from '../screens/AddVaccinationScreen';
import PetQrScreen from '../screens/PetQrScreen';
import ComparePricesScreen from '../screens/ComparePricesScreen';
import PriceOffersScreen from '../screens/PriceOffersScreen';
import QuotesListScreen from '../screens/QuotesListScreen';
import QuoteNewScreen from '../screens/QuoteNewScreen';
import QuoteDetailScreen from '../screens/QuoteDetailScreen';
import PetHealthScreen from '../screens/PetHealthScreen';
import HealthEntryFormScreen from '../screens/HealthEntryFormScreen';
import ReviewFormScreen from '../screens/ReviewFormScreen';
import PartnerReviewsScreen from '../screens/PartnerReviewsScreen';
import NotaFiscalScreen from '../screens/NotaFiscalScreen';
import LostFoundScreen from '../screens/LostFoundScreen';
import LostFoundNewScreen from '../screens/LostFoundNewScreen';
import LostFoundDetailScreen from '../screens/LostFoundDetailScreen';
import LostFoundAlertsScreen from '../screens/LostFoundAlertsScreen';
import LostFoundMineScreen from '../screens/LostFoundMineScreen';

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
      <Stack.Screen
        name="Legal"
        component={LegalScreen}
        options={{
          headerShown: true,
          title: 'Termos e Privacidade',
          headerStyle: {backgroundColor: '#ffffff'},
          headerTintColor: '#8B5CF6',
        }}
      />
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

          return <Icon name={iconName} size={size} color={color} />;
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
        headerShown: false,
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
        options={{ title: 'Cartão' }}
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
        name="MembershipCheckout"
        component={MembershipCheckoutScreen}
        options={{
          headerShown: false,
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
      <Stack.Screen 
        name="Volunteer" 
        component={VolunteerScreen}
        options={{
          headerShown: true,
          title: 'Voluntariado',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen
        name="Legal"
        component={LegalScreen}
        options={{
          headerShown: true,
          title: 'Termos e Privacidade',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="Transparency" 
        component={TransparencyScreen}
        options={{
          headerShown: true,
          title: 'Transparência',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="EventsCalendar" 
        component={EventsCalendarScreen}
        options={{
          headerShown: true,
          title: 'Eventos',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#8B5CF6',
        }}
      />
      <Stack.Screen 
        name="Debug" 
        component={DebugScreen}
        options={{
          headerShown: true,
          title: 'Debug & Logs',
          headerStyle: {
            backgroundColor: '#8B5CF6',
          },
          headerTintColor: '#FFFFFF',
        }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MyDonations" 
        component={MyDonationsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MyAdoptions" 
        component={MyAdoptionsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MyEvents" 
        component={MyEventsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Info" 
        component={InfoScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="PetsList" 
        component={PetsListScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="VaccinationCard" 
        component={VaccinationCardScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="AddPet" 
        component={AddPetScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="EditPet" 
        component={AddPetScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="AddVaccination" 
        component={AddVaccinationScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PetQr"
        component={PetQrScreen}
        options={{headerShown: false, presentation: 'modal'}}
      />
      <Stack.Screen
        name="ComparePrices"
        component={ComparePricesScreen}
        options={{headerShown: true, title: 'Comparar preços', headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6'}}
      />
      <Stack.Screen
        name="PriceOffers"
        component={PriceOffersScreen}
        options={{headerShown: true, title: 'Preços', headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6'}}
      />
      <Stack.Screen
        name="QuotesList"
        component={QuotesListScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6', title: 'Meus orçamentos'}}
      />
      <Stack.Screen
        name="QuoteNew"
        component={QuoteNewScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6', title: 'Novo orçamento'}}
      />
      <Stack.Screen
        name="QuoteDetail"
        component={QuoteDetailScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6', title: 'Orçamento'}}
      />
      <Stack.Screen
        name="PetHealth"
        component={PetHealthScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6', title: 'Histórico de saúde'}}
      />
      <Stack.Screen
        name="HealthEntryForm"
        component={HealthEntryFormScreen}
        options={({route}) => ({headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6', title: route.params?.entry ? 'Editar registro' : 'Registro de saúde'})}
      />
      <Stack.Screen
        name="ReviewForm"
        component={ReviewFormScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6', title: 'Avaliar'}}
      />
      <Stack.Screen
        name="PartnerReviews"
        component={PartnerReviewsScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#8B5CF6', title: 'Avaliações'}}
      />
      <Stack.Screen
        name="NotaFiscal"
        component={NotaFiscalScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#059669', title: 'Nota Fiscal Paulista'}}
      />
      <Stack.Screen
        name="LostFound"
        component={LostFoundScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#7C3AED', title: 'Achados e perdidos'}}
      />
      <Stack.Screen
        name="LostFoundNew"
        component={LostFoundNewScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#7C3AED', title: 'Publicar aviso'}}
      />
      <Stack.Screen
        name="LostFoundDetail"
        component={LostFoundDetailScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#7C3AED', title: 'Aviso'}}
      />
      <Stack.Screen
        name="LostFoundAlerts"
        component={LostFoundAlertsScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#7C3AED', title: 'Alertas por perto'}}
      />
      <Stack.Screen
        name="LostFoundMine"
        component={LostFoundMineScreen}
        options={{headerShown: true, headerStyle: {backgroundColor: '#ffffff'}, headerTintColor: '#7C3AED', title: 'Meus avisos'}}
      />
    </Stack.Navigator>
  );
}

