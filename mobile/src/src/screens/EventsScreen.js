import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EventsScreen = () => {
  const [upcomingEvents] = useState([
    {
      id: 1,
      title: 'Feira de Adoção - Centro',
      date: '2024-02-15',
      time: '09:00 - 17:00',
      location: 'Praça da Matriz',
      description: 'Venha conhecer nossos animais resgatados e encontre seu novo melhor amigo!',
      image: 'https://via.placeholder.com/300x200/4CAF50/ffffff?text=Feira+Adoção',
      type: 'Adoção',
      status: 'upcoming',
      animalsAvailable: 15,
      volunteersNeeded: 8
    },
    {
      id: 2,
      title: 'Bazar Beneficente',
      date: '2024-02-20',
      time: '14:00 - 20:00',
      location: 'Sede da Liga do Bem',
      description: 'Venda de roupas, acessórios e produtos para arrecadar fundos para os animais.',
      image: 'https://via.placeholder.com/300x200/FF9800/ffffff?text=Bazar',
      type: 'Beneficente',
      status: 'upcoming',
      animalsAvailable: 0,
      volunteersNeeded: 5
    },
    {
      id: 3,
      title: 'Campanha de Vacinação',
      date: '2024-02-25',
      time: '08:00 - 16:00',
      location: 'Clínica Parceira',
      description: 'Vacinação gratuita para animais de famílias carentes.',
      image: 'https://via.placeholder.com/300x200/E91E63/ffffff?text=Vacinação',
      type: 'Saúde',
      status: 'upcoming',
      animalsAvailable: 0,
      volunteersNeeded: 3
    }
  ]);

  const [pastEvents] = useState([
    {
      id: 4,
      title: 'Feira de Adoção - Vila',
      date: '2024-01-20',
      time: '09:00 - 17:00',
      location: 'Praça da Vila',
      description: 'Feira realizada com sucesso! 12 animais foram adotados.',
      image: 'https://via.placeholder.com/300x200/2196F3/ffffff?text=Feira+Passada',
      type: 'Adoção',
      status: 'completed',
      animalsAdopted: 12,
      volunteersParticipated: 10
    }
  ]);

  const handleJoinEvent = (event) => {
    Alert.alert(
      'Participar do Evento',
      `Deseja se inscrever para participar do evento "${event.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: () => Alert.alert('Sucesso', 'Sua participação foi confirmada! Você receberá mais detalhes por email.') 
        }
      ]
    );
  };

  const handleShareEvent = (event) => {
    Alert.alert('Compartilhar', `Compartilhando evento: ${event.title}`);
  };

  const getEventTypeColor = (type) => {
    switch (type) {
      case 'Adoção': return '#4CAF50';
      case 'Beneficente': return '#FF9800';
      case 'Saúde': return '#E91E63';
      default: return '#2196F3';
    }
  };

  const renderEventCard = (event, isPast = false) => (
    <View key={event.id} style={styles.eventCard}>
      <Image source={{ uri: event.image }} style={styles.eventImage} />
      
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <View style={[styles.eventTypeBadge, { backgroundColor: getEventTypeColor(event.type) }]}>
            <Text style={styles.eventTypeText}>{event.type}</Text>
          </View>
          <TouchableOpacity onPress={() => handleShareEvent(event)}>
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventDescription}>{event.description}</Text>

        <View style={styles.eventDetails}>
          <View style={styles.eventDetailItem}>
            <Ionicons name="calendar" size={16} color="#666" />
            <Text style={styles.eventDetailText}>
              {new Date(event.date).toLocaleDateString('pt-BR')} • {event.time}
            </Text>
          </View>
          <View style={styles.eventDetailItem}>
            <Ionicons name="location" size={16} color="#666" />
            <Text style={styles.eventDetailText}>{event.location}</Text>
          </View>
        </View>

        {isPast ? (
          <View style={styles.eventStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{event.animalsAdopted}</Text>
              <Text style={styles.statLabel}>Animais Adotados</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{event.volunteersParticipated}</Text>
              <Text style={styles.statLabel}>Voluntários</Text>
            </View>
          </View>
        ) : (
          <View style={styles.eventActions}>
            <View style={styles.eventInfo}>
              <View style={styles.infoItem}>
                <Ionicons name="paw" size={16} color="#4CAF50" />
                <Text style={styles.infoText}>{event.animalsAvailable} animais</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="people" size={16} color="#FF9800" />
                <Text style={styles.infoText}>{event.volunteersNeeded} voluntários</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => handleJoinEvent(event)}
            >
              <Text style={styles.joinButtonText}>Participar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Eventos</Text>
          <Text style={styles.headerSubtitle}>
            Fique por dentro dos nossos bazares, feiras de adoção, campanhas e outras ações que ajudam a salvar vidas. 
            Sua participação faz a diferença!
          </Text>
        </View>

        {/* Próximos Eventos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Próximos Eventos</Text>
            <View style={styles.upcomingBadge}>
              <Text style={styles.upcomingBadgeText}>{upcomingEvents.length}</Text>
            </View>
          </View>
          
          <View style={styles.eventsList}>
            {upcomingEvents.map(event => renderEventCard(event))}
          </View>
        </View>

        {/* Eventos Passados */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Eventos Realizados</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.eventsList}>
            {pastEvents.map(event => renderEventCard(event, true))}
          </View>
        </View>

        {/* Estatísticas Gerais */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Nosso Impacto</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="paw" size={32} color="#4CAF50" />
              <Text style={styles.statNumber}>500+</Text>
              <Text style={styles.statLabel}>Animais Resgatados</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="heart" size={32} color="#E91E63" />
              <Text style={styles.statNumber}>350+</Text>
              <Text style={styles.statLabel}>Adoções Realizadas</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="people" size={32} color="#2196F3" />
              <Text style={styles.statNumber}>50+</Text>
              <Text style={styles.statLabel}>Eventos Realizados</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="calendar" size={32} color="#FF9800" />
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Anos de Atuação</Text>
            </View>
          </View>
        </View>

        {/* Como Ajudar */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpTitle}>Como Você Pode Ajudar</Text>
          <View style={styles.helpOptions}>
            <View style={styles.helpOption}>
              <Ionicons name="calendar" size={24} color="#4CAF50" />
              <Text style={styles.helpOptionTitle}>Participar de Eventos</Text>
              <Text style={styles.helpOptionText}>
                Junte-se aos nossos eventos e ajude a divulgar nossa causa
              </Text>
            </View>
            <View style={styles.helpOption}>
              <Ionicons name="share" size={24} color="#4CAF50" />
              <Text style={styles.helpOptionTitle}>Compartilhar</Text>
              <Text style={styles.helpOptionText}>
                Compartilhe nossos eventos nas redes sociais
              </Text>
            </View>
            <View style={styles.helpOption}>
              <Ionicons name="people" size={24} color="#4CAF50" />
              <Text style={styles.helpOptionTitle}>Ser Voluntário</Text>
              <Text style={styles.helpOptionText}>
                Torne-se um voluntário e participe da organização
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  upcomingBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  upcomingBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  eventsList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventTypeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  eventDetails: {
    gap: 8,
    marginBottom: 16,
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  eventStats: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statsContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  helpContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  helpOptions: {
    gap: 16,
  },
  helpOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  helpOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    marginLeft: 12,
  },
  helpOptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
});

export default EventsScreen;
