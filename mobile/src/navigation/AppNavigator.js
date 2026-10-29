import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {F} from '../theme/home';
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
import DeleteAccountScreen from '../screens/DeleteAccountScreen';
import ServicesScreen from '../screens/ServicesScreen';
import LostFoundScreen from '../screens/LostFoundScreen';
import LostFoundNewScreen from '../screens/LostFoundNewScreen';
import LostFoundDetailScreen from '../screens/LostFoundDetailScreen';
import LostFoundAlertsScreen from '../screens/LostFoundAlertsScreen';
import LostFoundMineScreen from '../screens/LostFoundMineScreen';
import LostFoundSightingScreen from '../screens/LostFoundSightingScreen';
import LostFoundCommentsScreen from '../screens/LostFoundCommentsScreen';

// Topo das telas com cabeçalho do navegador: roxo profundo do Início, título branco em Plus Jakarta Sans
const HEADER = {
  headerStyle: {backgroundColor: '#3B1A78', elevation: 0, shadowOpacity: 0, borderBottomWidth: 0},
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {fontSize: 17, ...F.bold},
  headerBackTitleVisible: false,
};

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
          headerShown: true, ...HEADER,
          title: 'Termos e Privacidade',
        }}
      />
    </Stack.Navigator>
  );
}

// Botão central da barra (Cartão), elevado como nos apps de banco
function CardTabButton({onPress, accessibilityState}) {
  const focused = !!accessibilityState?.selected;
  return (
    <TouchableOpacity onPress={onPress} style={tabStyles.centerWrap} accessibilityRole="button" accessibilityLabel="Cartão" testID="aba-cartao">
      <View style={[tabStyles.center, focused && {backgroundColor: '#4C1D95'}]}>
        <Icon name="qr-code" size={26} color="#FFFFFF" />
      </View>
      <Text style={[tabStyles.centerLabel, F.bold]}>Cartão</Text>
    </TouchableOpacity>
  );
}

const TAB_ICONS = {Home: 'home', Parceiros: 'storefront', Pets: 'paw', Perfil: 'person'};

// Tabs Principais: Início · Parceiros · Cartão (centro) · Pets · Perfil
export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <Icon name={`${TAB_ICONS[route.name] || 'ellipse'}${focused ? '' : '-outline'}`} size={size} color={color} />
        ),
        tabBarActiveTintColor: '#6D28D9',
        tabBarInactiveTintColor: '#6B6880',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#ECEAF3',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {fontSize: 12, ...F.semibold},
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Parceiros" component={PartnersScreen} options={{ title: 'Parceiros' }} />
      <Tab.Screen
        name="Cartão"
        component={MembershipCardScreen}
        options={{ title: 'Cartão', tabBarButton: props => <CardTabButton {...props} /> }}
      />
      <Tab.Screen name="Pets" component={PetsListScreen} options={{ title: 'Pets' }} initialParams={{ asTab: true }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  centerWrap: {flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6},
  center: {
    width: 58,
    height: 58,
    marginTop: -26,
    borderRadius: 20,
    backgroundColor: '#6D28D9',
    borderWidth: 4,
    borderColor: '#F6F5FB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  centerLabel: {fontSize: 12, color: '#6D28D9', marginTop: 2},
});

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
        name="Adoções"
        component={AdoptionsScreen}
        options={{headerShown: true, ...HEADER, title: 'Adoção',}}
      />
      <Stack.Screen name="Services" component={ServicesScreen} />
      <Stack.Screen 
        name="SearchPartner" 
        component={SearchPartnerScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Buscar Parceiro',
        }}
      />
      <Stack.Screen 
        name="PartnerDetail" 
        component={PartnerDetailScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Parceiro',
        }}
      />
      <Stack.Screen 
        name="AnimalDetail" 
        component={AnimalDetailScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Detalhes do Animal',
        }}
      />
      <Stack.Screen 
        name="EventDetail" 
        component={EventDetailScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Detalhes do Evento',
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Notificações',
        }}
      />
      <Stack.Screen 
        name="Donation" 
        component={DonationScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Fazer Doação',
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
          headerShown: true, ...HEADER,
          title: 'Sobre Nós',
        }}
      />
      <Stack.Screen 
        name="Volunteer" 
        component={VolunteerScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Voluntariado',
        }}
      />
      <Stack.Screen
        name="Legal"
        component={LegalScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Termos e Privacidade',
        }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Excluir minha conta',
        }}
      />
      <Stack.Screen 
        name="Transparency" 
        component={TransparencyScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Transparência',
        }}
      />
      <Stack.Screen 
        name="EventsCalendar" 
        component={EventsCalendarScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Eventos',
        }}
      />
      <Stack.Screen 
        name="Debug" 
        component={DebugScreen}
        options={{
          headerShown: true, ...HEADER,
          title: 'Debug & Logs',
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
        options={{headerShown: true, ...HEADER, title: 'Comparar preços',}}
      />
      <Stack.Screen
        name="PriceOffers"
        component={PriceOffersScreen}
        options={{headerShown: true, ...HEADER, title: 'Preços',}}
      />
      <Stack.Screen
        name="QuotesList"
        component={QuotesListScreen}
        options={{headerShown: true, ...HEADER, title: 'Meus orçamentos'}}
      />
      <Stack.Screen
        name="QuoteNew"
        component={QuoteNewScreen}
        options={{headerShown: true, ...HEADER, title: 'Novo orçamento'}}
      />
      <Stack.Screen
        name="QuoteDetail"
        component={QuoteDetailScreen}
        options={{headerShown: true, ...HEADER, title: 'Orçamento'}}
      />
      <Stack.Screen
        name="PetHealth"
        component={PetHealthScreen}
        options={{headerShown: true, ...HEADER, title: 'Histórico de saúde'}}
      />
      <Stack.Screen
        name="HealthEntryForm"
        component={HealthEntryFormScreen}
        options={({route}) => ({headerShown: true, ...HEADER, title: route.params?.entry ? 'Editar registro' : 'Registro de saúde'})}
      />
      <Stack.Screen
        name="ReviewForm"
        component={ReviewFormScreen}
        options={{headerShown: true, ...HEADER, title: 'Avaliar'}}
      />
      <Stack.Screen
        name="PartnerReviews"
        component={PartnerReviewsScreen}
        options={{headerShown: true, ...HEADER, title: 'Avaliações'}}
      />
      <Stack.Screen
        name="NotaFiscal"
        component={NotaFiscalScreen}
        options={{headerShown: true, ...HEADER, title: 'Nota Fiscal Paulista'}}
      />
      <Stack.Screen
        name="LostFound"
        component={LostFoundScreen}
        options={{headerShown: true, ...HEADER, title: 'Achados e perdidos'}}
      />
      <Stack.Screen
        name="LostFoundNew"
        component={LostFoundNewScreen}
        options={{headerShown: true, ...HEADER, title: 'Publicar aviso'}}
      />
      <Stack.Screen
        name="LostFoundDetail"
        component={LostFoundDetailScreen}
        options={{headerShown: true, ...HEADER, title: 'Aviso'}}
      />
      <Stack.Screen
        name="LostFoundSighting"
        component={LostFoundSightingScreen}
        options={{headerShown: true, ...HEADER, title: 'Vi este animal'}}
      />
      <Stack.Screen
        name="LostFoundComments"
        component={LostFoundCommentsScreen}
        options={{headerShown: true, ...HEADER, title: 'Conversa'}}
      />
      <Stack.Screen
        name="LostFoundAlerts"
        component={LostFoundAlertsScreen}
        options={{headerShown: true, ...HEADER, title: 'Alertas por perto'}}
      />
      <Stack.Screen
        name="LostFoundMine"
        component={LostFoundMineScreen}
        options={{headerShown: true, ...HEADER, title: 'Meus avisos'}}
      />
    </Stack.Navigator>
  );
}

