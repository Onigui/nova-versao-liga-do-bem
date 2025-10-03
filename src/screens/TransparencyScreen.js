import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TransparencyScreen = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('2024');

  const financialData = {
    '2024': {
      income: 45000,
      expenses: {
        veterinary: 18000,
        food: 12000,
        medications: 8000,
        infrastructure: 5000,
        events: 2000
      },
      animalsRescued: 85,
      animalsAdopted: 62,
      volunteers: 28,
      events: 12
    },
    '2023': {
      income: 38000,
      expenses: {
        veterinary: 15000,
        food: 10000,
        medications: 7000,
        infrastructure: 4000,
        events: 2000
      },
      animalsRescued: 72,
      animalsAdopted: 58,
      volunteers: 25,
      events: 10
    }
  };

  const currentData = financialData[selectedPeriod];

  const handleDownloadReport = () => {
    Alert.alert('Relatório', 'Fazendo download do relatório de transparência...');
  };

  const renderExpenseItem = (category, amount, percentage) => (
    <View key={category} style={styles.expenseItem}>
      <View style={styles.expenseInfo}>
        <View style={styles.expenseCategory}>
          <View style={[styles.categoryColor, { backgroundColor: getCategoryColor(category) }]} />
          <Text style={styles.expenseName}>{getCategoryName(category)}</Text>
        </View>
        <Text style={styles.expenseAmount}>R$ {amount.toLocaleString('pt-BR')}</Text>
      </View>
      <View style={styles.expenseBar}>
        <View style={[
          styles.expenseBarFill,
          { 
            width: `${percentage}%`,
            backgroundColor: getCategoryColor(category)
          }
        ]} />
      </View>
      <Text style={styles.expensePercentage}>{percentage.toFixed(1)}%</Text>
    </View>
  );

  const getCategoryColor = (category) => {
    switch (category) {
      case 'veterinary': return '#4CAF50';
      case 'food': return '#FF9800';
      case 'medications': return '#E91E63';
      case 'infrastructure': return '#2196F3';
      case 'events': return '#9C27B0';
      default: return '#666';
    }
  };

  const getCategoryName = (category) => {
    switch (category) {
      case 'veterinary': return 'Veterinária';
      case 'food': return 'Alimentação';
      case 'medications': return 'Medicamentos';
      case 'infrastructure': return 'Infraestrutura';
      case 'events': return 'Eventos';
      default: return category;
    }
  };

  const totalExpenses = Object.values(currentData.expenses).reduce((sum, expense) => sum + expense, 0);

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Transparência</Text>
          <Text style={styles.headerSubtitle}>
            Acreditamos na confiança construída com clareza. Aqui você acompanha como usamos os recursos, 
            os resultados das ações da ONG e nosso impacto real na vida dos animais.
          </Text>
        </View>

        {/* Seletor de Período */}
        <View style={styles.periodSelector}>
          <Text style={styles.periodTitle}>Período:</Text>
          <View style={styles.periodButtons}>
            <TouchableOpacity
              style={[styles.periodButton, selectedPeriod === '2023' && styles.activePeriodButton]}
              onPress={() => setSelectedPeriod('2023')}
            >
              <Text style={[styles.periodButtonText, selectedPeriod === '2023' && styles.activePeriodButtonText]}>
                2023
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodButton, selectedPeriod === '2024' && styles.activePeriodButton]}
              onPress={() => setSelectedPeriod('2024')}
            >
              <Text style={[styles.periodButtonText, selectedPeriod === '2024' && styles.activePeriodButtonText]}>
                2024
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resumo Financeiro */}
        <View style={styles.financialSummary}>
          <Text style={styles.sectionTitle}>Resumo Financeiro {selectedPeriod}</Text>
          
          <View style={styles.summaryCards}>
            <View style={styles.summaryCard}>
              <Ionicons name="trending-up" size={24} color="#4CAF50" />
              <Text style={styles.summaryValue}>R$ {currentData.income.toLocaleString('pt-BR')}</Text>
              <Text style={styles.summaryLabel}>Receita Total</Text>
            </View>
            
            <View style={styles.summaryCard}>
              <Ionicons name="trending-down" size={24} color="#FF5722" />
              <Text style={styles.summaryValue}>R$ {totalExpenses.toLocaleString('pt-BR')}</Text>
              <Text style={styles.summaryLabel}>Despesas Totais</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadReport}>
            <Ionicons name="download" size={20} color="white" />
            <Text style={styles.downloadButtonText}>Baixar Relatório Completo</Text>
          </TouchableOpacity>
        </View>

        {/* Distribuição de Gastos */}
        <View style={styles.expensesSection}>
          <Text style={styles.sectionTitle}>Como Usamos os Recursos</Text>
          
          <View style={styles.expensesList}>
            {Object.entries(currentData.expenses).map(([category, amount]) => {
              const percentage = (amount / totalExpenses) * 100;
              return renderExpenseItem(category, amount, percentage);
            })}
          </View>
        </View>

        {/* Impacto Social */}
        <View style={styles.impactSection}>
          <Text style={styles.sectionTitle}>Nosso Impacto</Text>
          
          <View style={styles.impactGrid}>
            <View style={styles.impactCard}>
              <Ionicons name="paw" size={32} color="#4CAF50" />
              <Text style={styles.impactNumber}>{currentData.animalsRescued}</Text>
              <Text style={styles.impactLabel}>Animais Resgatados</Text>
            </View>
            
            <View style={styles.impactCard}>
              <Ionicons name="heart" size={32} color="#E91E63" />
              <Text style={styles.impactNumber}>{currentData.animalsAdopted}</Text>
              <Text style={styles.impactLabel}>Adoções Realizadas</Text>
            </View>
            
            <View style={styles.impactCard}>
              <Ionicons name="people" size={32} color="#2196F3" />
              <Text style={styles.impactNumber}>{currentData.volunteers}</Text>
              <Text style={styles.impactLabel}>Voluntários Ativos</Text>
            </View>
            
            <View style={styles.impactCard}>
              <Ionicons name="calendar" size={32} color="#FF9800" />
              <Text style={styles.impactNumber}>{currentData.events}</Text>
              <Text style={styles.impactLabel}>Eventos Realizados</Text>
            </View>
          </View>
        </View>

        {/* Certificações */}
        <View style={styles.certificationsSection}>
          <Text style={styles.sectionTitle}>Certificações e Registros</Text>
          
          <View style={styles.certificationItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <View style={styles.certificationInfo}>
              <Text style={styles.certificationTitle}>CNPJ</Text>
              <Text style={styles.certificationValue}>27.644.955/0001-38</Text>
            </View>
          </View>
          
          <View style={styles.certificationItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <View style={styles.certificationInfo}>
              <Text style={styles.certificationTitle}>Registro Municipal</Text>
              <Text style={styles.certificationValue}>Ativo desde 2021</Text>
            </View>
          </View>
          
          <View style={styles.certificationItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <View style={styles.certificationInfo}>
              <Text style={styles.certificationTitle}>Título de Utilidade Pública</Text>
              <Text style={styles.certificationValue}>Em tramitação</Text>
            </View>
          </View>
        </View>

        {/* Contato para Dúvidas */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Dúvidas sobre Transparência?</Text>
          <Text style={styles.contactText}>
            Entre em contato conosco para esclarecer qualquer dúvida sobre nossos relatórios ou prestação de contas.
          </Text>
          
          <TouchableOpacity style={styles.contactButton}>
            <Ionicons name="mail" size={20} color="white" />
            <Text style={styles.contactButtonText}>Fale Conosco</Text>
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
  periodSelector: {
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
  periodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  activePeriodButton: {
    backgroundColor: '#4CAF50',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  activePeriodButtonText: {
    color: 'white',
  },
  financialSummary: {
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
  summaryCards: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  expensesSection: {
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
  expensesList: {
    gap: 16,
  },
  expenseItem: {
    marginBottom: 16,
  },
  expenseInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  expenseName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  expenseBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 4,
  },
  expenseBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  expensePercentage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  impactSection: {
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
  impactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  impactCard: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  impactNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  impactLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  certificationsSection: {
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
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  certificationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  certificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  certificationValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  contactSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 32,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  contactButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TransparencyScreen;
