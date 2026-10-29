/**
 * Perfil (aba "Perfil"): mesmo visual da tela inicial — cabeçalho roxo com a carteirinha,
 * números da pessoa, atalhos da conta em cartões, preferências e a versão real do app instalado.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '../services/AuthService';
import {API_BASE_PATH} from '../config/apiConfig';
import {C, F, planName} from '../theme/home';
import navigateTo from '../navigation/navigateTo';
import {appVersionLabel} from '../utils/appVersion';
import {resetTours} from '../components/Tour';

const fmtDate = d => {
  try {
    return new Date(d).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'});
  } catch {
    return '';
  }
};
const initials = name =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || '🙂';

function Row({icon, title, subtitle, onPress, testID, right, danger}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({pressed}) => [styles.row, pressed && onPress && {backgroundColor: '#FAF9FD'}]} testID={testID}>
      <View style={[styles.rowIcon, danger && {backgroundColor: C.badSoft}]}>
        <Ionicons name={icon} size={20} color={danger ? C.bad : C.primary} />
      </View>
      <View style={{flex: 1}}>
        <Text style={[styles.rowTitle, F.semibold, danger && {color: C.bad}]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, F.regular]}>{subtitle}</Text> : null}
      </View>
      {right !== undefined ? right : <Ionicons name="chevron-forward" size={18} color="#B8B5C6" />}
    </Pressable>
  );
}

function Group({title, children}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{marginTop: 22}}>
      <Text style={[styles.groupTitle, F.bold]}>{title}</Text>
      <View style={styles.card}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen({navigation}) {
  const {user, logout, updateUser} = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled !== false);
  const [locationEnabled, setLocationEnabled] = useState(user?.locationEnabled !== false);
  const [stats, setStats] = useState({donations: 0, adoptions: 0, volunteerHours: 0});
  const [loadingStats, setLoadingStats] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);
  const [membership, setMembership] = useState(null);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
  const go = (screen, params) => navigateTo(navigation, screen, params);

  // Situação da carteirinha: a mesma que o Início já baixou (sem pedir de novo ao servidor)
  const loadMembershipFromHome = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cached = JSON.parse((await AsyncStorage.getItem(`home_cache_v1:${user.id}`)) || 'null');
      setMembership(cached?.membership || null);
    } catch {
      // sem cache: só não mostra a situação
    }
  }, [user?.id]);

  const loadUserProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      const response = await fetch(`${API_BASE_PATH}/user/profile`, {
        method: 'GET',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      });
      if (response.ok) {
        const data = await response.json();
        if (data.avatar) setAvatarUrl(data.avatar);
        if (updateUser) updateUser(data);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  }, [updateUser]);

  const loadUserStats = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      const response = await fetch(`${API_BASE_PATH}/user/stats`, {
        method: 'GET',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      });
      if (response.ok) {
        const data = await response.json();
        setStats({donations: data.donations || 0, adoptions: data.adoptions || 0, volunteerHours: data.volunteerHours || 0});
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Números da pessoa: uma vez por conta (não a cada atualização do perfil)
  useEffect(() => {
    if (user?.id) {
      loadUserStats();
      loadMembershipFromHome();
    } else {
      setLoadingStats(false);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preferências e foto acompanham o usuário salvo
  useEffect(() => {
    if (!user) return;
    if (user.notificationsEnabled !== undefined) setNotificationsEnabled(user.notificationsEnabled);
    if (user.locationEnabled !== undefined) setLocationEnabled(user.locationEnabled);
    setAvatarUrl(user.avatar || null);
  }, [user]);

  // Ao voltar para a aba (ex.: depois de editar o perfil), atualiza dados e carteirinha
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadUserProfile();
      loadMembershipFromHome();
    });
    return unsubscribe;
  }, [navigation, loadUserProfile, loadMembershipFromHome]);

  const savePreferences = async (notifications, location) => {
    try {
      setSavingPreferences(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      const response = await fetch(`${API_BASE_PATH}/user/preferences`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({notificationsEnabled: notifications, locationEnabled: location}),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user && updateUser) updateUser(data.user);
      } else {
        console.error('Erro ao salvar preferências:', response.status);
      }
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleNotificationsToggle = value => {
    setNotificationsEnabled(value);
    savePreferences(value, locationEnabled);
  };
  const handleLocationToggle = value => {
    setLocationEnabled(value);
    savePreferences(notificationsEnabled, value);
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair da sua conta?', [
      {text: 'Cancelar', style: 'cancel'},
      {text: 'Sair', style: 'destructive', onPress: logout},
    ]);
  };

  const active = !!membership?.active;
  const cardLine = !membership
    ? null
    : active
    ? `${planName(membership.planMonths)}${membership.endDate ? ` · válida até ${fmtDate(membership.endDate)}` : ''}`
    : membership.endDate
    ? `Carteirinha vencida em ${fmtDate(membership.endDate)}`
    : 'Você ainda não tem carteirinha';
  const cpf = user?.cpf && /^\d{11}$/.test(String(user.cpf)) && user.cpf !== '00000000000' ? String(user.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : null;
  const versionLabel = appVersionLabel();
  const switchProps = value => ({
    trackColor: {false: '#E5E7EB', true: '#C4B5FD'},
    thumbColor: value ? C.primary : '#F3F4F6',
    disabled: savingPreferences,
  });

  return (
    <View style={{flex: 1, backgroundColor: C.bg}}>
      <StatusBar barStyle="light-content" backgroundColor={C.deep} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 32}}>
        {/* Cabeçalho */}
        <View style={styles.hero}>
          <View style={styles.heroRing} />
          <View style={styles.heroTop}>
            <Pressable onPress={() => go('EditProfile')} style={styles.avatarWrap} testID="foto-perfil">
              {avatarUrl ? (
                <Image source={{uri: avatarUrl}} style={styles.avatar} onError={() => setAvatarUrl(null)} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={[styles.avatarText, F.heavy]}>{user ? initials(user.name) : '🙂'}</Text>
                </View>
              )}
              {user ? (
                <View style={styles.camera}>
                  <Ionicons name="camera" size={13} color={C.deep} />
                </View>
              ) : null}
            </Pressable>
            <View style={{flex: 1}}>
              <Text style={[styles.name, F.heavy]} numberOfLines={1}>
                {user?.name || 'Visitante'}
              </Text>
              <Text style={[styles.email, F.regular]} numberOfLines={1}>
                {user?.email || 'Entre para acessar todos os recursos'}
              </Text>
              {cpf ? <Text style={[styles.email, F.regular]}>CPF {cpf}</Text> : null}
            </View>
          </View>
          {user && cardLine ? (
            <Pressable onPress={() => (active ? go('Cartão') : go('MembershipCheckout'))} style={styles.cardChip} testID="situacao-carteirinha">
              <Ionicons name={active ? 'shield-checkmark' : 'card-outline'} size={16} color={active ? '#BBF7D0' : '#FDE68A'} />
              <Text style={[styles.cardChipText, F.semibold]} numberOfLines={1}>
                {cardLine}
              </Text>
              <Text style={[styles.cardChipCta, F.bold]}>{active ? 'Ver' : 'Ser membro'}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{paddingHorizontal: 16}}>
          {/* Números */}
          {user ? (
            <View style={styles.stats}>
              {[
                ['heart', '#E11D48', stats.donations, 'Doações'],
                ['paw', C.primary, stats.adoptions, 'Adoções'],
                ['time', '#059669', `${stats.volunteerHours}h`, 'Voluntário'],
              ].map(([icon, color, value, label]) => (
                <View key={label} style={styles.stat}>
                  <Ionicons name={icon} size={18} color={color} />
                  {loadingStats ? <ActivityIndicator size="small" color={color} style={{marginTop: 6}} /> : <Text style={[styles.statValue, F.heavy]}>{value}</Text>}
                  <Text style={[styles.statLabel, F.semibold]}>{label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable onPress={() => navigation.navigate('Auth')} style={styles.loginCta} testID="entrar">
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
              <Text style={[styles.loginCtaText, F.bold]}>Entrar ou criar conta</Text>
            </Pressable>
          )}

          {user ? (
            <Group title="Minha conta">
              <Row icon="person-outline" title="Editar perfil" subtitle="Nome, telefone e foto" onPress={() => go('EditProfile')} testID="editar-perfil" />
              <Row icon="card-outline" title="Minha carteirinha" subtitle="QR, plano e validade" onPress={() => go('Cartão')} testID="minha-carteirinha" />
              <Row icon="heart-outline" title="Minhas doações" subtitle="Histórico de contribuições" onPress={() => go('MyDonations')} testID="minhas-doacoes" />
              <Row icon="paw-outline" title="Minhas adoções" subtitle="Acompanhe suas solicitações" onPress={() => go('MyAdoptions')} testID="minhas-adocoes" />
              <Row icon="calendar-outline" title="Meus eventos" subtitle="Inscrições e eventos que participou" onPress={() => go('MyEvents')} testID="meus-eventos" />
            </Group>
          ) : null}

          {user ? (
            <Group title="Mais do app">
              <Row icon="receipt-outline" title="Meus orçamentos" subtitle="Pedidos e propostas dos parceiros" onPress={() => go('QuotesList')} testID="meus-orcamentos" />
              <Row icon="search-outline" title="Meus avisos de achados e perdidos" onPress={() => go('LostFoundMine')} testID="meus-avisos" />
              <Row icon="document-text-outline" title="Nota Fiscal Paulista" subtitle="Doe suas notas para a Liga" onPress={() => go('NotaFiscal')} testID="nota-fiscal" />
              <Row icon="notifications-outline" title="Notificações" subtitle="Ver todas as notificações" onPress={() => go('Notifications')} testID="notificacoes" />
            </Group>
          ) : null}

          {user ? (
            <Group title="Preferências">
              <Row
                icon="notifications"
                title="Notificações push"
                subtitle="Receber alertas no celular"
                right={<Switch value={notificationsEnabled} onValueChange={handleNotificationsToggle} {...switchProps(notificationsEnabled)} testID="pref-notificacoes" />}
              />
              <Row
                icon="location"
                title="Localização"
                subtitle="Parceiros e avisos perto de você"
                right={<Switch value={locationEnabled} onValueChange={handleLocationToggle} {...switchProps(locationEnabled)} testID="pref-localizacao" />}
              />
            </Group>
          ) : null}

          <Group title="Ajuda e informações">
            <Row icon="help-circle-outline" title="Ajuda e suporte" subtitle="Tire suas dúvidas" onPress={() => go('Info')} testID="ajuda" />
            <Row
              icon="bulb-outline"
              title="Rever as dicas do app"
              subtitle="Os balões que explicam cada tela"
              onPress={async () => {
                await resetTours();
                Alert.alert('Pronto!', 'As dicas vão aparecer de novo quando você abrir cada tela.');
              }}
              testID="rever-dicas"
            />
            <Row icon="shield-checkmark-outline" title="Privacidade e termos" onPress={() => go('Legal', {section: 'both'})} testID="privacidade" />
            {isAdmin ? <Row icon="bug-outline" title="Debug e logs" subtitle="Somente administradores" onPress={() => go('Debug')} testID="debug" /> : null}
          </Group>

          {user ? (
            <View style={[styles.card, {marginTop: 22}]}>
              <Row icon="log-out-outline" title="Sair da conta" danger onPress={handleLogout} right={null} testID="sair" />
            </View>
          ) : null}
          {user && !isAdmin ? (
            <Pressable onPress={() => go('DeleteAccount')} style={styles.deleteLink} testID="excluir-conta">
              <Text style={[styles.deleteLinkText, F.semibold]}>Excluir minha conta</Text>
            </Pressable>
          ) : null}

          <View style={styles.footer}>
            <Ionicons name="paw" size={16} color="#B8B5C6" />
            <Text style={[styles.footerText, F.semibold]}>Liga do Bem Botucatu</Text>
            {versionLabel ? (
              <Text style={[styles.version, F.regular]} testID="versao-app">
                {versionLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  deleteLink: {alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16, marginTop: 6},
  deleteLinkText: {fontSize: 13, color: '#9CA3AF', textDecorationLine: 'underline'},
  hero: {
    backgroundColor: C.deep,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroRing: {position: 'absolute', right: -60, top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)'},
  heroTop: {flexDirection: 'row', alignItems: 'center', gap: 14},
  avatarWrap: {width: 72, height: 72},
  avatar: {width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)'},
  avatarEmpty: {backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center'},
  avatarText: {color: '#FFFFFF', fontSize: 24},
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.deep,
  },
  name: {color: '#FFFFFF', fontSize: 21},
  email: {color: C.deepText, fontSize: 13, marginTop: 2},
  cardChip: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardChipText: {flex: 1, color: '#FFFFFF', fontSize: 13},
  cardChipCta: {color: '#FFFFFF', fontSize: 13, textDecorationLine: 'underline'},
  stats: {flexDirection: 'row', gap: 10, marginTop: 16},
  stat: {flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingVertical: 12, alignItems: 'center'},
  statValue: {color: C.ink, fontSize: 20, marginTop: 4},
  statLabel: {color: C.muted, fontSize: 12, marginTop: 1},
  loginCta: {
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginCtaText: {color: '#FFFFFF', fontSize: 15},
  groupTitle: {color: C.muted, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4},
  card: {backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden'},
  divider: {height: 1, backgroundColor: C.line, marginLeft: 62},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 58},
  rowIcon: {width: 36, height: 36, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center'},
  rowTitle: {color: C.ink, fontSize: 15},
  rowSub: {color: C.muted, fontSize: 12, marginTop: 1},
  footer: {alignItems: 'center', marginTop: 28, gap: 2},
  footerText: {color: '#9C98AE', fontSize: 12, marginTop: 4},
  version: {color: '#B8B5C6', fontSize: 12},
});
