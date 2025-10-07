import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthService';

export default function EventsCalendarScreen({ navigation }) {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [selectedMonth]);

  const loadEvents = async () => {
    try {
      // Dados mockados
      const mockEvents = [
        {
          id: '1',
          title: 'Feira de Adoção - Shopping Botucatu',
          date: '2025-10-15',
          time: '10:00 - 17:00',
          location: 'Shopping Botucatu',
          category: 'Adoção',
          vacancies: 50,
          registered: 23,
          image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
        },
        {
          id: '2',
          title: 'Mutirão de Castração',
          date: '2025-10-20',
          time: '08:00 - 16:00',
          location: 'Clínica Veterinária Central',
          category: 'Saúde',
          vacancies: 30,
          registered: 30,
          image: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=400',
        },
        {
          id: '3',
          title: 'Workshop: Adestramento Positivo',
          date: '2025-10-25',
          time: '14:00 - 17:00',
          location: 'Sede da Liga do Bem',
          category: 'Educação',
          vacancies: 20,
          registered: 12,
          image: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400',
        },
      ];
      
      setEvents(mockEvents);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getCategoryColor = (category) => {
    const colors = {
      'Adoção': '#8B5CF6',
      'Saúde': '#10B981',
      'Educação': '#F59E0B',
      'Voluntariado': '#3B82F6',
    };
    return colors[category] || '#6B7280';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <Ionicons name="calendar" size={48} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Calendário de Eventos</Text>
        <Text style={styles.headerSubtitle}>
          Participe e faça a diferença!
        </Text>
      </LinearGradient>

      {/* Month Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.monthSelector}
        contentContainerStyle={styles.monthSelectorContent}
      >
        {months.map((month, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.monthButton,
              selectedMonth === index && styles.monthButtonActive,
            ]}
            onPress={() => setSelectedMonth(index)}
          >
            <Text
              style={[
                styles.monthText,
                selectedMonth === index && styles.monthTextActive,
              ]}
            >
              {month}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Events List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.listTitle}>
          {months[selectedMonth]} {new Date().getFullYear()}
        </Text>

        {events.map((event) => {
          const vacanciesLeft = event.vacancies - event.registered;
          const isFull = vacanciesLeft === 0;
          
          return (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => navigation.navigate('EventDetail', { event })}
            >
              <View style={styles.eventDate}>
                <Text style={styles.eventDay}>
                  {new Date(event.date).getDate()}
                </Text>
                <Text style={styles.eventMonth}>
                  {months[new Date(event.date).getMonth()].substring(0, 3)}
                </Text>
              </View>

              <View style={styles.eventInfo}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: getCategoryColor(event.category) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryBadgeText,
                        { color: getCategoryColor(event.category) },
                      ]}
                    >
                      {event.category}
                    </Text>
                  </View>
                </View>

                <View style={styles.eventMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{event.time}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color="#6B7280" />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {event.location}
                    </Text>
                  </View>
                </View>

                <View style={styles.vacanciesRow}>
                  <View style={styles.vacanciesInfo}>
                    <Ionicons
                      name="people"
                      size={14}
                      color={isFull ? '#EF4444' : '#10B981'}
                    />
                    <Text
                      style={[
                        styles.vacanciesText,
                        { color: isFull ? '#EF4444' : '#10B981' },
                      ]}
                    >
                      {isFull ? 'Esgotado' : `${vacanciesLeft} vagas`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {events.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhum evento este mês</Text>
            <Text style={styles.emptyText}>
              Novos eventos serão publicados em breve!
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  monthSelector: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  monthSelectorContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  monthButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
  },
  monthButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  monthTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    padding: 20,
    paddingBottom: 12,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  eventDate: {
    width: 70,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  eventDay: {
    fontSize: 28,
    fontWeight: '700',
    color: '#8B5CF6',
    lineHeight: 32,
  },
  eventMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  eventInfo: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eventMeta: {
    gap: 6,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  vacanciesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  vacanciesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vacanciesText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

