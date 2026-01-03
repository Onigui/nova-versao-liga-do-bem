import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';

export default function InfoScreen({navigation}) {
  const [helpInfos, setHelpInfos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHelpInfo();
  }, []);

  const loadHelpInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_PATH}/app/help-info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHelpInfos(data.helpInfos || []);
      }
    } catch (error) {
      console.error('Erro ao carregar informações de ajuda:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (phone) => {
    if (!phone) return;
    const phoneNumber = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
      Alert.alert('Erro', 'Não foi possível abrir o aplicativo de telefone');
    });
  };

  const handleOpenMaps = (address) => {
    if (!address) return;
    const encodedAddress = encodeURIComponent(address);
    Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`).catch((err) => {
      Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mapas');
    });
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    Clipboard.setString(text);
    Alert.alert('Copiado!', `${label || 'Texto'} copiado para a área de transferência`);
  };

  const handleOpenUrl = (url) => {
    if (!url) return;
    Linking.openURL(url).catch((err) => {
      Alert.alert('Erro', 'Não foi possível abrir o link');
    });
  };

  const handleVeterinaryPartners = () => {
    navigation.navigate('Parceiros', { initialCategory: 'veterinária' });
  };

  const getItemIcon = (item) => {
    if (item.icon) return item.icon;
    if (item.phone) return 'call';
    if (item.address) return 'location';
    if (item.email) return 'mail';
    if (item.website) return 'globe';
    return 'information-circle';
  };

  const getItemIconColor = (item) => {
    if (item.phone) return '#10B981';
    if (item.address) return '#3B82F6';
    if (item.email) return '#F59E0B';
    if (item.website) return '#8B5CF6';
    return '#6B7280';
  };

  const renderHelpItem = (item, index) => {
    const iconName = getItemIcon(item);
    const iconColor = getItemIconColor(item);
    
    // Determinar o texto principal e secundário
    const mainText = item.title || item.subtitle || '';
    const secondaryText = item.phone || item.subtitle || item.description || '';
    const displayPhone = item.phone || (item.subtitle && /[\d()\s-]/.test(item.subtitle) ? item.subtitle : null);

    return (
      <TouchableOpacity
        key={item.id || index}
        style={styles.helpItemCard}
        activeOpacity={0.7}
        onPress={() => {
          if (item.phone) {
            handleCall(item.phone);
          } else if (item.address) {
            handleOpenMaps(item.address);
          } else if (item.email) {
            handleOpenUrl(`mailto:${item.email}`);
          } else if (item.website) {
            handleOpenUrl(item.website);
          }
        }}>
        <View style={styles.helpItemContent}>
          <View style={[styles.helpItemIconContainer, { backgroundColor: `${iconColor}15` }]}>
            <Ionicons name={iconName} size={24} color={iconColor} />
          </View>
          <View style={styles.helpItemTextContainer}>
            <Text style={styles.helpItemTitle}>{mainText}</Text>
            {displayPhone && (
              <Text style={styles.helpItemPhone}>{displayPhone}</Text>
            )}
            {item.description && !displayPhone && (
              <Text style={styles.helpItemDescription}>{item.description}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Carregando informações...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informações e Ajuda</Text>
        <Text style={styles.headerSubtitle}>Encontre o que você precisa</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {helpInfos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="information-circle-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Nenhuma informação disponível no momento</Text>
          </View>
        ) : (
          helpInfos.map((section) => {
            const items = Array.isArray(section.items) ? section.items : [];
            return (
              <View key={section.id} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.description && (
                    <Text style={styles.sectionDescription}>{section.description}</Text>
                  )}
                </View>
                {items.length > 0 ? (
                  <View style={styles.sectionContent}>
                    {items.map((item, index) => renderHelpItem(item, index))}
                  </View>
                ) : (
                  <View style={styles.emptyItemsContainer}>
                    <Ionicons name="information-circle-outline" size={32} color="#9CA3AF" />
                    <Text style={styles.noItemsText}>Nenhum item disponível</Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Botão especial para Clínicas Veterinárias */}
        <View style={styles.veterinarySection}>
          <TouchableOpacity
            style={styles.veterinaryButton}
            onPress={handleVeterinaryPartners}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.veterinaryButtonGradient}>
              <View style={styles.veterinaryIconContainer}>
                <Ionicons name="medical" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.veterinaryButtonTextContainer}>
                <Text style={styles.veterinaryButtonTitle}>
                  Ver Clínicas Parceiras
                </Text>
                <Text style={styles.veterinaryButtonSubtitle}>
                  Acesse nossa lista de clínicas veterinárias parceiras
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    padding: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  sectionContent: {
    padding: 16,
  },
  helpItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  helpItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  helpItemIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  helpItemTextContainer: {
    flex: 1,
  },
  helpItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  helpItemPhone: {
    fontSize: 15,
    fontWeight: '500',
    color: '#10B981',
    marginTop: 2,
  },
  helpItemDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  emptyItemsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noItemsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  veterinarySection: {
    marginBottom: 20,
    marginTop: 8,
  },
  veterinaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  veterinaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  veterinaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  veterinaryButtonTextContainer: {
    flex: 1,
  },
  veterinaryButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  veterinaryButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
});
