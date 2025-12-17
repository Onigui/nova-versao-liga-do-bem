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
  const [expandedSections, setExpandedSections] = useState({});

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
        // Expandir primeira seção por padrão
        if (data.helpInfos && data.helpInfos.length > 0) {
          setExpandedSections({ [data.helpInfos[0].id]: true });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar informações de ajuda:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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

  const renderItem = (item) => {
    const actions = [];

    if (item.phone) {
      actions.push({
        icon: 'call',
        label: 'Ligar',
        color: '#10B981',
        onPress: () => handleCall(item.phone),
      });
    }

    if (item.address) {
      actions.push({
        icon: 'map',
        label: 'Ver no Maps',
        color: '#3B82F6',
        onPress: () => handleOpenMaps(item.address),
      });
    }

    if (item.email) {
      actions.push({
        icon: 'mail',
        label: 'E-mail',
        color: '#F59E0B',
        onPress: () => handleOpenUrl(`mailto:${item.email}`),
      });
    }

    if (item.website) {
      actions.push({
        icon: 'globe',
        label: 'Website',
        color: '#8B5CF6',
        onPress: () => handleOpenUrl(item.website),
      });
    }

    if (item.copy) {
      actions.push({
        icon: 'copy',
        label: 'Copiar',
        color: '#6B7280',
        onPress: () => handleCopy(item.copy.text, item.copy.label),
      });
    }

    return (
      <View key={item.id || item.title} style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.itemContent}>
            {item.icon && (
              <Ionicons name={item.icon} size={24} color="#8B5CF6" style={styles.itemIcon} />
            )}
            <View style={styles.itemTextContainer}>
              {item.title && <Text style={styles.itemTitle}>{item.title}</Text>}
              {item.subtitle && <Text style={styles.itemSubtitle}>{item.subtitle}</Text>}
              {item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
            </View>
          </View>
        </View>

        {item.details && (
          <View style={styles.itemDetails}>
            {item.details.map((detail, index) => (
              <Text key={index} style={styles.detailText}>
                • {detail}
              </Text>
            ))}
          </View>
        )}

        {actions.length > 0 && (
          <View style={styles.itemActions}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionButton, {borderColor: action.color}]}
                onPress={action.onPress}>
                <Ionicons name={action.icon} size={18} color={action.color} />
                <Text style={[styles.actionButtonText, {color: action.color}]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
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
          helpInfos.map((section) => (
            <View key={section.id} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.id)}>
                <View style={styles.sectionHeaderContent}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.description && (
                    <Text style={styles.sectionDescription}>{section.description}</Text>
                  )}
                </View>
                <Ionicons
                  name={expandedSections[section.id] ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#8B5CF6"
                />
              </TouchableOpacity>

              {expandedSections[section.id] && (
                <View style={styles.sectionContent}>
                  {Array.isArray(section.items) && section.items.length > 0 ? (
                    section.items.map((item, index) => {
                      // Garantir que o item tenha pelo menos título ou subtítulo
                      if (!item.title && !item.subtitle && !item.description) {
                        return null;
                      }
                      return renderItem({...item, id: `${section.id}-${index}`});
                    }).filter(Boolean)
                  ) : (
                    <View style={styles.emptyItemsContainer}>
                      <Ionicons name="information-circle-outline" size={32} color="#9CA3AF" />
                      <Text style={styles.noItemsText}>Nenhum item disponível</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}

        {/* Botão especial para Clínicas Veterinárias */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderContent}>
              <Text style={styles.sectionTitle}>Clínicas Veterinárias 24h</Text>
              <Text style={styles.sectionDescription}>
                Encontre clínicas parceiras disponíveis
              </Text>
            </View>
          </View>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={styles.veterinaryButton}
              onPress={handleVeterinaryPartners}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.veterinaryButtonGradient}>
                <Ionicons name="medical" size={28} color="#FFFFFF" />
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
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderContent: {
    flex: 1,
    marginRight: 16,
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
  },
  sectionContent: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#F9FAFB',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  itemDetails: {
    marginTop: 8,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    lineHeight: 20,
  },
  itemActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
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
  veterinaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  veterinaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  veterinaryButtonTextContainer: {
    flex: 1,
    marginLeft: 16,
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
  },
});

