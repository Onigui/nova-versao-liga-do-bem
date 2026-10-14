import React from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import {COLORS, PartnerProvider, usePartner} from './PartnerContext';
import {Button, Card, styles as ui} from './ui';
import PartnerLoginScreen from './screens/PartnerLoginScreen';
import ValidateScreen from './screens/ValidateScreen';
import ScannerScreen from './screens/ScannerScreen';
import ValidationResultScreen from './screens/ValidationResultScreen';
import DiscountsScreen from './screens/DiscountsScreen';
import DiscountFormScreen from './screens/DiscountFormScreen';
import HistoryScreen from './screens/HistoryScreen';
import CompanyScreen from './screens/CompanyScreen';
import CompanyEditScreen from './screens/CompanyEditScreen';
import DashboardScreen from './screens/DashboardScreen';
import VetProfileScreen from './screens/VetProfileScreen';
import PetVisitScreen from './screens/PetVisitScreen';
import StampFormScreen from './screens/StampFormScreen';
import PriceTableScreen from './screens/PriceTableScreen';
import PriceEditScreen from './screens/PriceEditScreen';
import StaffScreen from './screens/StaffScreen';
import PushCampaignsScreen from './screens/PushCampaignsScreen';
import PushPaymentScreen from './screens/PushPaymentScreen';
import QuotesInboxScreen from './screens/QuotesInboxScreen';
import QuoteRespondScreen from './screens/QuoteRespondScreen';
import ReservationsScreen from './screens/ReservationsScreen';
import VetQuoteScreen from './screens/VetQuoteScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const header = {
  headerStyle: {backgroundColor: COLORS.primary},
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {fontWeight: '800'},
};

export function PartnerAuthStack() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Login" component={PartnerLoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  ValidateTab: 'qr-code',
  DashboardTab: 'stats-chart',
  DiscountsTab: 'pricetags',
  HistoryTab: 'time',
  CompanyTab: 'storefront',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        ...header,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {fontSize: 12, fontWeight: '600'},
        tabBarIcon: ({color, size, focused}) => (
          <Icon
            name={TAB_ICONS[route.name] + (focused ? '' : '-outline')}
            size={size}
            color={color}
          />
        ),
      })}>
      <Tab.Screen
        name="ValidateTab"
        component={ValidateScreen}
        options={{title: 'Validar', headerTitle: 'Validar carteirinha'}}
      />
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{title: 'Painel', headerTitle: 'Painel da parceria'}}
      />
      <Tab.Screen
        name="DiscountsTab"
        component={DiscountsScreen}
        options={{title: 'Promoções'}}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{title: 'Histórico'}}
      />
      <Tab.Screen
        name="CompanyTab"
        component={CompanyScreen}
        options={{title: 'Empresa', headerTitle: 'Minha empresa'}}
      />
    </Tab.Navigator>
  );
}

/** Confere se o usuário logado tem acesso de parceiro antes de mostrar o app. */
function Gate() {
  const {loading, error, partner, logout, refresh} = usePartner();
  if (loading) {
    return (
      <View
        style={[ui.screen, {alignItems: 'center', justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (!partner) {
    const notPartner = error?.code === 'NOT_PARTNER';
    const inactive = error?.code === 'PARTNER_INACTIVE';
    return (
      <View style={[ui.screen, ui.content, {justifyContent: 'center'}]}>
        <Card>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: COLORS.text,
              marginBottom: 8,
            }}>
            {notPartner
              ? 'Este login não é de parceiro'
              : inactive
              ? 'Empresa desativada'
              : 'Não foi possível carregar'}
          </Text>
          <Text style={[ui.muted, {marginBottom: 16}]}>
            {notPartner
              ? 'Use o e-mail que a Liga do Bem cadastrou para a sua empresa. Se você é membro, use o app Liga do Bem.'
              : error?.message || 'Verifique sua internet.'}
          </Text>
          {!notPartner && !inactive ? (
            <Button
              title="Tentar de novo"
              onPress={refresh}
              style={{marginBottom: 10}}
            />
          ) : null}
          <Button title="Sair" variant="secondary" onPress={logout} />
        </Card>
      </View>
    );
  }
  return <Tabs />;
}

export function PartnerAppStack() {
  return (
    <PartnerProvider>
      <Stack.Navigator screenOptions={header}>
        <Stack.Screen
          name="Home"
          component={Gate}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ValidationResult"
          component={ValidationResultScreen}
          options={{title: 'Resultado'}}
        />
        <Stack.Screen
          name="DiscountForm"
          component={DiscountFormScreen}
          options={({route}) => ({
            title: route.params?.discount ? 'Editar promoção' : 'Nova promoção',
          })}
        />
        <Stack.Screen
          name="PriceTable"
          component={PriceTableScreen}
          options={{title: 'Tabela de preços'}}
        />
        <Stack.Screen
          name="PriceEdit"
          component={PriceEditScreen}
          options={({route}) => ({title: route.params?.newItem ? 'Novo item' : 'Preço'})}
        />
        <Stack.Screen
          name="VetProfile"
          component={VetProfileScreen}
          options={{title: 'Veterinário (CRMV)'}}
        />
        <Stack.Screen
          name="PetVisit"
          component={PetVisitScreen}
          options={{title: 'Carteira do pet'}}
        />
        <Stack.Screen
          name="StampForm"
          component={StampFormScreen}
          options={({route}) => ({title: route.params?.record ? 'Corrigir carimbo' : 'Carimbar'})}
        />
        <Stack.Screen
          name="CompanyEdit"
          component={CompanyEditScreen}
          options={{title: 'Dados da empresa'}}
        />
        <Stack.Screen
          name="Staff"
          component={StaffScreen}
          options={{title: 'Funcionários'}}
        />
        <Stack.Screen
          name="PushCampaigns"
          component={PushCampaignsScreen}
          options={{title: 'Notificar membros'}}
        />
        <Stack.Screen
          name="PushPayment"
          component={PushPaymentScreen}
          options={{title: 'Pagamento'}}
        />
        <Stack.Screen
          name="QuotesInbox"
          component={QuotesInboxScreen}
          options={{title: 'Orçamentos'}}
        />
        <Stack.Screen
          name="QuoteRespond"
          component={QuoteRespondScreen}
          options={{title: 'Pedido de orçamento'}}
        />
        <Stack.Screen
          name="Reservations"
          component={ReservationsScreen}
          options={{title: 'Reservas'}}
        />
        <Stack.Screen
          name="VetQuote"
          component={VetQuoteScreen}
          options={{title: 'Lista para orçamento'}}
        />
      </Stack.Navigator>
    </PartnerProvider>
  );
}
