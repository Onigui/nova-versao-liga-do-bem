import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '../services/AuthService';
import {API_BASE_PATH} from '../config/apiConfig';
import {logInfo, logError, logDebug} from '../services/RemoteLogger';

const STATUS_LABELS = {
  ACTIVE: 'ATIVO',
  INACTIVE: 'INATIVO',
  PENDING_PAYMENT: 'PENDENTE',
  SUSPENDED: 'SUSPENSO',
};

const STATUS_COLORS = {
  ACTIVE: '#10B981',
  INACTIVE: '#6B7280',
  PENDING_PAYMENT: '#F59E0B',
  SUSPENDED: '#EF4444',
};

export default function MembershipCardScreen({navigation}) {
  const {user, token, isAuthenticated} = useAuth();
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [iconConfig, setIconConfig] = useState({
    iconImage: null,
    icon: '🐾',
  });
  const [iconError, setIconError] = useState(false);
  const [localIcon, setLocalIcon] = useState(null);
  const [localIconEmoji, setLocalIconEmoji] = useState('🐾');

  useEffect(() => {
    try {
      const cfg = require('../assets/images/icon-config.json');
      setLocalIcon(require('../assets/images/app-icon.png'));
      setLocalIconEmoji(cfg?.icon || '🐾');
    } catch (e) {
      // assets opcionais
    }
  }, []);

  const loadIconConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_PATH}/app/config`, {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
        cache: 'no-store',
      });

      if (response.ok) {
        const config = await response.json();
        const loginIconImage = config['login.iconImage'];
        setIconConfig({
          iconImage:
            loginIconImage && loginIconImage.trim() !== ''
              ? loginIconImage
              : null,
          icon: config['login.icon'] || '🐾',
        });
        if (loginIconImage) setIconError(false);
      }
    } catch (error) {
      logError('❌ Erro ao carregar ícone do cartão', error);
    }
  }, []);

  const loadMembership = useCallback(async () => {
    try {
      setLoadError(null);
      const storedToken = token || (await AsyncStorage.getItem('auth_token'));
      if (!storedToken) {
        setMembership(null);
        setLoadError('Faça login para ver seu cartão de membro.');
        return;
      }

      try {
        const cached = await AsyncStorage.getItem('membership_cache');
        if (cached) {
          setMembership(JSON.parse(cached));
          setLoading(false);
        }
      } catch {
        // cache opcional
      }

      const response = await fetch(`${API_BASE_PATH}/user/membership`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${String(storedToken).replace(/^Bearer\s+/i, '').trim()}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data.error || 'Não foi possível carregar o cartão de membro';
        setLoadError(message);
        logInfo('Membership não carregada', {
          status: response.status,
          error: message,
        });
        return;
      }

      setMembership(data.membership || null);
      if (data.membership) {
        AsyncStorage.setItem(
          'membership_cache',
          JSON.stringify(data.membership),
        ).catch(() => {});
      }
      logInfo('✅ Membership carregada', {
        memberId: data.membership?.memberId,
        status: data.membership?.status,
      });
    } catch (error) {
      setLoadError('Falha de conexão ao carregar o cartão.');
      logInfo('Falha de conexão no cartão', {
        message: error?.message || String(error),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadIconConfig();
    if (isAuthenticated) {
      setLoading(true);
      loadMembership();
    } else {
      setLoading(false);
      setMembership(null);
    }
  }, [isAuthenticated, loadIconConfig, loadMembership]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMembership();
  };

  const formatDate = dateValue => {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR');
  };

  const statusKey = membership?.status || 'INACTIVE';
  const isActiveMember =
    membership?.isActiveMember === true ||
    (statusKey === 'ACTIVE' &&
      membership?.endDate &&
      new Date(membership.endDate).getTime() >= Date.now());
  const statusLabel = isActiveMember
    ? 'ATIVO'
    : STATUS_LABELS[statusKey] || statusKey;
  const statusColor = isActiveMember
    ? STATUS_COLORS.ACTIVE
    : STATUS_COLORS[statusKey] || '#6B7280';
  const qrValue =
    membership?.qrCode ||
    (membership?.memberId && user?.id
      ? `LIGADOBEM|${membership.memberId}|${user.id}`
      : null);

  const handleShareCard = async () => {
    if (!membership) return;
    try {
      await Share.share({
        message:
          `Cartão de Membro — Liga do Bem Botucatu\n` +
          `Nome: ${user?.name || 'Membro'}\n` +
          `ID: ${membership.memberId}\n` +
          `Status: ${statusLabel}\n` +
          `Válido até: ${formatDate(membership.endDate)}\n` +
          `Código: ${qrValue || membership.memberId}`,
      });
    } catch (error) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Erro', 'Não foi possível compartilhar o cartão');
      }
    }
  };

  const handleRenewMembership = () => {
    navigation.navigate('MembershipCheckout', {
      planCode: membership?.planCode || 'MONTHLY',
      cpf: user?.cpf || '',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Carregando cartão...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Ionicons
            name="card"
            size={64}
            color="#8B5CF6"
            style={styles.loginIcon}
          />
          <Text style={styles.loginTitle}>Acesse seu Cartão de Membro</Text>
          <Text style={styles.loginSubtitle}>
            Faça login pelo app para visualizar e usar seu cartão digital da Liga
            do Bem.
          </Text>
        </View>
      </View>
    );
  }

  if (!membership) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="card-outline" size={48} color="#9CA3AF" />
        <Text style={styles.loadingText}>
          {loadError || 'Cartão indisponível no momento'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadMembership}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <View style={styles.cardContainer}>
        <LinearGradient
          colors={['#8B5CF6', '#A855F7']}
          style={styles.card}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}>
          <View style={styles.cardHeader}>
            <View style={styles.logoContainer}>
              {localIcon ? (
                <Image
                  source={localIcon}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : iconConfig.iconImage && !iconError ? (
                <Image
                  source={{uri: iconConfig.iconImage}}
                  style={styles.logoImage}
                  resizeMode="contain"
                  onError={() => setIconError(true)}
                />
              ) : (
                <Text style={styles.logo}>
                  {localIconEmoji || iconConfig.icon}
                </Text>
              )}
            </View>
            <View style={styles.statusContainer}>
              <View
                style={[styles.statusDot, {backgroundColor: statusColor}]}
              />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>
              {user?.name || 'Membro Liga do Bem'}
            </Text>
            <Text style={styles.memberEmail}>
              {user?.email || 'membro@ligadobem.com'}
            </Text>
            <Text style={styles.memberId}>ID: {membership.memberId}</Text>
          </View>

          <View style={styles.qrContainer}>
            <View style={[styles.qrBackground, !isActiveMember && styles.qrInactive]}>
              {isActiveMember && qrValue ? (
                <QRCode
                  value={String(qrValue)}
                  size={140}
                  backgroundColor="#FFFFFF"
                  color="#1F2937"
                />
              ) : (
                <View style={styles.qrBlocked}>
                  <Ionicons name="lock-closed-outline" size={36} color="#9CA3AF" />
                  <Text style={styles.qrPlaceholder}>
                    QR liberado após pagamento da assinatura
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.qrLabel}>
              {isActiveMember
                ? `Apresente este QR Code nos parceiros · válido até ${formatDate(
                    membership.endDate,
                  )}`
                : 'Assine um plano para ativar o QR Code e os descontos'}
            </Text>
          </View>

          <View style={styles.validityContainer}>
            <Text style={styles.validityLabel}>
              {isActiveMember ? 'Válido até:' : 'Situação:'}
            </Text>
            <Text style={styles.validityDate}>
              {isActiveMember ? formatDate(membership.endDate) : statusLabel}
            </Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#8B5CF6" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Como usar seu cartão</Text>
            <Text style={styles.infoText}>
              Apresente o QR Code nos estabelecimentos parceiros para obter
              descontos exclusivos.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="storefront" size={24} color="#10B981" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Estabelecimentos parceiros</Text>
            <Text style={styles.infoText}>
              Acesse a aba "Parceiros" para ver todos os estabelecimentos que
              oferecem descontos.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="card" size={24} color="#F59E0B" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Como se tornar membro</Text>
            <Text style={styles.infoText}>
              O cartão só fica ativo depois que você escolhe um plano e paga a
              assinatura. Doações ajudam a causa, mas não ativam o QR Code nem
              os descontos dos parceiros.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleShareCard}>
          <Ionicons name="share-outline" size={20} color="#8B5CF6" />
          <Text style={styles.actionButtonText}>Compartilhar Cartão</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={handleRenewMembership}>
          <Ionicons name="card-outline" size={20} color="#6B7280" />
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            {membership?.status === 'ACTIVE' && isActiveMember
              ? 'Renovar assinatura'
              : 'Assinar / Pagar'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
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
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    shadowOffset: {width: 0, height: 4},
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
  },
  cardContainer: {
    padding: 20,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  logo: {
    fontSize: 28,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  memberInfo: {
    marginBottom: 24,
  },
  memberName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  memberId: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrBackground: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    minWidth: 172,
    minHeight: 172,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrInactive: {
    backgroundColor: '#F3F4F6',
  },
  qrBlocked: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  qrPlaceholder: {
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 12,
  },
  qrLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  validityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
  },
  validityLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  validityDate: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  actionsContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    gap: 8,
  },
  secondaryButton: {
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    color: '#8B5CF6',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6B7280',
  },
});
