import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MyEventsScreen({navigation}) {
  const {user} = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_PATH}/user/events`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setTotal(data.total || 0);
      } else {
        console.error('Erro ao carregar eventos:', response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatDateShort = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(date);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return '#10B981';
      case 'REGISTERED':
        return '#3B82F6';
      case 'CANCELLED':
        return '#EF4444';
      case 'NO_SHOW':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return 'Confirmado';
      case 'REGISTERED':
        return 'Inscrito';
      case 'CANCELLED':
        return 'Cancelado';
      case 'NO_SHOW':
        return 'Não Compareceu';
      default:
        return status;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return 'checkmark-circle';
      case 'REGISTERED':
        return 'calendar';
      case 'CANCELLED':
        return 'close-circle';
      case 'NO_SHOW':
        return 'ban';
      default:
        return 'help-circle';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'ADOPTION_FAIR':
        return 'Feira de Adoção';
      case 'FUNDRAISING':
        return 'Arrecadação';
      case 'VOLUNTEER_MEETING':
        return 'Reunião de Voluntários';
      case 'MEDICAL_CAMPAIGN':
        return 'Campanha Médica';
      case 'EDUCATION':
        return 'Educação';
      case 'OTHER':
        return 'Outro';
      default:
        return type;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'ADOPTION_FAIR':
        return 'paw';
      case 'FUNDRAISING':
        return 'cash';
      case 'VOLUNTEER_MEETING':
        return 'people';
      case 'MEDICAL_CAMPAIGN':
        return 'medical';
      case 'EDUCATION':
        return 'school';
      default:
        return 'calendar';
    }
  };

  const isEventPast = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  const isEventUpcoming = (startDate) => {
    if (!startDate) return false;
    return new Date(startDate) > new Date();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meus Eventos</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Carregando eventos...</Text>
        </View>
      </View>
    );
  }

  const confirmedEvents = events.filter(e => e.status === 'CONFIRMED').length;
  const upcomingEvents = events.filter(e => isEventUpcoming(e.event?.startDate)).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Eventos</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total de Inscrições</Text>
            <Text style={styles.summaryValue}>{events.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Confirmados</Text>
            <Text style={styles.summaryValue}>{confirmedEvents}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Próximos</Text>
            <Text style={styles.summaryValue}>{upcomingEvents}</Text>
          </View>
        </View>

        {/* Events List */}
        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhum evento encontrado</Text>
            <Text style={styles.emptySubtitle}>
              Suas inscrições em eventos aparecerão aqui
            </Text>
            <TouchableOpacity
              style={styles.eventsButton}
              onPress={() => navigation.navigate('EventsCalendar')}>
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.eventsButtonGradient}>
                <Ionicons name="calendar" size={20} color="#FFFFFF" />
                <Text style={styles.eventsButtonText}>Ver Eventos Disponíveis</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {events.map((registration) => {
              const event = registration.event;
              if (!event) return null;

              const isPast = isEventPast(event.endDate || event.startDate);
              const isUpcoming = isEventUpcoming(event.startDate);

              return (
                <TouchableOpacity
                  key={registration.id}
                  style={styles.eventCard}
                  onPress={() => {
                    navigation.navigate('EventDetail', {
                      eventId: event.id,
                      event: {
                        id: event.id,
                        title: event.title,
                        description: event.description,
                        date: event.startDate,
                        location: event.location,
                        address: event.address,
                        image: event.image,
                        category: event.type,
                      },
                    });
                  }}>
                  {/* Event Image */}
                  {event.image ? (
                    <Image
                      source={{uri: event.image}}
                      style={styles.eventImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.eventImagePlaceholder}>
                      <Ionicons
                        name={getTypeIcon(event.type)}
                        size={48}
                        color="#8B5CF6"
                      />
                    </View>
                  )}

                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <View style={styles.eventType}>
                          <Ionicons
                            name={getTypeIcon(event.type)}
                            size={14}
                            color="#6B7280"
                          />
                          <Text style={styles.eventTypeText}>
                            {getTypeLabel(event.type)}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {backgroundColor: getStatusColor(registration.status) + '20'},
                        ]}>
                        <Ionicons
                          name={getStatusIcon(registration.status)}
                          size={16}
                          color={getStatusColor(registration.status)}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            {color: getStatusColor(registration.status)},
                          ]}>
                          {getStatusLabel(registration.status)}
                        </Text>
                      </View>
                    </View>

                    {event.description && (
                      <Text style={styles.eventDescription} numberOfLines={2}>
                        {event.description}
                      </Text>
                    )}

                    <View style={styles.eventFooter}>
                      <View style={styles.eventDate}>
                        <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                        <Text style={styles.eventDateText}>
                          {formatDate(event.startDate)}
                        </Text>
                      </View>
                      {event.location && (
                        <View style={styles.eventLocation}>
                          <Ionicons name="location-outline" size={14} color="#6B7280" />
                          <Text style={styles.eventLocationText} numberOfLines={1}>
                            {event.location}
                          </Text>
                        </View>
                      )}
                    </View>

                    {isUpcoming && (
                      <View style={styles.upcomingBadge}>
                        <Ionicons name="time-outline" size={12} color="#3B82F6" />
                        <Text style={styles.upcomingText}>Próximo Evento</Text>
                      </View>
                    )}
                    {isPast && (
                      <View style={styles.pastBadge}>
                        <Ionicons name="checkmark-circle-outline" size={12} color="#10B981" />
                        <Text style={styles.pastText}>Evento Realizado</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  content: {
    padding: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  eventsButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  eventsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  eventsList: {
    gap: 16,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  eventImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#F3F4F6',
  },
  eventImagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  eventType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTypeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  eventFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  eventDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventDateText: {
    fontSize: 12,
    color: '#6B7280',
  },
  eventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventLocationText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  upcomingText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
  },
  pastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  pastText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
});

