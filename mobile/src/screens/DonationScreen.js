import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Clipboard,
  Modal,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '../services/AuthService';
import {API_BASE_PATH} from '../config/apiConfig';

export default function DonationScreen({navigation}) {
  const {user} = useAuth();
  const [donationType, setDonationType] = useState('single'); // 'single' or 'recurring'
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null); // 'pix', 'card', 'boleto'
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [donationId, setDonationId] = useState(null);

  const predefinedAmounts = [
    {value: 10, label: 'R$ 10'},
    {value: 25, label: 'R$ 25'},
    {value: 50, label: 'R$ 50'},
    {value: 100, label: 'R$ 100'},
  ];

  const handleDonationTypeChange = type => {
    setDonationType(type);
    setAmount('');
    setCustomAmount('');
    setPaymentMethod(null);
  };

  const handleAmountSelect = value => {
    setAmount(value.toString());
    setCustomAmount('');
  };

  const handleCustomAmountChange = text => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setCustomAmount(numericValue);
    setAmount(numericValue);
  };

  const handlePaymentMethod = method => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Atenção', 'Selecione um valor para doar');
      return;
    }
    if (method !== 'pix') {
      Alert.alert(
        'Em breve',
        'No momento só aceitamos doações via PIX. Cartão e boleto estarão disponíveis em breve.',
      );
      setPaymentMethod('pix');
      return;
    }
    setPaymentMethod(method);
  };

  const handleDonate = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Atenção', 'Selecione um valor para doar');
      return;
    }

    if (!paymentMethod) {
      Alert.alert('Atenção', 'Selecione a forma de pagamento');
      return;
    }

    if (paymentMethod !== 'pix') {
      Alert.alert(
        'Em breve',
        'No momento só aceitamos doações via PIX. Selecione PIX para continuar.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_PATH}/donations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: parseFloat(amount),
          method: 'PIX',
          recurring: donationType === 'recurring',
          description:
            donationType === 'recurring'
              ? 'Doação mensal via app'
              : 'Doação única via app',
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        Alert.alert('Erro', data.error || 'Não foi possível criar a doação');
        return;
      }

      if (!data.pix?.key) {
        Alert.alert(
          'Atenção',
          data.error ||
            'Doação registrada, mas a chave PIX ainda não está configurada. Contate a Liga do Bem.',
        );
        return;
      }

      setDonationId(data.donation?.id || null);
      setPixData({
        key: data.pix.key,
        holderName: data.pix.holderName,
        city: data.pix.city,
        amount: data.pix.amount || parseFloat(amount),
      });
      setPixModalVisible(true);
    } catch (error) {
      console.error('Erro ao criar doação:', error);
      Alert.alert(
        'Erro',
        'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyPixKey = () => {
    if (!pixData?.key) return;
    Clipboard.setString(pixData.key);
    Alert.alert('Copiado!', 'Chave PIX copiada para a área de transferência.');
  };

  const confirmPayment = async () => {
    if (!donationId) {
      Alert.alert('Erro', 'Doação não encontrada. Tente novamente.');
      return;
    }

    setConfirming(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_PATH}/donations/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({donationId}),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        Alert.alert('Erro', data.error || 'Não foi possível confirmar a doação');
        return;
      }

      setPixModalVisible(false);
      Alert.alert(
        'Obrigado!',
        data.awaitingAdmin
          ? `Recebemos o aviso do seu PIX de R$ ${parseFloat(amount).toFixed(2)}. A Liga do Bem vai confirmar e a doação aparecerá como aprovada no histórico.`
          : `Sua doação de R$ ${parseFloat(amount).toFixed(2)} foi registrada. Você pode vê-la em Minhas Doações.`,
        [
          {
            text: 'Ver minhas doações',
            onPress: () => navigation.navigate('MyDonations'),
          },
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.error('Erro ao confirmar doação:', error);
      Alert.alert('Erro', 'Falha ao confirmar. Tente novamente.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <Ionicons name="heart" size={48} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Fazer Doação</Text>
        <Text style={styles.headerSubtitle}>
          Sua generosidade transforma vidas!
        </Text>
        {user?.name ? (
          <Text style={styles.headerUser}>Olá, {user.name.split(' ')[0]}</Text>
        ) : null}
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.membershipNote}>
          <Ionicons name="information-circle" size={20} color="#7C3AED" />
          <Text style={styles.membershipNoteText}>
            Doação não torna você membro. Para ativar o cartão e o QR Code nos
            parceiros, entre em Cartão e assine um plano.
          </Text>
        </View>
        <Text style={styles.sectionTitle}>Tipo de Doação</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              donationType === 'single' && styles.typeButtonActive,
            ]}
            onPress={() => handleDonationTypeChange('single')}>
            <Ionicons
              name="cash-outline"
              size={24}
              color={donationType === 'single' ? '#FFFFFF' : '#6B7280'}
            />
            <Text
              style={[
                styles.typeButtonText,
                donationType === 'single' && styles.typeButtonTextActive,
              ]}>
              Doação Única
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              donationType === 'recurring' && styles.typeButtonActive,
            ]}
            onPress={() => handleDonationTypeChange('recurring')}>
            <Ionicons
              name="repeat-outline"
              size={24}
              color={donationType === 'recurring' ? '#FFFFFF' : '#6B7280'}
            />
            <Text
              style={[
                styles.typeButtonText,
                donationType === 'recurring' && styles.typeButtonTextActive,
              ]}>
              Mensal
            </Text>
          </TouchableOpacity>
        </View>
        {donationType === 'recurring' ? (
          <Text style={styles.recurringHint}>
            A doação mensal registra sua intenção. O PIX deste mês é feito agora;
            a renovação automática chega em breve.
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Valor da Doação</Text>
        <View style={styles.amountGrid}>
          {predefinedAmounts.map(item => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.amountButton,
                amount === item.value.toString() && styles.amountButtonActive,
              ]}
              onPress={() => handleAmountSelect(item.value)}>
              <Text
                style={[
                  styles.amountButtonText,
                  amount === item.value.toString() &&
                    styles.amountButtonTextActive,
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.customAmountContainer}>
          <Text style={styles.customAmountLabel}>Outro valor:</Text>
          <View style={styles.customAmountInput}>
            <Text style={styles.currencySymbol}>R$</Text>
            <TextInput
              style={styles.input}
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              value={customAmount}
              onChangeText={handleCustomAmountChange}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      {amount && parseFloat(amount) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forma de Pagamento</Text>

          <TouchableOpacity
            style={[
              styles.paymentMethod,
              paymentMethod === 'pix' && styles.paymentMethodActive,
            ]}
            onPress={() => handlePaymentMethod('pix')}>
            <View style={styles.paymentMethodLeft}>
              <View style={[styles.paymentIcon, {backgroundColor: '#D1FAE5'}]}>
                <Ionicons name="qr-code" size={24} color="#10B981" />
              </View>
              <View>
                <Text style={styles.paymentMethodTitle}>PIX</Text>
                <Text style={styles.paymentMethodSubtitle}>
                  Disponível agora
                </Text>
              </View>
            </View>
            {paymentMethod === 'pix' && (
              <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.paymentMethod}
            onPress={() => handlePaymentMethod('card')}>
            <View style={styles.paymentMethodLeft}>
              <View style={[styles.paymentIcon, {backgroundColor: '#DBEAFE'}]}>
                <Ionicons name="card" size={24} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.paymentMethodTitle}>Cartão de Crédito</Text>
                <Text style={styles.paymentMethodSubtitle}>Em breve</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.paymentMethod}
            onPress={() => handlePaymentMethod('boleto')}>
            <View style={styles.paymentMethodLeft}>
              <View style={[styles.paymentIcon, {backgroundColor: '#FEF3C7'}]}>
                <Ionicons name="barcode" size={24} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.paymentMethodTitle}>Boleto Bancário</Text>
                <Text style={styles.paymentMethodSubtitle}>Em breve</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {amount && parseFloat(amount) > 0 && (
        <View style={styles.summary}>
          <LinearGradient
            colors={['#F5F3FF', '#EDE9FE']}
            style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tipo:</Text>
              <Text style={styles.summaryValue}>
                {donationType === 'single' ? 'Doação Única' : 'Doação Mensal'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Valor:</Text>
              <Text style={styles.summaryValueLarge}>
                R$ {parseFloat(amount).toFixed(2)}
              </Text>
            </View>
          </LinearGradient>
        </View>
      )}

      {amount && paymentMethod && (
        <View style={styles.donateButtonContainer}>
          <TouchableOpacity
            style={styles.donateButton}
            onPress={handleDonate}
            disabled={submitting}>
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.donateButtonGradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="heart"
                    size={20}
                    color="#FFFFFF"
                    style={{marginRight: 8}}
                  />
                  <Text style={styles.donateButtonText}>
                    Doar R$ {parseFloat(amount).toFixed(2)}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.impactSection}>
        <Text style={styles.impactTitle}>Seu Impacto</Text>
        <Text style={styles.impactSubtitle}>Veja como sua doação ajuda:</Text>

        <View style={styles.impactCard}>
          <Ionicons name="medical" size={24} color="#10B981" />
          <View style={styles.impactText}>
            <Text style={styles.impactCardTitle}>R$ 25 = Vacinas</Text>
            <Text style={styles.impactCardText}>
              Vacina completa para um pet
            </Text>
          </View>
        </View>

        <View style={styles.impactCard}>
          <Ionicons name="nutrition" size={24} color="#F59E0B" />
          <View style={styles.impactText}>
            <Text style={styles.impactCardTitle}>R$ 50 = Alimentação</Text>
            <Text style={styles.impactCardText}>
              1 semana de ração para 5 pets
            </Text>
          </View>
        </View>

        <View style={styles.impactCard}>
          <Ionicons name="home" size={24} color="#3B82F6" />
          <View style={styles.impactText}>
            <Text style={styles.impactCardTitle}>R$ 100 = Abrigo</Text>
            <Text style={styles.impactCardText}>
              Manutenção do abrigo por 1 mês
            </Text>
          </View>
        </View>
      </View>

      <Modal
        visible={pixModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPixModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="qr-code" size={28} color="#10B981" />
              <Text style={styles.modalTitle}>Pagar com PIX</Text>
            </View>

            <Text style={styles.modalAmount}>
              R$ {pixData ? Number(pixData.amount).toFixed(2) : '0,00'}
            </Text>
            <Text style={styles.modalHolder}>
              {pixData?.holderName || 'Liga do Bem Botucatu'}
              {pixData?.city ? ` · ${pixData.city}` : ''}
            </Text>

            <Text style={styles.modalLabel}>Chave PIX</Text>
            <View style={styles.pixKeyBox}>
              <Text style={styles.pixKeyText} selectable>
                {pixData?.key}
              </Text>
            </View>

            <TouchableOpacity style={styles.copyButton} onPress={copyPixKey}>
              <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
              <Text style={styles.copyButtonText}>Copiar chave PIX</Text>
            </TouchableOpacity>

            <Text style={styles.modalHint}>
              Abra o app do seu banco, cole a chave, confira o valor e finalize o
              PIX. Depois toque em “Já paguei”.
            </Text>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={confirmPayment}
              disabled={confirming}>
              {confirming ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>Já paguei</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setPixModalVisible(false)}
              disabled={confirming}>
              <Text style={styles.cancelButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  headerUser: {
    marginTop: 10,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
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
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  membershipNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  membershipNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#5B21B6',
    lineHeight: 18,
  },
  recurringHint: {
    marginTop: 12,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  amountButton: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  amountButtonActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#8B5CF6',
  },
  amountButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  amountButtonTextActive: {
    color: '#8B5CF6',
  },
  customAmountContainer: {
    marginTop: 8,
  },
  customAmountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  customAmountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 54,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  paymentMethodActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#8B5CF6',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  paymentMethodSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  summary: {
    padding: 20,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  summaryValueLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  donateButtonContainer: {
    padding: 20,
    paddingTop: 0,
  },
  donateButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  donateButtonGradient: {
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  impactSection: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  impactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  impactSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  impactText: {
    flex: 1,
  },
  impactCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  impactCardText: {
    fontSize: 13,
    color: '#6B7280',
  },
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  modalHolder: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  pixKeyBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  pixKeyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 48,
    marginBottom: 16,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalHint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
});
