import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthService';

export default function DonationScreen({ navigation }) {
  const { user } = useAuth();
  const [donationType, setDonationType] = useState('single'); // 'single' or 'recurring'
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null); // 'pix', 'card', 'boleto'

  const predefinedAmounts = [
    { value: 10, label: 'R$ 10' },
    { value: 25, label: 'R$ 25' },
    { value: 50, label: 'R$ 50' },
    { value: 100, label: 'R$ 100' },
  ];

  const handleDonationTypeChange = (type) => {
    setDonationType(type);
    setAmount('');
    setCustomAmount('');
    setPaymentMethod(null);
  };

  const handleAmountSelect = (value) => {
    setAmount(value.toString());
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setCustomAmount(numericValue);
    setAmount(numericValue);
  };

  const handlePaymentMethod = (method) => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Atenção', 'Selecione um valor para doar');
      return;
    }
    setPaymentMethod(method);
  };

  const handleDonate = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Atenção', 'Selecione um valor para doar');
      return;
    }

    if (!paymentMethod) {
      Alert.alert('Atenção', 'Selecione a forma de pagamento');
      return;
    }

    if (paymentMethod === 'pix') {
      showPixPayment();
    } else if (paymentMethod === 'card') {
      Alert.alert(
        'Pagamento com Cartão',
        'Você será redirecionado para a página de pagamento seguro.',
        [{ text: 'OK' }]
      );
    } else if (paymentMethod === 'boleto') {
      Alert.alert(
        'Boleto Bancário',
        'O boleto será enviado para seu e-mail em instantes.',
        [{ text: 'OK' }]
      );
    }
  };

  const showPixPayment = () => {
    const pixKey = 'ligadobem@exemplo.com';
    
    Alert.alert(
      'Pagamento via PIX',
      `Chave PIX: ${pixKey}\n\nValor: R$ ${parseFloat(amount).toFixed(2)}`,
      [
        {
          text: 'Copiar Chave',
          onPress: () => {
            Clipboard.setString(pixKey);
            Alert.alert('Sucesso!', 'Chave PIX copiada para a área de transferência!');
          },
        },
        { text: 'OK' },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <Ionicons name="heart" size={48} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Fazer Doação</Text>
        <Text style={styles.headerSubtitle}>
          Sua generosidade transforma vidas!
        </Text>
      </LinearGradient>

      {/* Donation Type Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo de Doação</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              donationType === 'single' && styles.typeButtonActive,
            ]}
            onPress={() => handleDonationTypeChange('single')}
          >
            <Ionicons
              name="cash-outline"
              size={24}
              color={donationType === 'single' ? '#FFFFFF' : '#6B7280'}
            />
            <Text
              style={[
                styles.typeButtonText,
                donationType === 'single' && styles.typeButtonTextActive,
              ]}
            >
              Doação Única
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              donationType === 'recurring' && styles.typeButtonActive,
            ]}
            onPress={() => handleDonationTypeChange('recurring')}
          >
            <Ionicons
              name="repeat-outline"
              size={24}
              color={donationType === 'recurring' ? '#FFFFFF' : '#6B7280'}
            />
            <Text
              style={[
                styles.typeButtonText,
                donationType === 'recurring' && styles.typeButtonTextActive,
              ]}
            >
              Mensal
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Amount Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Valor da Doação</Text>
        <View style={styles.amountGrid}>
          {predefinedAmounts.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.amountButton,
                amount === item.value.toString() && styles.amountButtonActive,
              ]}
              onPress={() => handleAmountSelect(item.value)}
            >
              <Text
                style={[
                  styles.amountButtonText,
                  amount === item.value.toString() && styles.amountButtonTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Amount */}
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

      {/* Payment Methods */}
      {amount && parseFloat(amount) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forma de Pagamento</Text>
          
          <TouchableOpacity
            style={[
              styles.paymentMethod,
              paymentMethod === 'pix' && styles.paymentMethodActive,
            ]}
            onPress={() => handlePaymentMethod('pix')}
          >
            <View style={styles.paymentMethodLeft}>
              <View style={[styles.paymentIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="qr-code" size={24} color="#10B981" />
              </View>
              <View>
                <Text style={styles.paymentMethodTitle}>PIX</Text>
                <Text style={styles.paymentMethodSubtitle}>Aprovação instantânea</Text>
              </View>
            </View>
            {paymentMethod === 'pix' && (
              <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentMethod,
              paymentMethod === 'card' && styles.paymentMethodActive,
            ]}
            onPress={() => handlePaymentMethod('card')}
          >
            <View style={styles.paymentMethodLeft}>
              <View style={[styles.paymentIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="card" size={24} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.paymentMethodTitle}>Cartão de Crédito</Text>
                <Text style={styles.paymentMethodSubtitle}>Parcelamento disponível</Text>
              </View>
            </View>
            {paymentMethod === 'card' && (
              <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentMethod,
              paymentMethod === 'boleto' && styles.paymentMethodActive,
            ]}
            onPress={() => handlePaymentMethod('boleto')}
          >
            <View style={styles.paymentMethodLeft}>
              <View style={[styles.paymentIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="barcode" size={24} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.paymentMethodTitle}>Boleto Bancário</Text>
                <Text style={styles.paymentMethodSubtitle}>Vencimento em 3 dias</Text>
              </View>
            </View>
            {paymentMethod === 'boleto' && (
              <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Summary */}
      {amount && parseFloat(amount) > 0 && (
        <View style={styles.summary}>
          <LinearGradient
            colors={['#F5F3FF', '#EDE9FE']}
            style={styles.summaryCard}
          >
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
            {donationType === 'recurring' && (
              <Text style={styles.recurringNote}>
                💜 Esta doação será renovada automaticamente todos os meses
              </Text>
            )}
          </LinearGradient>
        </View>
      )}

      {/* Donate Button */}
      {amount && paymentMethod && (
        <View style={styles.donateButtonContainer}>
          <TouchableOpacity style={styles.donateButton} onPress={handleDonate}>
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.donateButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="heart" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.donateButtonText}>
                Doar R$ {parseFloat(amount).toFixed(2)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Impact Section */}
      <View style={styles.impactSection}>
        <Text style={styles.impactTitle}>Seu Impacto</Text>
        <Text style={styles.impactSubtitle}>Veja como sua doação ajuda:</Text>
        
        <View style={styles.impactCard}>
          <Ionicons name="medical" size={24} color="#10B981" />
          <View style={styles.impactText}>
            <Text style={styles.impactCardTitle}>R$ 25 = Vacinas</Text>
            <Text style={styles.impactCardText}>Vacina completa para um pet</Text>
          </View>
        </View>

        <View style={styles.impactCard}>
          <Ionicons name="nutrition" size={24} color="#F59E0B" />
          <View style={styles.impactText}>
            <Text style={styles.impactCardTitle}>R$ 50 = Alimentação</Text>
            <Text style={styles.impactCardText}>1 semana de ração para 5 pets</Text>
          </View>
        </View>

        <View style={styles.impactCard}>
          <Ionicons name="home" size={24} color="#3B82F6" />
          <View style={styles.impactText}>
            <Text style={styles.impactCardTitle}>R$ 100 = Abrigo</Text>
            <Text style={styles.impactCardText}>Manutenção do abrigo por 1 mês</Text>
          </View>
        </View>
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
    gap: 12,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
  recurringNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
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
});
