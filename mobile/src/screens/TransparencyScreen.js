import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function TransparencyScreen() {
  const [period, setPeriod] = useState('month'); // 'month', 'quarter', 'year'
  const [financialData, setFinancialData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFinancialData();
  }, [period]);

  const loadFinancialData = async () => {
    try {
      // Dados mockados
      setFinancialData({
        income: 45000,
        expenses: 38000,
        balance: 7000,
        donations: 35000,
        memberships: 10000,
        categories: [
          { name: 'Alimentação', value: 15000, percentage: 39.5, color: '#10B981' },
          { name: 'Veterinário', value: 12000, percentage: 31.6, color: '#3B82F6' },
          { name: 'Abrigo', value: 8000, percentage: 21.1, color: '#F59E0B' },
          { name: 'Outros', value: 3000, percentage: 7.9, color: '#EC4899' },
        ],
      });
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFinancialData();
  };

  const periods = [
    { id: 'month', label: 'Mês' },
    { id: 'quarter', label: 'Trimestre' },
    { id: 'year', label: 'Ano' },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <Ionicons name="pie-chart" size={48} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Transparência Financeira</Text>
        <Text style={styles.headerSubtitle}>
          Veja para onde vai cada centavo
        </Text>
      </LinearGradient>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.periodButton,
              period === p.id && styles.periodButtonActive,
            ]}
            onPress={() => setPeriod(p.id)}
          >
            <Text
              style={[
                styles.periodText,
                period === p.id && styles.periodTextActive,
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="trending-up" size={24} color="#10B981" />
          <Text style={styles.summaryValue}>
            R$ {financialData?.income.toLocaleString('pt-BR')}
          </Text>
          <Text style={styles.summaryLabel}>Receitas</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#FEE2E2' }]}>
          <Ionicons name="trending-down" size={24} color="#EF4444" />
          <Text style={styles.summaryValue}>
            R$ {financialData?.expenses.toLocaleString('pt-BR')}
          </Text>
          <Text style={styles.summaryLabel}>Despesas</Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="wallet" size={24} color="#3B82F6" />
          <Text style={styles.summaryValue}>
            R$ {financialData?.balance.toLocaleString('pt-BR')}
          </Text>
          <Text style={styles.summaryLabel}>Saldo</Text>
        </View>
      </View>

      {/* Income Sources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Origem das Receitas</Text>
        
        <View style={styles.incomeCard}>
          <View style={styles.incomeRow}>
            <View style={styles.incomeLeft}>
              <View style={[styles.incomeIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="heart" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.incomeLabel}>Doações</Text>
            </View>
            <Text style={styles.incomeValue}>
              R$ {financialData?.donations.toLocaleString('pt-BR')}
            </Text>
          </View>

          <View style={styles.incomeRow}>
            <View style={styles.incomeLeft}>
              <View style={[styles.incomeIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="card" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.incomeLabel}>Mensalidades</Text>
            </View>
            <Text style={styles.incomeValue}>
              R$ {financialData?.memberships.toLocaleString('pt-BR')}
            </Text>
          </View>
        </View>
      </View>

      {/* Expenses Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Distribuição das Despesas</Text>
        
        {financialData?.categories.map((category, index) => (
          <View key={index} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryValue}>
                R$ {category.value.toLocaleString('pt-BR')}
              </Text>
            </View>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={[category.color, category.color]}
                  style={[styles.progressFill, { width: `${category.percentage}%` }]}
                />
              </View>
              <Text style={styles.progressPercentage}>
                {category.percentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transações Recentes</Text>
        
        <View style={styles.transactionCard}>
          <View style={styles.transactionLeft}>
            <View style={[styles.transactionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="add" size={20} color="#10B981" />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionTitle}>Doação - João Silva</Text>
              <Text style={styles.transactionDate}>Hoje, 14:30</Text>
            </View>
          </View>
          <Text style={styles.transactionValuePositive}>+R$ 100,00</Text>
        </View>

        <View style={styles.transactionCard}>
          <View style={styles.transactionLeft}>
            <View style={[styles.transactionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="remove" size={20} color="#EF4444" />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionTitle}>Ração Premium - 20kg</Text>
              <Text style={styles.transactionDate}>Ontem, 10:15</Text>
            </View>
          </View>
          <Text style={styles.transactionValueNegative}>-R$ 250,00</Text>
        </View>

        <View style={styles.transactionCard}>
          <View style={styles.transactionLeft}>
            <View style={[styles.transactionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="add" size={20} color="#10B981" />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionTitle}>Mensalidade - Maria Santos</Text>
              <Text style={styles.transactionDate}>02/10/2025</Text>
            </View>
          </View>
          <Text style={styles.transactionValuePositive}>+R$ 50,00</Text>
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="shield-checkmark" size={24} color="#8B5CF6" />
        <View style={styles.infoBannerText}>
          <Text style={styles.infoBannerTitle}>Transparência Total</Text>
          <Text style={styles.infoBannerSubtitle}>
            Todos os valores são auditados mensalmente por contador independente
          </Text>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    margin: 20,
    marginTop: -30,
    padding: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  incomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  incomeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  incomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  incomeValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    width: 50,
    textAlign: 'right',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  transactionValuePositive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  transactionValueNegative: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#F5F3FF',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 40,
  },
  infoBannerText: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  infoBannerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});

