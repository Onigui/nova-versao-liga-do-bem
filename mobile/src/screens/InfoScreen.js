import React, {useState, useEffect, useRef} from 'react';
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
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SECTION_THEMES = [
  {
    match: /canil|prote[cç][aã]o animal/i,
    icon: 'paw',
    color: '#0EA5E9',
  },
  {
    match: /emerg[eê]ncia|telefone/i,
    icon: 'call',
    color: '#EF4444',
  },
  {
    match: /den[uú]ncia|maus.?trato/i,
    icon: 'shield-checkmark',
    color: '#F59E0B',
  },
  {
    match: /informa[cç][aã]o|servi[cç]o|zoonose/i,
    icon: 'information-circle',
    color: '#3B82F6',
  },
  {
    match: /primeiro|socorro|dica|reanima/i,
    icon: 'medkit',
    color: '#10B981',
  },
];

function getSectionTheme(section) {
  const haystack = `${section?.category || ''} ${section?.title || ''}`;
  return (
    SECTION_THEMES.find((theme) => theme.match.test(haystack)) || {
      icon: 'help-circle',
      color: '#8B5CF6',
    }
  );
}

function getItemKind(item) {
  if (Array.isArray(item?.steps) && item.steps.length > 0) return 'guide';
  if (item?.phone) return 'phone';
  if (item?.address) return 'address';
  if (item?.email) return 'email';
  if (item?.website) return 'website';
  if (item?.copy?.text) return 'copy';
  if (item?.description) return 'text';
  return 'text';
}

export default function InfoScreen({navigation}) {
  const [helpInfos, setHelpInfos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGuides, setExpandedGuides] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const sectionRefs = useRef({});
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});

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
        const sections = data.helpInfos || [];
        setHelpInfos(sections);
        const initialExpanded = {};
        sections.forEach((section, index) => {
          initialExpanded[section.id] = index < 2;
        });
        setExpandedSections(initialExpanded);
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
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o aplicativo de telefone');
    });
  };

  const handleOpenMaps = (address) => {
    if (!address) return;
    const encodedAddress = encodeURIComponent(address);
    Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`).catch(() => {
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
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o link');
    });
  };

  const handleVeterinaryPartners = () => {
    navigation.navigate('Parceiros', { initialCategory: 'veterinária' });
  };

  const toggleSection = (sectionId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleGuide = (guideKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGuides((prev) => ({
      ...prev,
      [guideKey]: !prev[guideKey],
    }));
  };

  const scrollToSection = (sectionId) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: true }));
    const y = sectionOffsets.current[sectionId];
    if (typeof y === 'number' && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(y - 12, 0), animated: true });
    }
  };

  const renderGuideItem = (item, index, sectionId) => {
    const guideKey = `${sectionId}-guide-${index}`;
    const isOpen = !!expandedGuides[guideKey];
    const steps = Array.isArray(item.steps) ? item.steps : [];

    return (
      <View key={guideKey} style={styles.guideCard}>
        <TouchableOpacity
          style={styles.guideHeader}
          activeOpacity={0.75}
          onPress={() => toggleGuide(guideKey)}>
          <View style={[styles.helpItemIconContainer, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="medkit-outline" size={22} color="#10B981" />
          </View>
          <View style={styles.helpItemTextContainer}>
            <Text style={styles.helpItemTitle}>{item.title}</Text>
            {item.subtitle ? (
              <Text style={styles.helpItemSubtitle}>{item.subtitle}</Text>
            ) : null}
            <Text style={styles.guideHint}>
              {isOpen ? 'Toque para recolher' : `${steps.length} passos · toque para ver`}
            </Text>
          </View>
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#9CA3AF"
          />
        </TouchableOpacity>

        {isOpen ? (
          <View style={styles.guideBody}>
            {item.warning ? (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={18} color="#B45309" />
                <Text style={styles.warningText}>{item.warning}</Text>
              </View>
            ) : null}
            {item.description ? (
              <Text style={styles.guideIntro}>{item.description}</Text>
            ) : null}
            {steps.map((step, stepIndex) => (
              <View key={`${guideKey}-step-${stepIndex}`} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{stepIndex + 1}</Text>
                </View>
                <Text style={styles.stepText}>
                  {typeof step === 'string' ? step : step?.text || ''}
                </Text>
              </View>
            ))}
            {item.tip ? (
              <View style={styles.tipBox}>
                <Ionicons name="bulb-outline" size={18} color="#1D4ED8" />
                <Text style={styles.tipText}>{item.tip}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderHelpItem = (item, index, sectionId) => {
    const kind = getItemKind(item);
    if (kind === 'guide') {
      return renderGuideItem(item, index, sectionId);
    }

    let iconName = 'information-circle-outline';
    let iconColor = '#6B7280';
    let displayValue = '';
    let onPressAction = null;

    if (kind === 'phone') {
      iconName = 'call-outline';
      iconColor = '#10B981';
      displayValue = item.phone;
      onPressAction = () => handleCall(item.phone);
    } else if (kind === 'address') {
      iconName = 'map-outline';
      iconColor = '#3B82F6';
      displayValue = item.address;
      onPressAction = () => handleOpenMaps(item.address);
    } else if (kind === 'email') {
      iconName = 'mail-outline';
      iconColor = '#F59E0B';
      displayValue = item.email;
      onPressAction = () => handleOpenUrl(`mailto:${item.email}`);
    } else if (kind === 'website') {
      iconName = 'globe-outline';
      iconColor = '#EC4899';
      displayValue = item.website;
      onPressAction = () => handleOpenUrl(item.website);
    } else if (kind === 'copy') {
      iconName = 'copy-outline';
      iconColor = '#8B5CF6';
      displayValue = item.copy.text;
      onPressAction = () => handleCopy(item.copy.text, item.copy.label || item.title);
    } else if (item.description) {
      iconName = 'document-text-outline';
      iconColor = '#6B7280';
      displayValue = item.description;
    }

    return (
      <TouchableOpacity
        key={item.id || `item-${sectionId}-${index}`}
        style={styles.helpItemCard}
        activeOpacity={onPressAction ? 0.7 : 1}
        onPress={onPressAction || undefined}
        disabled={!onPressAction}>
        <View style={styles.helpItemContent}>
          <View style={[styles.helpItemIconContainer, { backgroundColor: `${iconColor}20` }]}>
            <Ionicons name={iconName} size={22} color={iconColor} />
          </View>
          <View style={styles.helpItemTextContainer}>
            {item.title ? <Text style={styles.helpItemTitle}>{item.title}</Text> : null}
            {item.subtitle ? (
              <Text style={styles.helpItemSubtitle}>{item.subtitle}</Text>
            ) : null}
            {displayValue ? (
              <Text style={[styles.helpItemValue, { color: iconColor }]}>{displayValue}</Text>
            ) : null}
          </View>
          {onPressAction ? (
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Carregando informações...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0EA5E9', '#0284C7']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informações e Ajuda</Text>
        <Text style={styles.headerSubtitle}>
          Telefones, denúncias e primeiros socorros
        </Text>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}>
        {helpInfos.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}>
            {helpInfos.map((section) => {
              const theme = getSectionTheme(section);
              return (
                <TouchableOpacity
                  key={`chip-${section.id}`}
                  style={[styles.chip, { borderColor: `${theme.color}55` }]}
                  onPress={() => scrollToSection(section.id)}
                  activeOpacity={0.8}>
                  <Ionicons name={theme.icon} size={14} color={theme.color} />
                  <Text style={[styles.chipText, { color: theme.color }]} numberOfLines={1}>
                    {section.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.disclaimerCard}>
          <Ionicons name="alert-circle-outline" size={20} color="#B45309" />
          <Text style={styles.disclaimerText}>
            Em emergência, ligue primeiro. Os guias de primeiros socorros são
            orientações iniciais e não substituem atendimento veterinário.
          </Text>
        </View>

        {helpInfos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="information-circle-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Nenhuma informação disponível no momento</Text>
          </View>
        ) : (
          helpInfos.map((section) => {
            const items = Array.isArray(section.items) ? section.items : [];
            const theme = getSectionTheme(section);
            const isExpanded = expandedSections[section.id] !== false;

            return (
              <View
                key={section.id}
                style={styles.section}
                onLayout={(event) => {
                  sectionOffsets.current[section.id] = event.nativeEvent.layout.y;
                }}
                ref={(ref) => {
                  sectionRefs.current[section.id] = ref;
                }}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  activeOpacity={0.8}
                  onPress={() => toggleSection(section.id)}>
                  <View
                    style={[
                      styles.sectionIconWrap,
                      { backgroundColor: `${theme.color}18` },
                    ]}>
                    <Ionicons name={theme.icon} size={22} color={theme.color} />
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    {section.description ? (
                      <Text style={styles.sectionDescription} numberOfLines={isExpanded ? 0 : 2}>
                        {section.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>

                {isExpanded ? (
                  items.length > 0 ? (
                    <View style={styles.sectionContent}>
                      {items.map((item, index) =>
                        renderHelpItem(item, index, section.id),
                      )}
                    </View>
                  ) : (
                    <View style={styles.emptyItemsContainer}>
                      <Ionicons name="information-circle-outline" size={32} color="#9CA3AF" />
                      <Text style={styles.noItemsText}>Nenhum item disponível</Text>
                    </View>
                  )
                ) : null}
              </View>
            );
          })
        )}

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
                  Atendimento veterinário próximo de você
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
    backgroundColor: '#F3F7FB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F7FB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 28,
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
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36,
  },
  chipsScroll: {
    marginBottom: 14,
    marginHorizontal: -4,
  },
  chipsRow: {
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 220,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
  },
  emptyContainer: {
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
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5EEF5',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  helpItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  helpItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  helpItemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  helpItemTextContainer: {
    flex: 1,
  },
  helpItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  helpItemSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  helpItemValue: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  guideCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  guideHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  guideBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  guideIntro: {
    marginTop: 12,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#1E293B',
  },
  warningBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#9A3412',
  },
  tipBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#1E3A8A',
  },
  emptyItemsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  noItemsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  veterinarySection: {
    marginBottom: 8,
    marginTop: 8,
  },
  veterinaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  veterinaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  veterinaryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  veterinaryButtonTextContainer: {
    flex: 1,
  },
  veterinaryButtonTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  veterinaryButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
});
