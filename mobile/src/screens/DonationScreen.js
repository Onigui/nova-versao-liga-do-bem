import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DonationScreen() {
  const donationAmounts = [25, 50, 100, 200, 500];

  const handleDonation = (amount) => {
    Alert.alert(
      'Doação',
      `Deseja doar R$ ${amount} para a Liga do Bem?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Doar', 
          onPress: () => {
            Alert.alert(
              'Redirecionando',
              'Você será redirecionado para a página de pagamento.',
              [{ text: 'OK' }]
            );
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Doações</Text>
        <Text style={styles.headerSubtitle}>
          Ajude a Liga do Bem a continuar cuidando dos animais
        </Text>
      </View>

      <View style={styles.donationContainer}>
        <View style={styles.amountsContainer}>
          <Text style={styles.sectionTitle}>Escolha o valor</Text>
          <View style={styles.amountsGrid}>
            {donationAmounts.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.amountButton}
                onPress={() => handleDonation(amount)}
              >
                <Text style={styles.amountText}>R$ {amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.customAmountButton}
          onPress={() => Alert.alert('Valor personalizado', 'Funcionalidade em desenvolvimento')}
        >
          <Ionicons name="add" size={20} color="#8B5CF6" />
          <Text style={styles.customAmountText}>Valor personalizado</Text>
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Doação Segura</Text>
              <Text style={styles.infoText}>
                Sua doação é processada de forma segura e 100% vai para os animais.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="receipt" size={24} color="#8B5CF6" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Comprovante</Text>
              <Text style={styles.infoText}>
                Você receberá um comprovante por email após a doação.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  donationContainer: {
    flex: 1,
    padding: 20,
  },
  amountsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  amountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  amountButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  customAmountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customAmountText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  infoContainer: {
    flex: 1,
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
});
