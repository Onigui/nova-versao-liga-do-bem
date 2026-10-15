/**
 * Início, estilo app de banco: carteirinha no topo (ou convite para ser membro), atalhos,
 * "Para você" (só o que pede ação), meus pets, promoções perto, próximo evento e adoção.
 * Tudo vem de GET /api/home numa chamada só.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import useUserLocation from '../services/useUserLocation';
import {memberApi} from '../utils/quotes';
import {toMemberPartner} from '../utils/partnerView';
import navigateTo from '../navigation/navigateTo';
import {C, F, HOME_SHORTCUTS, MONTHS_ABBR, dateBR, findService, greeting, money, planName} from '../theme/home';

function useAuthSafe() {
  try {
    return useAuth() || {};
  } catch {
    return {};
  }
}

const FOR_YOU_STYLE = {
  VACCINE: {icon: 'medkit', bg: '#FEF3C7', fg: '#B45309'},
  REVIEW: {icon: 'star', bg: '#FEF3C7', fg: '#B45309'},
  QUOTE: {icon: 'flash', bg: '#EDE9FE', fg: '#6D28D9'},
  LOST: {icon: 'search', bg: '#FFE4E6', fg: '#BE123C'},
  NFP: {icon: 'receipt', bg: '#D1FAE5', fg: '#047857'},
};

const PET_STATUS = {
  LATE: {bg: C.badSoft, fg: C.bad},
  SOON: {bg: C.warnSoft, fg: C.warn},
  OK: {bg: C.okSoft, fg: C.ok},
  NONE: {bg: '#F1F0F6', fg: C.muted},
};

function Section({title, action, onAction, testID}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, F.heavy]}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} testID={testID}>
          <Text style={[styles.link, F.bold]}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function HomeScreen({navigation, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const {user} = useAuthSafe();
  const location = useUserLocation({autoStart: user?.locationEnabled !== false});
  const here = location.coords ? {lat: location.coords.latitude, lng: location.coords.longitude} : null;
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Mostra na hora a última tela salva no aparelho e atualiza por trás
  const cacheKey = `home_cache_v1:${user?.id || 'anon'}`;
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const raw = await AsyncStorage.getItem(cacheKey);
        if (alive && raw) setData(d => d || JSON.parse(raw));
      } catch {
        /* sem cache */
      }
    })();
    return () => {
      alive = false;
    };
  }, [cacheKey]);

  const load = useCallback(async () => {
    try {
      const qs = here ? `?lat=${here.lat.toFixed(4)}&lng=${here.lng.toFixed(4)}` : '';
      const fresh = await api('GET', `/home${qs}`);
      setData(fresh);
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        AsyncStorage.setItem(cacheKey, JSON.stringify(fresh));
      } catch {
        /* sem cache */
      }
    } catch {
      setData(d => d || {offline: true, forYou: [], pets: [], promos: [], counters: {}});
    }
  }, [api, cacheKey, here?.lat, here?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const go = (screen, params) => navigateTo(navigation, screen, params);
  const firstName = data?.user?.firstName || String(user?.name || '').split(' ')[0] || 'tudo bem?';
  const m = data?.membership;
  const active = !!m?.active;
  const expired = m && !m.active && m.status && m.status !== 'PENDING_PAYMENT';
  const unread = data?.counters?.unreadNotifications || 0;
  const shortcuts = [...HOME_SHORTCUTS.map(findService).filter(Boolean), {id: 'tudo', label: 'Ver tudo', icon: 'grid', bg: '#F1F0F6', fg: C.ink, screen: 'Services'}];

  if (!data) {
    return (
      <View style={[styles.container, {alignItems: 'center', justifyContent: 'center'}]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{paddingBottom: 32}}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatar} onPress={() => go('Perfil')} accessibilityLabel="Meu perfil">
          <Text style={[styles.avatarText, F.heavy]}>{(firstName[0] || 'L').toUpperCase()}</Text>
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={[styles.hello, F.regular]}>{greeting()}</Text>
          <Text style={[styles.name, F.heavy]} numberOfLines={1}>
            {firstName}
          </Text>
        </View>
        <TouchableOpacity style={styles.headBtn} onPress={() => go('Services', {focusSearch: true})} accessibilityLabel="Buscar" testID="buscar">
          <Ionicons name="search" size={21} color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headBtn}
          onPress={() => go('Notifications')}
          accessibilityLabel={unread ? `Notificações, ${unread} novas` : 'Notificações'}
          testID="notificacoes">
          <Ionicons name="notifications-outline" size={21} color={C.ink} />
          {unread ? <View style={styles.dot} /> : null}
        </TouchableOpacity>
      </View>

      {/* Carteirinha (o "saldo") ou convite */}
      {active ? (
        <View style={styles.cardDeep} testID="carteirinha">
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, F.semibold]}>CARTEIRINHA LIGA DO BEM</Text>
            <View style={styles.activePill}>
              <Text style={[styles.activePillText, F.heavy]}>ATIVA</Text>
            </View>
          </View>
          <Text style={[styles.cardPlan, F.heavy]}>{planName(m.planMonths)}</Text>
          <Text style={[styles.cardMeta, F.regular]}>
            {m.endDate ? `Válida até ${dateBR(m.endDate)}` : 'Ativa'}
            {m.memberIdMasked ? ` · ID ${m.memberIdMasked}` : ''}
          </Text>
          <View style={{flexDirection: 'row', gap: 10, marginTop: 14}}>
            <TouchableOpacity style={styles.qrBtn} onPress={() => go('Cartão')} testID="mostrar-qr">
              <Ionicons name="qr-code" size={20} color={C.deep} />
              <Text style={[styles.qrBtnText, F.heavy]}>Mostrar QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => go('Parceiros')} testID="beneficios">
              <Text style={[styles.ghostBtnText, F.bold]}>Benefícios</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.cardMeta, F.regular, {marginTop: 12}]}>
            {m.usesThisYear
              ? `Você usou a carteirinha ${m.usesThisYear} ${m.usesThisYear === 1 ? 'vez' : 'vezes'} em ${new Date().getFullYear()}`
              : 'Mostre a carteirinha nos parceiros e aproveite os descontos'}
          </Text>
        </View>
      ) : (
        <View style={styles.invite} testID="convite-membro">
          <Text style={[styles.inviteLabel, F.bold]}>{expired ? 'SUA CARTEIRINHA VENCEU' : 'SEJA MEMBRO DA LIGA DO BEM'}</Text>
          <Text style={[styles.inviteTitle, F.heavy]}>
            {expired ? 'Renove e volte a economizar nos parceiros' : 'Ajude os animais e economize no seu pet'}
          </Text>
          {[
            data.plan?.partners ? `Descontos em ${data.plan.partners} lojas, clínicas e pet shops` : 'Descontos em lojas, clínicas e pet shops parceiros',
            'Eventos especiais só para membros',
            'Sua contribuição cuida dos animais resgatados',
          ].map(p => (
            <View key={p} style={styles.perk}>
              <View style={styles.perkIcon}>
                <Ionicons name="checkmark" size={16} color={C.primary} />
              </View>
              <Text style={[styles.perkText, F.semibold]}>{p}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.cta} onPress={() => go('MembershipCheckout')} testID="quero-ser-membro">
            <Text style={[styles.ctaText, F.heavy]}>
              {expired ? 'Renovar carteirinha' : 'Quero ser membro'}
              {data.plan?.fromPerMonth ? ` · a partir de ${money(data.plan.fromPerMonth)}/mês` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Atalhos */}
      <View style={styles.shortcuts}>
        {shortcuts.map(s => {
          const badge = s.id === 'achados' ? data.counters?.lostFoundNearby : null;
          return (
            <Pressable key={s.id} style={styles.shortcut} onPress={() => go(s.screen)} testID={`atalho-${s.id}`}>
              <View style={[styles.shortcutIcon, {backgroundColor: s.bg}]}>
                <Ionicons name={s.icon} size={24} color={s.fg} />
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={[styles.badgeText, F.heavy]}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.shortcutLabel, F.semibold]} numberOfLines={2}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Para você */}
      {data.forYou?.length ? (
        <>
          <Section title="Para você" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 12, paddingHorizontal: 20}}>
            {data.forYou.map((f, i) => {
              const st = FOR_YOU_STYLE[f.kind] || FOR_YOU_STYLE.QUOTE;
              return (
                <TouchableOpacity
                  key={`${f.kind}-${i}`}
                  style={[styles.forYou, f.urgent && {borderColor: '#FDA4AF'}]}
                  onPress={() => go(f.action.screen, f.action.params)}
                  testID={`para-voce-${f.kind}`}>
                  <View style={[styles.forYouIcon, {backgroundColor: st.bg}]}>
                    <Ionicons name={st.icon} size={20} color={st.fg} />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={[styles.forYouTitle, F.heavy]} numberOfLines={2}>
                      {f.title}
                    </Text>
                    {f.subtitle ? (
                      <Text style={[styles.muted, F.regular]} numberOfLines={1}>
                        {f.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.muted} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {/* Meus pets */}
      <Section title="Meus pets" action={data.pets?.length ? 'Ver todos' : null} onAction={() => go('Pets')} testID="ver-pets" />
      {data.pets?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 12, paddingHorizontal: 20}}>
          {data.pets.map(p => {
            const st = PET_STATUS[p.vaccine?.status] || PET_STATUS.NONE;
            return (
              <TouchableOpacity key={p.id} style={styles.pet} onPress={() => go('VaccinationCard', {petId: p.id})} testID={`pet-${p.id}`}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                  {p.photo ? (
                    <Image source={{uri: p.photo}} style={styles.petAvatar} />
                  ) : (
                    <View style={[styles.petAvatar, {backgroundColor: C.primarySoft}]}>
                      <Text style={[{color: C.primary, fontSize: 17}, F.heavy]}>{(p.name || '?')[0]}</Text>
                    </View>
                  )}
                  <View style={{flex: 1}}>
                    <Text style={[styles.petName, F.heavy]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.muted, F.regular]} numberOfLines={1}>
                      {[p.species, p.breed].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
                <View style={[styles.petStatus, {backgroundColor: st.bg}]}>
                  <Text style={[{color: st.fg, fontSize: 12}, F.bold]} numberOfLines={1}>
                    {p.vaccine?.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.addPet} onPress={() => go('AddPet')} accessibilityLabel="Adicionar pet" testID="adicionar-pet">
            <Ionicons name="add" size={26} color={C.primary} />
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <TouchableOpacity style={[styles.row, {marginHorizontal: 20}]} onPress={() => go('AddPet')} testID="cadastrar-pet">
          <View style={[styles.rowIcon, {backgroundColor: '#CCFBF1'}]}>
            <Ionicons name="medkit" size={22} color="#0F766E" />
          </View>
          <View style={{flex: 1}}>
            <Text style={[styles.rowTitle, F.heavy]}>Carteira de vacinação digital</Text>
            <Text style={[styles.muted, F.regular]}>Grátis para todos, carimbada pelo veterinário</Text>
          </View>
          <Text style={[styles.link, F.bold]}>Criar</Text>
        </TouchableOpacity>
      )}

      {/* Promoções perto */}
      {data.promos?.length ? (
        <>
          <Section title={here ? 'Promoções perto de você' : 'Promoções para membros'} action="Ver todas" onAction={() => go('Parceiros')} testID="ver-promocoes" />
          <View style={{gap: 10, paddingHorizontal: 20}}>
            {data.promos.map(p => (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => go('PartnerDetail', {partner: toMemberPartner(p, p.discounts)})} testID={`promo-${p.id}`}>
                {p.logo ? (
                  <Image source={{uri: p.logo}} style={styles.promoLogo} />
                ) : (
                  <View style={[styles.promoLogo, {backgroundColor: '#F5F3FF'}]}>
                    <Text style={[{color: C.primary, fontSize: 18}, F.heavy]}>{(p.name || '?')[0]}</Text>
                  </View>
                )}
                <View style={{flex: 1, minWidth: 0}}>
                  <Text style={[styles.rowTitle, F.heavy]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[styles.muted, F.regular]} numberOfLines={1}>
                    {[p.category, p.distanceKm != null ? (p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${String(p.distanceKm).replace('.', ',')} km`) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={[styles.promoBadge, !active && {backgroundColor: C.primarySoft}]}>
                  <Text style={[{color: active ? '#FFFFFF' : '#4C1D95', fontSize: 12}, F.heavy]}>{p.badge}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {/* Evento e adoção */}
      <View style={styles.grid2}>
        <TouchableOpacity style={styles.tile} onPress={() => go('EventsCalendar')} testID="proximo-evento">
          {data.nextEvent ? (
            <>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <View style={styles.dateBox}>
                  <Text style={[{color: '#9D174D', fontSize: 17}, F.heavy]}>{new Date(data.nextEvent.startDate).getDate()}</Text>
                  <Text style={[{color: '#9D174D', fontSize: 10}, F.heavy]}>{MONTHS_ABBR[new Date(data.nextEvent.startDate).getMonth()]}</Text>
                </View>
                <Text style={[styles.muted, F.semibold]}>Próximo evento</Text>
              </View>
              <Text style={[styles.tileTitle, F.heavy]} numberOfLines={2}>
                {data.nextEvent.title}
              </Text>
              <Text style={[styles.link, F.bold, {fontSize: 13}]}>Quero ir →</Text>
            </>
          ) : (
            <>
              <View style={[styles.rowIcon, {backgroundColor: '#FCE7F3'}]}>
                <Ionicons name="calendar" size={22} color="#9D174D" />
              </View>
              <Text style={[styles.tileTitle, F.heavy]}>Eventos</Text>
              <Text style={[styles.muted, F.regular]}>Fique de olho na agenda</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tile} onPress={() => go('Adoções')} testID="adocao">
          <View style={[styles.rowIcon, {backgroundColor: C.okSoft}]}>
            <Ionicons name="paw" size={22} color="#15803D" />
          </View>
          <Text style={[styles.tileTitle, F.heavy]} numberOfLines={2}>
            {data.adoption?.available ? `${data.adoption.available} ${data.adoption.available === 1 ? 'amigo esperando' : 'amigos esperando'} um lar` : 'Adoção'}
          </Text>
          <Text style={[styles.link, F.bold, {fontSize: 13}]}>Conhecer →</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.row, {marginHorizontal: 20, marginTop: 12}]} onPress={() => go('Transparency')} testID="transparencia">
        <View style={[styles.rowIcon, {backgroundColor: '#E0F2FE'}]}>
          <Ionicons name="stats-chart" size={20} color="#0369A1" />
        </View>
        <View style={{flex: 1}}>
          <Text style={[styles.rowTitle, F.heavy]}>Transparência</Text>
          <Text style={[styles.muted, F.regular]}>Veja como cada real é usado</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={C.muted} />
      </TouchableOpacity>

      {data.offline ? <Text style={[styles.offline, F.regular]}>Sem conexão. Puxe para atualizar.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bg},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8},
  avatar: {width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center'},
  avatarText: {color: C.primary, fontSize: 18},
  hello: {fontSize: 13, color: C.muted},
  name: {fontSize: 18, color: C.ink},
  headBtn: {width: 44, height: 44, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center'},
  dot: {position: 'absolute', top: 9, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: '#DB2777', borderWidth: 2, borderColor: '#FFFFFF'},
  cardDeep: {marginHorizontal: 20, marginTop: 12, borderRadius: 24, backgroundColor: C.deep, padding: 20, overflow: 'hidden'},
  circle1: {position: 'absolute', right: -40, top: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.07)'},
  circle2: {position: 'absolute', right: 40, bottom: -60, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)'},
  rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  cardLabel: {fontSize: 12, color: C.deepText, letterSpacing: 0.5},
  activePill: {backgroundColor: '#A7F3D0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4},
  activePillText: {fontSize: 11, color: '#064E3B'},
  cardPlan: {fontSize: 26, color: '#FFFFFF', marginTop: 14},
  cardMeta: {fontSize: 13, color: C.deepText, marginTop: 2},
  qrBtn: {flex: 1, height: 48, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8},
  qrBtnText: {color: C.deep, fontSize: 15},
  ghostBtn: {height: 48, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center'},
  ghostBtnText: {color: '#FFFFFF', fontSize: 15},
  invite: {marginHorizontal: 20, marginTop: 12, borderRadius: 24, backgroundColor: C.card, padding: 20, borderWidth: 2, borderColor: '#DDD6FE', gap: 10},
  inviteLabel: {fontSize: 12, color: C.primary, letterSpacing: 0.5},
  inviteTitle: {fontSize: 21, color: C.ink, lineHeight: 27},
  perk: {flexDirection: 'row', alignItems: 'center', gap: 10},
  perkIcon: {width: 28, height: 28, borderRadius: 9, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center'},
  perkText: {flex: 1, fontSize: 14, color: C.ink},
  cta: {height: 52, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4, paddingHorizontal: 12},
  ctaText: {color: '#FFFFFF', fontSize: 15, textAlign: 'center'},
  shortcuts: {marginHorizontal: 20, marginTop: 20, backgroundColor: C.card, borderRadius: 22, paddingTop: 16, paddingHorizontal: 6, paddingBottom: 6, flexDirection: 'row', flexWrap: 'wrap'},
  shortcut: {width: '25%', alignItems: 'center', paddingBottom: 10, paddingHorizontal: 2},
  shortcutIcon: {width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  shortcutLabel: {fontSize: 12, color: C.ink, textAlign: 'center', marginTop: 6, lineHeight: 15},
  badge: {position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DB2777', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#FFFFFF'},
  badgeText: {color: '#FFFFFF', fontSize: 10},
  sectionRow: {flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 26, marginBottom: 12},
  sectionTitle: {fontSize: 18, color: C.ink},
  link: {color: C.primary, fontSize: 14},
  muted: {fontSize: 12, color: C.muted},
  forYou: {width: 280, backgroundColor: C.card, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: 'transparent'},
  forYouIcon: {width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  forYouTitle: {fontSize: 15, color: C.ink},
  pet: {width: 170, backgroundColor: C.card, borderRadius: 20, padding: 14, gap: 10},
  petAvatar: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
  petName: {fontSize: 15, color: C.ink},
  petStatus: {alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '100%'},
  addPet: {width: 64, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: '#C4B5FD', alignItems: 'center', justifyContent: 'center'},
  row: {backgroundColor: C.card, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12},
  rowIcon: {width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  rowTitle: {fontSize: 15, color: C.ink},
  promoLogo: {width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  promoBadge: {backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6},
  grid2: {flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 26},
  tile: {flex: 1, backgroundColor: C.card, borderRadius: 20, padding: 14, gap: 8},
  tileTitle: {fontSize: 14, color: C.ink},
  dateBox: {width: 44, height: 48, borderRadius: 12, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center'},
  offline: {textAlign: 'center', color: C.muted, marginTop: 16},
});
