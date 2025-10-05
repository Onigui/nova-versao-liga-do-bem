import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';

const MembershipCardScreen = ({ navigation }) => {
  const [showQRCode, setShowQRCode] = useState(false);
  
  const memberData = {
    name: 'João Silva',
    memberId: 'LDB2024001',
    memberSince: '2023-06-15',
    status: 'Ativo',
    nextPayment: '2024-02-15',
    qrData: 'LDB2024001_JoaoSilva_2023-06-15_Ativo',
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Sou membro da Liga do Bem Botucatu!\nID: ${memberData.memberId}\n\nApoie nossa causa e ajude animais resgatados.`,
        title: 'Liga do Bem - Carteirinha Digital',
      });
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  };

  const toggleQRCode = () => {
    setShowQRCode(!showQRCode);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Carteirinha Digital */}
        <View style={styles.cardContainer}>
          <LinearGradient
            colors={['#4CAF50', '#45a049']}
            style={styles.card}
          >
            {/* Header da carteirinha */}
            <View style={styles.cardHeader}>
              <View style={styles.logoContainer}>
                <Text style={styles.logoText}>LIGA</Text>
                <Text style={[styles.logoText, styles.logoAccent]}>DO</Text>
                <Text style={[styles.logoText, styles.logoAccent2]}>BEM</Text>
              </View>
              <View style={styles.statusContainer}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>ATIVO</Text>
                </View>
              </View>
            </View>

            {/* Informações do membro */}
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{memberData.name}</Text>
              <Text style={styles.memberId}>ID: {memberData.memberId}</Text>
              <Text style={styles.memberSince}>
                Membro desde: {memberData.memberSince}
              </Text>
            </View>

            {/* QR Code */}
            <View style={styles.qrContainer}>
              <TouchableOpacity
                style={styles.qrToggleButton}
                onPress={toggleQRCode}
              >
                {showQRCode ? (
                  <QRCode
                    value={memberData.qrData}
                    size={120}
                    color="white"
                    backgroundColor="transparent"
                  />
                ) : (
                  <View style={styles.qrPlaceholder}>
                    <Ionicons name="qr-code" size={40} color="white" />
                    <Text style={styles.qrPlaceholderText}>
                      Toque para mostrar QR Code
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer da carteirinha */}
            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>
                Liga do Bem Botucatu
              </Text>
              <Text style={styles.cardFooterText}>
                CNPJ: 27.644.955/0001-38
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Informações de pagamento */}
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentTitle}>Informações de Pagamento</Text>
          <View style={styles.paymentDetails}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Próximo pagamento:</Text>
              <Text style={styles.paymentValue}>{memberData.nextPayment}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Status:</Text>
              <Text style={[styles.paymentValue, styles.statusActive]}>
                {memberData.status}
              </Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Valor mensal:</Text>
              <Text style={styles.paymentValue}>R$ 29,90</Text>
            </View>
          </View>
        </View>

        {/* Benefícios da carteirinha */}
        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Benefícios da Carteirinha</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.benefitText}>
                Descontos exclusivos em parceiros
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.benefitText}>
                Acesso a eventos especiais
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.benefitText}>
                Participação em campanhas
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.benefitText}>
                Suporte direto à causa
              </Text>
            </View>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Pagamento', 'Redirecionando para pagamento...')}
          >
            <Ionicons name="card" size={20} color="white" />
            <Text style={styles.actionButtonText}>Pagar Mensalidade</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleShare}
          >
            <Ionicons name="share" size={20} color="#4CAF50" />
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
              Compartilhar
            </Text>
          </TouchableOpacity>
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
  scrollContent: {
    padding: 16,
  },
  cardContainer: {
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  logoAccent: {
    color: '#FF9800',
    fontSize: 20,
  },
  logoAccent2: {
    color: '#2196F3',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberInfo: {
    marginBottom: 20,
  },
  memberName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  memberId: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrToggleButton: {
    alignItems: 'center',
  },
  qrPlaceholder: {
    alignItems: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  qrPlaceholderText: {
    color: 'white',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  cardFooter: {
    alignItems: 'center',
  },
  cardFooterText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  paymentInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  paymentDetails: {
    gap: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusActive: {
    color: '#4CAF50',
  },
  benefitsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#4CAF50',
  },
});

export default MembershipCardScreen;
