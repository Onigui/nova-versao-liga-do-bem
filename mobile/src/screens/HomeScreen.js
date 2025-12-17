import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import { API_BASE_PATH } from '../config/apiConfig';
import { APP_CONFIG } from '../config/appConfig';
import {logInfo, logError, logDebug} from '../services/RemoteLogger';

// Importar RemoteLogger para compatibilidade
const RemoteLogger = { log: logInfo, error: logError, debug: logDebug };

const API_BASE_URL = API_BASE_PATH.replace('/api', ''); // Remover /api duplicado

export default function HomeScreen({navigation}) {
  const {user, isAuthenticated} = useAuth();
  const [stats, setStats] = useState({
    totalAnimals: 0,
    totalAdoptions: 0,
    totalDonations: 0,
    totalPartners: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logoError, setLogoError] = useState(false);
  
  // Tentar carregar asset local do logo ANTES de definir o estado
  let logoLocalAsset = null;
  try {
    logoLocalAsset = require('../assets/images/app-logo.png');
    logInfo('✅ Logo local encontrado');
  } catch (error) {
    logDebug('ℹ️ Logo local não encontrado, usando API');
  }
  
  const [appConfig, setAppConfig] = useState({
    logoUrl: null,
    logoLocal: logoLocalAsset, // Definir logo local no estado inicial
    appName: APP_CONFIG.appName,
    appSubtitle: APP_CONFIG.appSubtitle,
  });

  // Função para traduzir o role do usuário
  const translateRole = (role) => {
    const roleTranslations = {
      'MEMBER': 'Membro',
      'ADMIN': 'Administrador',
      'VOLUNTEER': 'Voluntário',
      'PARTNER': 'Parceiro',
    };
    return roleTranslations[role] || role;
  };

  // Carregar configurações do app da API
  const loadAppConfig = async () => {
    try {
      logInfo('🔄 Carregando configurações do app', {url: `${API_BASE_PATH}/app/config`});
      const response = await fetch(`${API_BASE_PATH}/app/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Forçar buscar sempre da API
      });
      
      logDebug('📡 Resposta do servidor', {status: response.status, statusText: response.statusText});
      
      if (response.ok) {
        const config = await response.json();
        logInfo('✅ Configurações recebidas', config);
        
        const logoUrlValue = config['app.logoUrl'];
        const newConfig = {
          logoUrl: (logoUrlValue && logoUrlValue.trim() !== '') ? logoUrlValue : null,
          logoLocal: appConfig.logoLocal, // Preservar logo local
          appName: config['app.name'] || APP_CONFIG.appName,
          appSubtitle: config['app.subtitle'] || APP_CONFIG.appSubtitle,
        };
        
        logInfo('📝 Configurações aplicadas', newConfig);
        logDebug('🖼️ Logo Local', {hasLogoLocal: !!newConfig.logoLocal});
        logDebug('🖼️ Logo URL', {hasLogo: !!newConfig.logoUrl, logoUrl: newConfig.logoUrl});
        setAppConfig(newConfig);
        // Resetar erro de logo quando novas configurações são carregadas
        if (newConfig.logoUrl) {
          setLogoError(false);
        }
      } else {
        const errorText = await response.text();
        logError('❌ Erro ao carregar configurações', {status: response.status, error: errorText});
      }
    } catch (error) {
      logError('❌ Erro ao carregar configurações do app', error);
      // Usar configurações padrão em caso de erro
    }
  };

  useEffect(() => {
    loadStats();
    loadAppConfig();
  }, []);

  const loadStats = async () => {
    try {
      logInfo('🔄 Carregando estatísticas', {url: `${API_BASE_PATH}/stats`});
      const response = await fetch(`${API_BASE_PATH}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      logDebug('📡 Resposta do servidor (stats)', {status: response.status, statusText: response.statusText});
      
      if (response.ok) {
        const data = await response.json();
        logInfo('✅ Estatísticas recebidas', data);
        
        // Garantir que todos os valores sejam números válidos
        const newStats = {
          totalAnimals: Number(data.stats?.totalAnimals) || 0,
          totalAdoptions: Number(data.stats?.totalAdoptions) || 0,
          totalDonations: Number(data.stats?.totalDonations) || 0,
          totalPartners: Number(data.stats?.totalPartners) || 0,
        };
        
        logInfo('📝 Estatísticas aplicadas', newStats);
        setStats(newStats);
      } else {
        const errorText = await response.text();
        logError('❌ Erro ao carregar estatísticas', {status: response.status, error: errorText});
        // Se a resposta não for OK, manter valores em 0
        setStats({
          totalAnimals: 0,
          totalAdoptions: 0,
          totalDonations: 0,
          totalPartners: 0,
        });
      }
    } catch (error) {
      logError('❌ Erro ao carregar estatísticas', error);
      // Em caso de erro, manter valores em 0
      setStats({
        totalAnimals: 0,
        totalAdoptions: 0,
        totalDonations: 0,
        totalPartners: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    await loadAppConfig();
    setRefreshing(false);
  };

  const StatCard = ({icon, title, value, color, onPress}) => (
    <TouchableOpacity
      style={[styles.statCard, {borderLeftColor: color}]}
      onPress={onPress}>
      <View style={styles.statContent}>
        <View style={[styles.statIcon, {backgroundColor: color}]}>
          <Ionicons name={icon} size={24} color="white" />
        </View>
        <View style={styles.statInfo}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const QuickAction = ({icon, title, subtitle, color, onPress}) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, {backgroundColor: color}]}>
        <Ionicons name={icon} size={28} color="white" />
      </View>
      <View style={styles.quickActionInfo}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#A855F7']}
        style={styles.header}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={styles.headerContent}>
          <View style={styles.logoContainer}>
            {appConfig.logoLocal ? (
              <Image
                source={appConfig.logoLocal}
                style={styles.logo}
                resizeMode="contain"
                onLoad={() => {
                  logInfo('✅ Logo local carregado com sucesso');
                }}
              />
            ) : appConfig.logoUrl && !logoError ? (
              <Image
                source={{ uri: appConfig.logoUrl }}
                style={styles.logo}
                resizeMode="contain"
                onError={(error) => {
                  logError('❌ Erro ao carregar logo da API', {error, url: appConfig.logoUrl});
                  setLogoError(true);
                }}
                onLoad={() => {
                  logInfo('✅ Logo carregado com sucesso', {url: appConfig.logoUrl});
                }}
              />
            ) : (
              // Fallback para texto se não houver logo configurado ou se houver erro
              <View>
                <Text style={styles.headerTitle}>{appConfig.appName}</Text>
                <Text style={styles.headerSubtitle}>{appConfig.appSubtitle}</Text>
              </View>
            )}
          </View>
          {isAuthenticated && user && (
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                Olá, {user.name ? user.name.split(' ')[0] : 'Usuário'}
              </Text>
              <Text style={styles.userRole}>{translateRole(user.role)}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Nossos Números</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="paw"
            title="Animais"
            value={stats.totalAnimals || 0}
            color="#10B981"
            onPress={() => navigation.navigate('Adoções')}
          />
          <StatCard
            icon="heart"
            title="Adoções"
            value={stats.totalAdoptions || 0}
            color="#F59E0B"
            onPress={() => navigation.navigate('Adoções')}
          />
          <StatCard
            icon="gift"
            title="Doações"
            value={`R$ ${(stats.totalDonations || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            color="#EF4444"
            onPress={() => navigation.navigate('Donation')}
          />
          <StatCard
            icon="storefront"
            title="Parceiros"
            value={stats.totalPartners || 0}
            color="#3B82F6"
            onPress={() => navigation.navigate('Parceiros')}
          />
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.quickActions}>
          <QuickAction
            icon="card"
            title="Cartão"
            subtitle="Acesse seu cartão de membro"
            color="#8B5CF6"
            onPress={() => navigation.navigate('Cartão')}
          />
          <QuickAction
            icon="storefront"
            title="Parceiros"
            subtitle="Encontre estabelecimentos parceiros"
            color="#10B981"
            onPress={() => navigation.navigate('Parceiros')}
          />
          <QuickAction
            icon="paw"
            title="Adoções"
            subtitle="Adote um amigo de quatro patas"
            color="#F59E0B"
            onPress={() => navigation.navigate('Adoções')}
          />
          <QuickAction
            icon="heart"
            title="Doar"
            subtitle="Ajude nossa causa"
            color="#EF4444"
            onPress={() => navigation.navigate('Donation')}
          />
          <QuickAction
            icon="people"
            title="Voluntariado"
            subtitle="Doe seu tempo e amor"
            color="#3B82F6"
            onPress={() => navigation.navigate('Volunteer')}
          />
          <QuickAction
            icon="calendar"
            title="Eventos"
            subtitle="Calendário de atividades"
            color="#EC4899"
            onPress={() => navigation.navigate('EventsCalendar')}
          />
          <QuickAction
            icon="pie-chart"
            title="Transparência"
            subtitle="Prestação de contas"
            color="#10B981"
            onPress={() => navigation.navigate('Transparency')}
          />
          <QuickAction
            icon="notifications"
            title="Notificações"
            subtitle="Mensagens e avisos"
            color="#F59E0B"
            onPress={() => navigation.navigate('Notifications')}
          />
          <QuickAction
            icon="information-circle"
            title="Informações"
            subtitle="Ajuda e contatos úteis"
            color="#6366F1"
            onPress={() => navigation.navigate('Info')}
          />
        </View>
      </View>

      {/* Mission */}
      <View style={styles.missionContainer}>
        <Text style={styles.sectionTitle}>Nossa Missão</Text>
        <View style={styles.missionCard}>
          <Text style={styles.missionText}>
            Promover o bem-estar animal através de adoções responsáveis,
            cuidados veterinários e conscientização da comunidade de Botucatu.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    height: 50,
    justifyContent: 'center',
  },
  logo: {
    height: 50,
    width: 200,
    maxWidth: '100%',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: -5,
  },
  userInfo: {
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  userRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '48%',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  quickActions: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionInfo: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  quickActionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  missionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  missionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  missionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
    textAlign: 'center',
  },
});
