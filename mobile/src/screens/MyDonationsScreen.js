import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MyDonationsScreen({navigation}) {
  const {user} = useAuth();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadDonations();
  }, []);

  const loadDonations = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_PATH}/user/donations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDonations(data.donations || []);
        setTotal(data.total || 0);
      } else {
        console.error('Erro ao carregar doações:', response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar doações:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDonations();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED':
        return '#10B981';
      case 'PENDING':
        return '#F59E0B';
      case 'REJECTED':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'Aprovada';
      case 'PENDING':
        return 'Pendente';
      case 'REJECTED':
        return 'Rejeitada';
      default:
        return status;
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'PIX':
        return 'flash';
      case 'CREDIT_CARD':
        return 'card';
      case 'BANK_TRANSFER':
        return 'swap-horizontal';
      case 'CASH':
        return 'cash';
      default:
        return 'wallet';
    }
  };

  const getMethodLabel = (method) => {
    switch (method) {
      case 'PIX':
        return 'PIX';
      case 'CREDIT_CARD':
        return 'Cartão de Crédito';
      case 'BANK_TRANSFER':
        return 'Transferência Bancária';
      case 'CASH':
        return 'Dinheiro';
      default:
        return method;
    }
  };

  const calculateTotal = () => {
    return donations
      .filter(d => d.status === 'APPROVED')
      .reduce((sum, d) => sum + parseFloat(d.amount.toString()), 0);
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
          <Text style={styles.headerTitle}>Minhas Doações</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Carregando doações...</Text>
        </View>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Minhas Doações</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total de Doações</Text>
            <Text style={styles.summaryValue}>{donations.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Valor Total</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(calculateTotal())}
            </Text>
          </View>
        </View>

        {/* Donations List */}
        {donations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhuma doação encontrada</Text>
            <Text style={styles.emptySubtitle}>
              Suas doações aparecerão aqui quando você fizer uma contribuição
            </Text>
            <TouchableOpacity
              style={styles.donateButton}
              onPress={() => navigation.navigate('Donation')}>
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.donateButtonGradient}>
                <Ionicons name="heart" size={20} color="#FFFFFF" />
                <Text style={styles.donateButtonText}>Fazer uma Doação</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.donationsList}>
            {donations.map((donation) => (
              <View key={donation.id} style={styles.donationCard}>
                <View style={styles.donationHeader}>
                  <View style={styles.donationIconContainer}>
                    <Ionicons
                      name={getMethodIcon(donation.method)}
                      size={24}
                      color="#8B5CF6"
                    />
                  </View>
                  <View style={styles.donationInfo}>
                    <Text style={styles.donationAmount}>
                      {formatCurrency(parseFloat(donation.amount.toString()))}
                    </Text>
                    <Text style={styles.donationMethod}>
                      {getMethodLabel(donation.method)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {backgroundColor: getStatusColor(donation.status) + '20'},
                    ]}>
                    <Text
                      style={[
                        styles.statusText,
                        {color: getStatusColor(donation.status)},
                      ]}>
                      {getStatusLabel(donation.status)}
                    </Text>
                  </View>
                </View>

                {donation.description && (
                  <Text style={styles.donationDescription}>
                    {donation.description}
                  </Text>
                )}

                <View style={styles.donationFooter}>
                  <View style={styles.donationDate}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.donationDateText}>
                      {formatDate(donation.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
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
    marginHorizontal: 20,
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
  donateButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  donateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  donateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  donationsList: {
    gap: 12,
  },
  donationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  donationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  donationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  donationInfo: {
    flex: 1,
  },
  donationAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  donationMethod: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  donationDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  donationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  donationDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  donationDateText: {
    fontSize: 12,
    color: '#6B7280',
  },
});

