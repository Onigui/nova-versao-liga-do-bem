import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthService';

const API_BASE_URL = 'https://liga-do-bem-backend.onrender.com/api';

export default function HomeScreen({ navigation }) {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    totalAnimals: 0,
    totalAdoptions: 0,
    totalDonations: 0,
    totalPartners: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      // Usar dados mockados em caso de erro
      setStats({
        totalAnimals: 45,
        totalAdoptions: 23,
        totalDonations: 1250,
        totalPartners: 12,
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const StatCard = ({ icon, title, value, color, onPress }) => (
    <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress}>
      <View style={styles.statContent}>
        <View style={[styles.statIcon, { backgroundColor: color }]}>
          <Ionicons name={icon} size={24} color="white" />
        </View>
        <View style={styles.statInfo}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const QuickAction = ({ icon, title, subtitle, color, onPress }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
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
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#A855F7']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Liga do Bem</Text>
            <Text style={styles.headerSubtitle}>Botucatu</Text>
          </View>
          {isAuthenticated && user && (
            <View style={styles.userInfo}>
              <Text style={styles.userName}>Olá, {user.name}</Text>
              <Text style={styles.userRole}>{user.role}</Text>
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
            value={stats.totalAnimals}
            color="#10B981"
            onPress={() => navigation.navigate('Adoções')}
          />
          <StatCard
            icon="heart"
            title="Adoções"
            value={stats.totalAdoptions}
            color="#F59E0B"
            onPress={() => navigation.navigate('Adoções')}
          />
          <StatCard
            icon="gift"
            title="Doações"
            value={`R$ ${stats.totalDonations}`}
            color="#EF4444"
            onPress={() => navigation.navigate('Doação')}
          />
          <StatCard
            icon="storefront"
            title="Parceiros"
            value={stats.totalPartners}
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
            title="Meu Cartão"
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
            onPress={() => navigation.navigate('Doação')}
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
    shadowOffset: { width: 0, height: 2 },
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
    shadowOffset: { width: 0, height: 2 },
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
    shadowOffset: { width: 0, height: 2 },
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
