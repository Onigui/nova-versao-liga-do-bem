import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AdoptionsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Adoções</Text>
        <Text style={styles.headerSubtitle}>
          Encontre seu novo melhor amigo
        </Text>
      </View>

      <View style={styles.comingSoonContainer}>
        <Ionicons name="paw" size={64} color="#8B5CF6" />
        <Text style={styles.comingSoonTitle}>Em Breve</Text>
        <Text style={styles.comingSoonText}>
          Esta funcionalidade está sendo desenvolvida. Em breve você poderá:
        </Text>
        <View style={styles.featuresList}>
          <Text style={styles.featureItem}>• Ver animais disponíveis para adoção</Text>
          <Text style={styles.featureItem}>• Filtrar por espécie, idade e tamanho</Text>
          <Text style={styles.featureItem}>• Preencher formulário de interesse</Text>
          <Text style={styles.featureItem}>• Acompanhar o processo de adoção</Text>
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
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 16,
  },
  comingSoonText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featuresList: {
    alignItems: 'flex-start',
  },
  featureItem: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 24,
  },
});
