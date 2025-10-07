import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../services/AuthService';

export default function MembershipCardScreen() {
  const { user, isAuthenticated, login } = useAuth();
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadMembership();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadMembership = async () => {
    try {
      // Simular carregamento de dados da membership
      // Em produção, isso viria da API
      setMembership({
        memberId: 'MEM' + Date.now(),
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        qrCode: user ? `${user.id}_${Date.now()}` : 'demo_qr_code',
      });
    } catch (error) {
      console.error('Erro ao carregar membership:', error);
    } finally {
      setLoading(false);
    }
  };

  const LoginPrompt = () => (
    <View style={styles.loginContainer}>
      <View style={styles.loginCard}>
        <Ionicons name="card" size={64} color="#8B5CF6" style={styles.loginIcon} />
        <Text style={styles.loginTitle}>Acesse seu Cartão de Membro</Text>
        <Text style={styles.loginSubtitle}>
          Faça login para visualizar e usar seu cartão digital da Liga do Bem
        </Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => handleLogin()}>
          <Text style={styles.loginButtonText}>Fazer Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleLogin = () => {
    Alert.alert(
      'Login',
      'Para acessar seu cartão, você precisa fazer login. Esta funcionalidade será implementada em breve.',
      [{ text: 'OK' }]
    );
  };

  const MembershipCard = () => (
    <ScrollView style={styles.container}>
      <View style={styles.cardContainer}>
        <LinearGradient
          colors={['#8B5CF6', '#A855F7']}
          style={styles.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Header do Cartão */}
          <View style={styles.cardHeader}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>🐾</Text>
            </View>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.statusText}>ATIVO</Text>
            </View>
          </View>

          {/* Informações do Membro */}
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{user?.name || 'Membro Liga do Bem'}</Text>
            <Text style={styles.memberEmail}>{user?.email || 'membro@ligadobem.com'}</Text>
            <Text style={styles.memberId}>ID: {membership?.memberId}</Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrBackground}>
              <QRCode
                value={membership?.qrCode || 'demo_qr_code'}
                size={120}
                color="#1F2937"
                backgroundColor="white"
              />
            </View>
            <Text style={styles.qrLabel}>Apresente este QR Code nos estabelecimentos parceiros</Text>
          </View>

          {/* Validade */}
          <View style={styles.validityContainer}>
            <Text style={styles.validityLabel}>Válido até:</Text>
            <Text style={styles.validityDate}>
              {membership?.endDate ? membership.endDate.toLocaleDateString('pt-BR') : '31/12/2025'}
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* Informações Adicionais */}
      <View style={styles.infoContainer}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#8B5CF6" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Como usar seu cartão</Text>
            <Text style={styles.infoText}>
              Apresente o QR Code nos estabelecimentos parceiros para obter descontos exclusivos.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="storefront" size={24} color="#10B981" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Estabelecimentos parceiros</Text>
            <Text style={styles.infoText}>
              Acesse a aba "Parceiros" para ver todos os estabelecimentos que oferecem descontos.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="card" size={24} color="#F59E0B" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Renovação automática</Text>
            <Text style={styles.infoText}>
              Sua mensalidade é renovada automaticamente. Você receberá lembretes antes do vencimento.
            </Text>
          </View>
        </View>
      </View>

      {/* Ações */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleShareCard}>
          <Ionicons name="share-outline" size={20} color="#8B5CF6" />
          <Text style={styles.actionButtonText}>Compartilhar Cartão</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={handleRenewMembership}>
          <Ionicons name="refresh-outline" size={20} color="#6B7280" />
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Renovar Mensalidade</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const handleShareCard = () => {
    Alert.alert(
      'Compartilhar Cartão',
      'Funcionalidade de compartilhamento será implementada em breve.',
      [{ text: 'OK' }]
    );
  };

  const handleRenewMembership = () => {
    Alert.alert(
      'Renovar Mensalidade',
      'Você será redirecionado para a página de pagamento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => console.log('Ir para pagamento') }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return <MembershipCard />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  loginCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loginIcon: {
    marginBottom: 16,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cardContainer: {
    padding: 20,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    minHeight: 400,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberInfo: {
    marginBottom: 32,
  },
  memberName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  memberId: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrBackground: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  qrLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
  },
  validityContainer: {
    alignItems: 'center',
  },
  validityLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  validityDate: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButton: {
    backgroundColor: '#F9FAFB',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  secondaryButtonText: {
    color: '#6B7280',
  },
});
