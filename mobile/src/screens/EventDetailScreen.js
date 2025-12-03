import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_PATH } from '../config/apiConfig';

const {width} = Dimensions.get('window');

export default function EventDetailScreen({route, navigation}) {
  const {event} = route.params || {};
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [eventData, setEventData] = useState(event || {
    id: '1',
    title: 'Feira de Adoção - Shopping Botucatu',
    description: 'Venha conhecer nossos pets disponíveis para adoção! Teremos veterinários, atividades para crianças e muito mais.',
    date: '2025-10-15',
    time: '10:00 - 17:00',
    location: 'Shopping Botucatu - Praça de Alimentação',
    address: 'Av. Dom Lúcio, 1835 - Vila Assunção',
    category: 'Adoção',
    vacancies: 50,
    registered: 23,
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
  });

  // Verificar se usuário já está registrado ao carregar
  useEffect(() => {
    checkRegistrationStatus();
  }, [eventData.id]);

  const checkRegistrationStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token || !eventData.id) return;
      
      const response = await fetch(`${API_BASE_PATH}/events/${eventData.id}/registration`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsRegistered(data.isRegistered || false);
      }
    } catch (error) {
      console.log('Erro ao verificar registro:', error);
    }
  };

  const handleRegister = async () => {
    if (isLoading) return;
    
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      Alert.alert('Atenção', 'Você precisa estar logado para se inscrever em eventos.');
      return;
    }

    if (isRegistered) {
      Alert.alert(
        'Cancelar Inscrição',
        'Deseja cancelar sua inscrição neste evento?',
        [
          {text: 'Não', style: 'cancel'},
          {
            text: 'Sim, cancelar',
            style: 'destructive',
            onPress: async () => {
              await cancelRegistration(token);
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Confirmar Inscrição',
        `Deseja se inscrever no evento "${eventData.title}"?`,
        [
          {text: 'Cancelar', style: 'cancel'},
          {
            text: 'Confirmar',
            onPress: async () => {
              await registerForEvent(token);
            },
          },
        ],
      );
    }
  };

  const registerForEvent = async (token) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_PATH}/events/${eventData.id}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setIsRegistered(true);
        // Atualizar contagem de registrados
        setEventData(prev => ({
          ...prev,
          registered: (prev.registered || 0) + 1
        }));
        Alert.alert('Sucesso!', data.message || 'Você está inscrito! Nos vemos lá! 🎉');
      } else {
        Alert.alert('Erro', data.error || 'Erro ao se inscrever no evento');
      }
    } catch (error) {
      console.error('Erro ao registrar:', error);
      Alert.alert('Erro', 'Erro ao se inscrever no evento. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelRegistration = async (token) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_PATH}/events/${eventData.id}/register`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setIsRegistered(false);
        // Atualizar contagem de registrados
        setEventData(prev => ({
          ...prev,
          registered: Math.max(0, (prev.registered || 0) - 1)
        }));
        Alert.alert('Cancelado', data.message || 'Sua inscrição foi cancelada.');
      } else {
        Alert.alert('Erro', data.error || 'Erro ao cancelar inscrição');
      }
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      Alert.alert('Erro', 'Erro ao cancelar inscrição. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const openMaps = () => {
    const address = encodeURIComponent(eventData.address);
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${address}`,
    );
  };

  const vacanciesLeft = eventData.vacancies - eventData.registered;
  const vacanciesPercentage =
    (eventData.registered / eventData.vacancies) * 100;

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* Event Image */}
        <Image
          source={{uri: eventData.image}}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Ionicons name="calendar" size={14} color="#8B5CF6" />
            <Text style={styles.categoryText}>{eventData.category}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{eventData.title}</Text>

          {/* Date & Time Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Data</Text>
                <Text style={styles.infoValue}>
                  {new Date(eventData.date).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="time-outline" size={20} color="#8B5CF6" />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Horário</Text>
                <Text style={styles.infoValue}>{eventData.time}</Text>
              </View>
            </View>
          </View>

          {/* Location Card */}
          <TouchableOpacity style={styles.locationCard} onPress={openMaps}>
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.locationText}>
              <Text style={styles.locationName}>{eventData.location}</Text>
              <Text style={styles.locationAddress}>{eventData.address}</Text>
              <Text style={styles.locationAction}>
                <Ionicons name="navigate" size={12} color="#8B5CF6" /> Como
                chegar
              </Text>
            </View>
          </TouchableOpacity>

          {/* Vacancies */}
          <View style={styles.section}>
            <View style={styles.vacanciesHeader}>
              <Text style={styles.sectionTitle}>Vagas Disponíveis</Text>
              <Text style={styles.vacanciesCount}>
                {vacanciesLeft} de {eventData.vacancies}
              </Text>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {width: `${vacanciesPercentage}%`},
                ]}
              />
            </View>

            <Text style={styles.vacanciesText}>
              {eventData.registered} pessoas já se inscreveram
            </Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sobre o Evento</Text>
            <Text style={styles.description}>{eventData.description}</Text>
          </View>

          {/* What to Bring */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>O que levar</Text>
            <View style={styles.whatToBring}>
              <View style={styles.bringItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.bringText}>Documento com foto</Text>
              </View>
              <View style={styles.bringItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.bringText}>Comprovante de residência</Text>
              </View>
              <View style={styles.bringItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.bringText}>Muito amor e carinho 💜</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Register Button (Fixed) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}>
          <LinearGradient
            colors={
              isRegistered ? ['#EF4444', '#DC2626'] : ['#8B5CF6', '#7C3AED']
            }
            style={styles.registerButtonGradient}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}>
            <Ionicons
              name={isRegistered ? 'close-circle' : 'checkmark-circle'}
              size={20}
              color="#FFFFFF"
              style={{marginRight: 8}}
            />
            <Text style={styles.registerButtonText}>
              {isLoading 
                ? 'Processando...' 
                : isRegistered 
                  ? 'Cancelar Inscrição' 
                  : 'Confirmar Presença'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: width,
    height: 250,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 24,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
    lineHeight: 32,
  },
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    padding: 16,
    borderRadius: 12,
  },
  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationText: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  locationAction: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  vacanciesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vacanciesCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  vacanciesText: {
    fontSize: 13,
    color: '#6B7280',
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
  },
  whatToBring: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  bringItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  bringText: {
    fontSize: 14,
    color: '#6B7280',
  },
  scrollContent: {
    paddingBottom: 90, // Espaço para o botão fixo
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
    paddingBottom: 24, // Espaço extra para área segura
  },
  registerButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  registerButtonGradient: {
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
});
