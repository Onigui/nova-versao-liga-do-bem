import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DonationScreen = () => {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(null);

  const presetAmounts = [25, 50, 100, 200, 500];
  const donationMethods = [
    {
      id: 'pix',
      name: 'PIX',
      description: 'Transferência instantânea',
      icon: 'flash',
      color: '#32BCAD'
    },
    {
      id: 'card',
      name: 'Cartão de Crédito',
      description: 'Visa, Mastercard, Elo',
      icon: 'card',
      color: '#2196F3'
    },
    {
      id: 'bank',
      name: 'Transferência Bancária',
      description: 'TED ou DOC',
      icon: 'business',
      color: '#4CAF50'
    },
    {
      id: 'cash',
      name: 'Dinheiro',
      description: 'Presencialmente',
      icon: 'cash',
      color: '#FF9800'
    }
  ];

  const handleDonation = () => {
    if (!selectedAmount && !customAmount) {
      Alert.alert('Erro', 'Selecione ou digite um valor para doação.');
      return;
    }

    if (!selectedMethod) {
      Alert.alert('Erro', 'Selecione uma forma de pagamento.');
      return;
    }

    const amount = selectedAmount || parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erro', 'Digite um valor válido.');
      return;
    }

    Alert.alert(
      'Confirmar Doação',
      `Você deseja doar R$ ${amount.toFixed(2)} via ${donationMethods.find(m => m.id === selectedMethod)?.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: () => {
            Alert.alert('Sucesso!', 'Obrigado pela sua doação! Você está ajudando a salvar vidas.');
            setSelectedAmount(null);
            setCustomAmount('');
            setSelectedMethod(null);
          }
        }
      ]
    );
  };

  const renderAmountButton = (amount) => (
    <TouchableOpacity
      key={amount}
      style={[
        styles.amountButton,
        selectedAmount === amount && styles.selectedAmountButton
      ]}
      onPress={() => {
        setSelectedAmount(amount);
        setCustomAmount('');
      }}
    >
      <Text style={[
        styles.amountButtonText,
        selectedAmount === amount && styles.selectedAmountButtonText
      ]}>
        R$ {amount}
      </Text>
    </TouchableOpacity>
  );

  const renderPaymentMethod = (method) => (
    <TouchableOpacity
      key={method.id}
      style={[
        styles.paymentMethodCard,
        selectedMethod === method.id && styles.selectedPaymentMethod
      ]}
      onPress={() => setSelectedMethod(method.id)}
    >
      <View style={styles.paymentMethodHeader}>
        <View style={[styles.paymentMethodIcon, { backgroundColor: method.color }]}>
          <Ionicons name={method.icon} size={24} color="white" />
        </View>
        <View style={styles.paymentMethodInfo}>
          <Text style={styles.paymentMethodName}>{method.name}</Text>
          <Text style={styles.paymentMethodDescription}>{method.description}</Text>
        </View>
        <View style={[
          styles.radioButton,
          selectedMethod === method.id && styles.selectedRadioButton
        ]}>
          {selectedMethod === method.id && (
            <View style={styles.radioButtonInner} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Doação</Text>
          <Text style={styles.headerSubtitle}>
            Ajude-nos a continuar salvando vidas! Cada contribuição, por menor que pareça, 
            garante ração, cuidados veterinários e abrigo para nossos resgatados.
          </Text>
        </View>

        {/* Valor da Doação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Valor da Doação</Text>
          
          <View style={styles.presetAmounts}>
            {presetAmounts.map(renderAmountButton)}
          </View>

          <View style={styles.customAmountContainer}>
            <Text style={styles.customAmountLabel}>Ou digite um valor personalizado:</Text>
            <TextInput
              style={styles.customAmountInput}
              placeholder="R$ 0,00"
              value={customAmount}
              onChangeText={(text) => {
                setCustomAmount(text);
                setSelectedAmount(null);
              }}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Forma de Pagamento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forma de Pagamento</Text>
          
          <View style={styles.paymentMethods}>
            {donationMethods.map(renderPaymentMethod)}
          </View>
        </View>

        {/* Informações da Doação */}
        <View style={styles.donationInfo}>
          <Text style={styles.donationInfoTitle}>Sua doação será utilizada para:</Text>
          
          <View style={styles.donationUses}>
            <View style={styles.donationUseItem}>
              <Ionicons name="medical" size={20} color="#4CAF50" />
              <Text style={styles.donationUseText}>Cuidados veterinários</Text>
            </View>
            <View style={styles.donationUseItem}>
              <Ionicons name="restaurant" size={20} color="#4CAF50" />
              <Text style={styles.donationUseText}>Alimentação dos animais</Text>
            </View>
            <View style={styles.donationUseItem}>
              <Ionicons name="home" size={20} color="#4CAF50" />
              <Text style={styles.donationUseText}>Melhorias no abrigo</Text>
            </View>
            <View style={styles.donationUseItem}>
              <Ionicons name="heart" size={20} color="#4CAF50" />
              <Text style={styles.donationUseText}>Medicamentos e tratamentos</Text>
            </View>
          </View>
        </View>

        {/* Estatísticas */}
        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>Impacto das Doações</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>500+</Text>
              <Text style={styles.statLabel}>Animais Resgatados</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>R$ 150k</Text>
              <Text style={styles.statLabel}>Arrecadado em 2023</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>350+</Text>
              <Text style={styles.statLabel}>Adoções Realizadas</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>100%</Text>
              <Text style={styles.statLabel}>Transparência</Text>
            </View>
          </View>
        </View>

        {/* Outras Formas de Ajudar */}
        <View style={styles.otherWaysSection}>
          <Text style={styles.otherWaysTitle}>Outras Formas de Ajudar</Text>
          
          <View style={styles.otherWaysList}>
            <TouchableOpacity style={styles.otherWayItem}>
              <Ionicons name="paw" size={24} color="#4CAF50" />
              <Text style={styles.otherWayText}>Adotar um Animal</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.otherWayItem}>
              <Ionicons name="people" size={24} color="#4CAF50" />
              <Text style={styles.otherWayText}>Ser Voluntário</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.otherWayItem}>
              <Ionicons name="share" size={24} color="#4CAF50" />
              <Text style={styles.otherWayText}>Compartilhar a Causa</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Botão de Doação */}
        <View style={styles.donationButtonContainer}>
          <TouchableOpacity
            style={styles.donationButton}
            onPress={handleDonation}
          >
            <Ionicons name="heart" size={24} color="white" />
            <Text style={styles.donationButtonText}>
              Doar R$ {(selectedAmount || parseFloat(customAmount) || 0).toFixed(2)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Informações de Transparência */}
        <View style={styles.transparencyInfo}>
          <Text style={styles.transparencyText}>
            💚 Todas as doações são utilizadas exclusivamente para o cuidado dos animais resgatados.
            Acompanhe nossa transparência na aba dedicada.
          </Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  presetAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  amountButton: {
    flex: 1,
    minWidth: '28%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
  },
  amountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  selectedAmountButtonText: {
    color: '#4CAF50',
  },
  customAmountContainer: {
    marginTop: 8,
  },
  customAmountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  customAmountInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  paymentMethods: {
    gap: 12,
  },
  paymentMethodCard: {
    borderWidth: 2,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  selectedPaymentMethod: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#666',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRadioButton: {
    borderColor: '#4CAF50',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  donationInfo: {
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
  donationInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  donationUses: {
    gap: 12,
  },
  donationUseItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donationUseText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  statsSection: {
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  otherWaysSection: {
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
  otherWaysTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  otherWaysList: {
    gap: 12,
  },
  otherWayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  otherWayText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  donationButtonContainer: {
    padding: 16,
  },
  donationButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
  },
  donationButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  transparencyInfo: {
    backgroundColor: '#E8F5E8',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  transparencyText: {
    fontSize: 14,
    color: '#2E7D32',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default DonationScreen;
