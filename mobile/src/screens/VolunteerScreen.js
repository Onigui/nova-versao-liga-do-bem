import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '../services/AuthService';
import {API_BASE_PATH} from '../config/apiConfig';

const ROLES = [
  'Cuidador de animais',
  'Eventos e feiras',
  'Transporte',
  'Divulgação / redes',
  'Apoio administrativo',
  'Outro',
];

export default function VolunteerScreen({navigation}) {
  const {isAuthenticated} = useAuth();
  const [stats, setStats] = useState({
    totalHours: 0,
    eventsAttended: 0,
    rank: 0,
    points: 0,
    level: 'Bronze',
    nextLevelPoints: 100,
    progress: 0,
  });
  const [events, setEvents] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [volunteerWork, setVolunteerWork] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRanking, setShowRanking] = useState(false);

  const loadVolunteerData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_PATH}/user/volunteer`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert('Erro', data.error || 'Não foi possível carregar o voluntariado');
        return;
      }

      setIsVolunteer(!!data.isVolunteer);
      setVolunteerWork(data.volunteerWork || null);
      setStats({
        totalHours: data.stats?.totalHours || 0,
        eventsAttended: data.stats?.eventsAttended || 0,
        rank: data.stats?.rank || 0,
        points: data.stats?.points || 0,
        level: data.stats?.level || 'Bronze',
        nextLevelPoints: data.stats?.nextLevelPoints || 0,
        progress: data.stats?.progress || 0,
      });
      setEvents(data.events || []);
      setRanking(data.ranking || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Falha de conexão ao carregar voluntariado');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      loadVolunteerData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, loadVolunteerData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadVolunteerData();
  };

  const handleRegister = async () => {
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_PATH}/volunteers/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: selectedRole,
          description: description.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert('Erro', data.error || 'Não foi possível concluir o cadastro');
        return;
      }
      setModalVisible(false);
      setDescription('');
      Alert.alert('Pronto!', data.message || 'Cadastro realizado com sucesso');
      loadVolunteerData();
    } catch (error) {
      Alert.alert('Erro', 'Falha de conexão ao cadastrar');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          style={styles.loginPromptContainer}>
          <Ionicons name="people" size={64} color="#FFFFFF" />
          <Text style={styles.loginPromptTitle}>Seja Voluntário!</Text>
          <Text style={styles.loginPromptText}>
            Faça login para acessar as oportunidades de voluntariado
          </Text>
        </LinearGradient>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <Text style={styles.headerTitle}>Meu Voluntariado</Text>
        {isVolunteer && volunteerWork?.role ? (
          <Text style={styles.headerRole}>{volunteerWork.role}</Text>
        ) : null}
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
            <Text style={styles.statValue}>
              {stats.rank > 0 ? `#${stats.rank}` : '—'}
            </Text>
            <Text style={styles.statLabel}>Ranking</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.points}</Text>
            <Text style={styles.statLabel}>Pontos</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={styles.levelBadge}>
              <Ionicons name="star" size={24} color="#F59E0B" />
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>Voluntário {stats.level}</Text>
              <Text style={styles.levelSubtitle}>
                {stats.nextLevelPoints > 0
                  ? `${stats.nextLevelPoints} pontos para o próximo nível`
                  : 'Você alcançou o nível máximo atual'}
              </Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {width: `${Math.min(Math.max(stats.progress, 0), 100)}%`},
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('EventsCalendar')}>
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.actionGradient}>
              <Ionicons name="calendar" size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.actionText}>Próximos Eventos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => {
              if (isVolunteer) {
                Alert.alert(
                  'Você já é voluntário',
                  `Área: ${volunteerWork?.role || 'Cadastrado'}`,
                );
              } else {
                setModalVisible(true);
              }
            }}>
            <LinearGradient
              colors={['#EC4899', '#DB2777']}
              style={styles.actionGradient}>
              <Ionicons name="person-add" size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.actionText}>
              {isVolunteer ? 'Já cadastrado' : 'Cadastrar-se'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setShowRanking(!showRanking)}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.actionGradient}>
              <Ionicons name="trophy" size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.actionText}>Ranking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() =>
              Alert.alert(
                'Recompensas',
                'Em breve você poderá trocar pontos por brindes. Continue participando dos eventos!',
              )
            }>
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.actionGradient}>
              <Ionicons name="gift" size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.actionText}>Recompensas</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showRanking ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ranking de Voluntários</Text>
          {ranking.length === 0 ? (
            <Text style={styles.emptyText}>
              Ainda não há voluntários no ranking.
            </Text>
          ) : (
            ranking.map(item => (
              <View key={item.userId} style={styles.rankRow}>
                <Text style={styles.rankPos}>#{item.position}</Text>
                <Text style={styles.rankName}>{item.name}</Text>
                <Text style={styles.rankPoints}>{item.points} pts</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meus Eventos</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>
            Você ainda não se inscreveu em eventos. Veja a agenda!
          </Text>
        ) : (
          events.map(event => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() =>
                navigation.navigate('EventDetail', {eventId: event.id, event})
              }>
              <View style={styles.eventLeft}>
                <View
                  style={[
                    styles.eventIconContainer,
                    event.status === 'completed'
                      ? {backgroundColor: '#D1FAE5'}
                      : {backgroundColor: '#DBEAFE'},
                  ]}>
                  <Ionicons
                    name={
                      event.status === 'completed'
                        ? 'checkmark-circle'
                        : 'calendar'
                    }
                    size={24}
                    color={
                      event.status === 'completed' ? '#10B981' : '#3B82F6'
                    }
                  />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={styles.eventMeta}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#6B7280"
                    />
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
          ))
        )}
      </View>

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

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cadastrar como voluntário</Text>
            <Text style={styles.modalSubtitle}>Escolha sua área de atuação</Text>

            {ROLES.map(role => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleOption,
                  selectedRole === role && styles.roleOptionActive,
                ]}
                onPress={() => setSelectedRole(role)}>
                <Text
                  style={[
                    styles.roleOptionText,
                    selectedRole === role && styles.roleOptionTextActive,
                  ]}>
                  {role}
                </Text>
              </TouchableOpacity>
            ))}

            <TextInput
              style={styles.descInput}
              placeholder="Conte um pouco sobre você (opcional)"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleRegister}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Confirmar cadastro</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
              disabled={submitting}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F9FAFB'},
  centered: {justifyContent: 'center', alignItems: 'center'},
  loadingText: {marginTop: 12, color: '#6B7280'},
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
    lineHeight: 24,
  },
  header: {padding: 24, paddingTop: 32},
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerRole: {
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsGrid: {flexDirection: 'row', justifyContent: 'space-between', gap: 8},
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {fontSize: 11, color: 'rgba(255,255,255,0.85)'},
  section: {padding: 20},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  levelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  levelHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  levelInfo: {flex: 1},
  levelTitle: {fontSize: 16, fontWeight: '700', color: '#1F2937'},
  levelSubtitle: {fontSize: 13, color: '#6B7280', marginTop: 2},
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {height: '100%', backgroundColor: '#8B5CF6'},
  actionsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  actionCard: {width: '47%', alignItems: 'center'},
  actionGradient: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  emptyText: {color: '#6B7280', fontSize: 14, marginBottom: 8},
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rankPos: {width: 40, fontWeight: '700', color: '#8B5CF6'},
  rankName: {flex: 1, color: '#1F2937', fontWeight: '500'},
  rankPoints: {color: '#6B7280', fontWeight: '600'},
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  eventLeft: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  eventIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {flex: 1},
  eventTitle: {fontSize: 15, fontWeight: '600', color: '#1F2937'},
  eventMeta: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  eventMetaText: {fontSize: 12, color: '#6B7280', marginRight: 8},
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  benefitText: {flex: 1, fontSize: 14, color: '#374151'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {fontSize: 20, fontWeight: '700', color: '#1F2937'},
  modalSubtitle: {fontSize: 14, color: '#6B7280', marginBottom: 16, marginTop: 4},
  roleOption: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  roleOptionActive: {borderColor: '#8B5CF6', backgroundColor: '#F5F3FF'},
  roleOptionText: {color: '#374151', fontWeight: '500'},
  roleOptionTextActive: {color: '#8B5CF6', fontWeight: '700'},
  descInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
    marginBottom: 16,
    color: '#1F2937',
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {color: '#FFFFFF', fontWeight: '600', fontSize: 16},
  cancelButton: {height: 44, justifyContent: 'center', alignItems: 'center'},
  cancelButtonText: {color: '#6B7280', fontWeight: '500'},
});
