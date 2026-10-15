/**
 * Lista de parceiros do app dos membros: busca, "Perto de mim" (distância pelo GPS),
 * "Aberto agora" e categorias.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../config/apiConfig';
import PartnerListCard from '../components/PartnerListCard';
import {toMemberPartner} from '../utils/partnerView';
import {applyPartnerFilters, availableCategories, categoryFromRoute} from '../utils/partnerFilters';
import useUserLocation from '../services/useUserLocation';
import {useAuth} from '../services/AuthService';
import {F} from '../theme/home';

const CACHE_KEY = 'partners_cache_v2';

function useAuthSafe() {
  try {
    return useAuth();
  } catch {
    return {};
  }
}

export function LocationBanner({status, onRequest, onSettings}) {
  if (status === 'ok') return null;
  if (status === 'locating') {
    return (
      <View style={styles.banner} testID="banner-localizando">
        <ActivityIndicator size="small" color="#7C3AED" />
        <Text style={styles.bannerText}>Buscando sua localização…</Text>
      </View>
    );
  }
  const cfg = {
    blocked: {
      text: 'A localização está bloqueada para o app. Libere nas configurações para ver a distância até cada loja.',
      action: 'Abrir configurações',
      onPress: onSettings,
    },
    off: {
      text: 'O GPS do celular está desligado. Ligue para ver a distância até cada loja.',
      action: 'Ligar GPS',
      onPress: onSettings,
    },
    error: {
      text: 'Não conseguimos sua localização agora.',
      action: 'Tentar de novo',
      onPress: onRequest,
    },
  }[status] || {
    text: 'Permita a localização para ver a distância até cada loja e as mais perto de você.',
    action: 'Permitir',
    onPress: onRequest,
  };
  return (
    <View style={styles.banner} testID={`banner-${status}`}>
      <Ionicons name="navigate-circle" size={26} color="#7C3AED" />
      <Text style={styles.bannerText}>{cfg.text}</Text>
      <TouchableOpacity style={styles.bannerBtn} onPress={cfg.onPress} testID="banner-acao">
        <Text style={styles.bannerBtnText}>{cfg.action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Chip({label, icon, active, onPress, testID}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.filterButton, active && styles.filterButtonActive]}
      onPress={onPress}>
      <Ionicons name={icon} size={16} color={active ? '#FFFFFF' : '#6B7280'} />
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function PartnersScreen({navigation, route}) {
  const {user} = useAuthSafe();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState(
    categoryFromRoute(route?.params?.filter || route?.params?.initialCategory),
  );
  const [openNow, setOpenNow] = useState(false);
  const [nearMe, setNearMe] = useState(true);
  const [now, setNow] = useState(() => new Date());

  // Se o membro desligou "Localização" no perfil, só pede quando ele tocar em "Perto de mim"
  const location = useUserLocation({autoStart: user?.locationEnabled !== false});

  useEffect(() => {
    const next = route?.params?.filter || route?.params?.initialCategory;
    if (next) setCategory(categoryFromRoute(next));
  }, [route?.params?.filter, route?.params?.initialCategory]);

  // "Aberto agora" muda com o relógio
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const loadPartners = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_PATH}/partners`, {
        headers: {'Content-Type': 'application/json'},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const apiData = await response.json();
      const list = (apiData.partners || []).map(p => toMemberPartner(p));
      setPartners(list);
      setLoadError(false);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list)).catch(() => {});
    } catch (error) {
      // Sem internet: mostra a última lista baixada
      try {
        const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || 'null');
        if (Array.isArray(cached) && cached.length) setPartners(cached);
        else setLoadError(true);
      } catch {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Mostra na hora a última lista baixada (se houver) e atualiza em seguida pela internet
    let alive = true;
    AsyncStorage.getItem(CACHE_KEY)
      .then(raw => {
        const cached = JSON.parse(raw || 'null');
        if (alive && Array.isArray(cached) && cached.length) {
          setPartners(prev => (prev.length ? prev : cached));
          setLoading(false);
        }
      })
      .catch(() => {});
    loadPartners();
    return () => {
      alive = false;
    };
  }, [loadPartners]);

  const categories = useMemo(() => availableCategories(partners), [partners]);
  const hasLocation = location.status === 'ok' && !!location.coords;

  const filteredPartners = useMemo(
    () =>
      applyPartnerFilters(partners, {
        query: searchQuery,
        category,
        openNow,
        nearMe: nearMe && hasLocation,
        location: hasLocation ? location.coords : null,
        now,
      }),
    [partners, searchQuery, category, openNow, nearMe, hasLocation, location.coords, now],
  );

  const toggleNearMe = () => {
    if (!hasLocation) {
      setNearMe(true);
      if (location.status === 'blocked' || location.status === 'off') location.openSettings();
      else location.request();
      return;
    }
    setNearMe(v => !v);
  };

  const openMaps = partner => {
    const hasCoords = partner.latitude != null && partner.longitude != null;
    const q = hasCoords
      ? `${partner.latitude},${partner.longitude}(${encodeURIComponent(partner.name)})`
      : encodeURIComponent(`${partner.address}`);
    const url = Platform.select({
      ios: hasCoords
        ? `maps:?q=${encodeURIComponent(partner.name)}&ll=${partner.latitude},${partner.longitude}`
        : `maps:0,0?q=${q}`,
      android: hasCoords ? `geo:${partner.latitude},${partner.longitude}?q=${q}` : `geo:0,0?q=${q}`,
    });
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partner.address)}`),
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPartners();
    location.request();
  };

  const filtersActive = !!searchQuery || category !== 'all' || openNow;

  return (
    <View style={styles.container}>
      {/* Topo roxo com a busca (mesmo visual do Início) */}
      <View style={styles.searchContainer}>
        <Text style={styles.heroTitle}>Parceiros</Text>
        <Text style={styles.heroSub}>
          {partners.length ? `${partners.length} lugares com desconto para membros` : 'Descontos para membros da Liga do Bem'}
        </Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar parceiros..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="busca"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.compareBtn} onPress={() => navigation.navigate('ComparePrices')} testID="comparar-precos">
        <Ionicons name="pricetags" size={18} color="#6D28D9" />
        <Text style={styles.compareText}>Comparar preços de consultas, vacinas e produtos</Text>
        <Ionicons name="chevron-forward" size={18} color="#6D28D9" />
      </TouchableOpacity>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          <Chip
            label="Perto de mim"
            icon="navigate"
            active={nearMe && hasLocation}
            onPress={toggleNearMe}
            testID="filtro-perto"
          />
          <Chip
            label="Aberto agora"
            icon="time"
            active={openNow}
            onPress={() => setOpenNow(v => !v)}
            testID="filtro-aberto"
          />
          <View style={styles.filterDivider} />
          <Chip label="Todos" icon="apps" active={category === 'all'} onPress={() => setCategory('all')} testID="cat-all" />
          {categories.map(c => (
            <Chip
              key={c.id}
              label={c.label}
              icon={c.icon}
              active={category === c.id}
              onPress={() => setCategory(category === c.id ? 'all' : c.id)}
              testID={`cat-${c.id}`}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <LocationBanner status={location.status} onRequest={location.request} onSettings={location.openSettings} />

        {nearMe && hasLocation && filteredPartners.length ? (
          <Text style={styles.listHint}>Ordenado do mais perto para o mais longe</Text>
        ) : null}

        {filteredPartners.map(partner => (
          <PartnerListCard
            key={partner.id}
            partner={partner}
            onPress={() => navigation.navigate('PartnerDetail', {partner})}
            onNavigate={() => openMaps(partner)}
          />
        ))}

        {loading ? (
          <ActivityIndicator style={{marginTop: 40}} color="#6D28D9" />
        ) : filteredPartners.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={loadError ? 'cloud-offline-outline' : 'search-outline'} size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {loadError
                ? 'Não foi possível carregar os parceiros'
                : openNow && !searchQuery && category === 'all'
                  ? 'Nenhum parceiro aberto agora'
                  : 'Nenhum parceiro encontrado'}
            </Text>
            <Text style={styles.emptyText}>
              {loadError ? 'Verifique a internet e puxe a lista para baixo.' : 'Tente ajustar os filtros ou buscar por outro termo'}
            </Text>
            {filtersActive && !loadError ? (
              <TouchableOpacity
                style={[styles.bannerBtn, {marginTop: 16}]}
                onPress={() => {
                  setSearchQuery('');
                  setCategory('all');
                  setOpenNow(false);
                }}>
                <Text style={styles.bannerBtnText}>Limpar filtros</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <View style={{height: 24}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F6F5FB'},
  searchContainer: {
    backgroundColor: '#3B1A78',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 12,
  },
  heroTitle: {...F.heavy, color: '#FFFFFF', fontSize: 26},
  heroSub: {...F.regular, color: '#DDD6FE', fontSize: 13, marginTop: 2, marginBottom: 14},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    ...F.regular, flex: 1, fontSize: 15, color: '#1F2937'},
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compareText: {flex: 1, color: '#5B21B6', ...F.bold, fontSize: 13},
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
  },
  filtersContent: {paddingHorizontal: 16, gap: 6, alignItems: 'center'},
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
    height: 36,
  },
  filterButtonActive: {backgroundColor: '#6D28D9', borderColor: '#6D28D9'},
  filterText: {fontSize: 14, ...F.semibold, color: '#6B7280'},
  filterTextActive: {color: '#FFFFFF'},
  filterDivider: {width: 1, height: 22, backgroundColor: '#E5E7EB', marginHorizontal: 4},
  scrollView: {flex: 1},
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  bannerText: {
    ...F.regular, flex: 1, fontSize: 13, color: '#4C1D95'},
  bannerBtn: {backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8},
  bannerBtnText: {color: '#FFFFFF', ...F.bold, fontSize: 13},
  listHint: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginHorizontal: 16, marginTop: 12},
  emptyState: {alignItems: 'center', justifyContent: 'center', paddingVertical: 80},
  emptyTitle: {fontSize: 18, ...F.semibold, color: '#1F2937', marginTop: 16, marginBottom: 8},
  emptyText: {
    ...F.regular, fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32},
});
