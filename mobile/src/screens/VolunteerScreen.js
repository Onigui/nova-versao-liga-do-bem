import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthService';

export default function VolunteerScreen({ navigation }) {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    totalHours: 0,
    eventsAttended: 0,
    rank: 0,
    points: 0,
  });
  const [events, setEvents] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadVolunteerData();
    }
  }, [isAuthenticated]);

  const loadVolunteerData = async () => {
    try {
      // Dados mockados
      setStats({
        totalHours: 24,
        eventsAttended: 8,
        rank: 12,
        points: 240,
      });

      setEvents([
        {
          id: '1',
          title: 'Feira de Adoção - Shopping',
          date: '2025-10-15',
          hours: 4,
          status: 'upcoming',
        },
        {
          id: '2',
          title: 'Limpeza do Abrigo',
          date: '2025-10-08',
          hours: 3,
          status: 'completed',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadVolunteerData();
  };

  const handleBecomeVolunteer = () => {
    Alert.alert(
      'Seja Voluntário',
      'Preencha o formulário para se tornar um voluntário da Liga do Bem!',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Preencher Formulário',
          onPress: () => Alert.alert('Em desenvolvimento', 'Formulário em breve!'),
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          style={styles.loginPromptContainer}
        >
          <Ionicons name="people" size={64} color="#FFFFFF" />
          <Text style={styles.loginPromptTitle}>Seja Voluntário!</Text>
          <Text style={styles.loginPromptText}>
            Faça login para acessar as oportunidades de voluntariado
          </Text>
          <TouchableOpacity
            style={styles.loginPromptButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.loginPromptButtonText}>Fazer Login</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Stats */}
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Meu Voluntariado</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalHours}h</Text>
            <Text style={styles.statLabel}>Horas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.eventsAttended}</Text>
            <Text style={styles.statLabel}>Eventos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>#{stats.rank}</Text>
            <Text style={styles.statLabel}>Ranking</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.points}</Text>
            <Text style={styles.statLabel}>Pontos</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Level Progress */}
      <View style={styles.section}>
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={styles.levelBadge}>
              <Ionicons name="star" size={24} color="#F59E0B" />
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>Voluntário Bronze</Text>
              <Text style={styles.levelSubtitle}>60 pontos para o próximo nível</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '80%' }]} />
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('EventDetail')}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.actionGradient}
            >
              <Ionicons name="calendar" size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.actionText}>Próximos Eventos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleBecomeVolunteer}
          >
            <LinearGradient
              colors={['#EC4899', '#DB2777']}
              style={styles.actionGradient}
            >
              <Ionicons name="person-add" size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.actionText}>Cadastrar-se</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => Alert.alert('Em desenvolvimento', 'Em breve!')}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.actionGradient}
            >
              <Ionicons name="trophy" size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.actionText}>Ranking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => Alert.alert('Em desenvolvimento', 'Em breve!')}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.actionGradient}
            >
              <Ionicons name="gift" size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.actionText}>Recompensas</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* My Events */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meus Eventos</Text>
        {events.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.eventCard}
            onPress={() => navigation.navigate('EventDetail', { event })}
          >
            <View style={styles.eventLeft}>
              <View
                style={[
                  styles.eventIconContainer,
                  event.status === 'completed'
                    ? { backgroundColor: '#D1FAE5' }
                    : { backgroundColor: '#DBEAFE' },
                ]}
              >
                <Ionicons
                  name={event.status === 'completed' ? 'checkmark-circle' : 'calendar'}
                  size={24}
                  color={event.status === 'completed' ? '#10B981' : '#3B82F6'}
                />
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <View style={styles.eventMeta}>
                  <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                  <Text style={styles.eventMetaText}>
                    {new Date(event.date).toLocaleDateString('pt-BR')}
                  </Text>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.eventMetaText}>{event.hours}h</Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Benefits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Benefícios do Voluntário</Text>
        
        <View style={styles.benefitCard}>
          <Ionicons name="star" size={20} color="#F59E0B" />
          <Text style={styles.benefitText}>
            Ganhe pontos por cada hora de voluntariado
          </Text>
        </View>

        <View style={styles.benefitCard}>
          <Ionicons name="trophy" size={20} color="#10B981" />
          <Text style={styles.benefitText}>
            Suba no ranking e ganhe reconhecimento
          </Text>
        </View>

        <View style={styles.benefitCard}>
          <Ionicons name="gift" size={20} color="#EC4899" />
          <Text style={styles.benefitText}>
            Troque pontos por brindes exclusivos
          </Text>
        </View>

        <View style={styles.benefitCard}>
          <Ionicons name="heart" size={20} color="#8B5CF6" />
          <Text style={styles.benefitText}>
            Faça a diferença na vida dos animais
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
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loginPromptTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 12,
  },
  loginPromptText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  loginPromptButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  loginPromptButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 24,
    paddingTop: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  levelCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  levelSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    alignItems: 'center',
  },
  actionGradient: {
    width: '100%',
    height: 100,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  eventIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventMetaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
});

