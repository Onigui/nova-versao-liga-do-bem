/**
 * Um orçamento: propostas chegando em tempo real (atualiza sozinho enquanto está aberto).
 * "Melhor loja" = a lista inteira num lugar só. "Item a item" = o mais barato de cada item.
 * Reservar gera um código que o caixa da loja confere; o preço vale até a validade.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, AppState, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {brl} from '../utils/priceCompare';
import {toMemberPartner} from '../utils/partnerView';
import {STATUS_LABEL, groupPerItemByStore, memberApi, timeLeft, validLabel} from '../utils/quotes';

const PURPLE = '#8B5CF6';
const POLL_MS = 20000;

function SourceTag({source}) {
  if (!source) return null;
  const quote = source === 'QUOTE';
  return (
    <View style={[styles.tag, {backgroundColor: quote ? '#DCFCE7' : '#F3F4F6'}]}>
      <Text style={[styles.tagText, {color: quote ? '#166534' : '#4B5563'}]}>{quote ? 'PROPOSTA' : 'TABELA'}</Text>
    </View>
  );
}

function ReservationBox({reservation}) {
  if (!reservation || reservation.status === 'CANCELLED') return null;
  const done = reservation.status === 'DONE';
  return (
    <View style={[styles.rsv, done && {backgroundColor: '#F3F4F6', borderColor: '#E5E7EB'}]} testID="reserva">
      <Text style={styles.rsvLabel}>{done ? 'Compra concluída' : 'Reservado · mostre este código no caixa'}</Text>
      <Text style={[styles.rsvCode, done && {color: '#6B7280'}]}>{reservation.code}</Text>
      <Text style={styles.rsvMeta}>
        Total {brl(reservation.total)}
        {reservation.validUntil && !done ? ` · ${validLabel(reservation.validUntil)}` : ''}
      </Text>
    </View>
  );
}

export default function QuoteDetailScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const id = route?.params?.id;
  const [data, setData] = useState(route?.params?.initial || null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('store');
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await api('GET', `/quotes/${id}`);
      setData(d);
      setError('');
    } catch (e) {
      setError(e.status === 404 ? 'Orçamento não encontrado.' : e.message);
    }
  }, [api, id]);

  const open = data?.request?.status === 'OPEN';
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!open) return undefined;
    timer.current = setInterval(load, POLL_MS);
    const sub = AppState.addEventListener?.('change', s => s === 'active' && load());
    return () => {
      clearInterval(timer.current);
      sub?.remove?.();
    };
  }, [open, load]);

  const reserve = async (partnerId, partnerName, requestItemIds) => {
    setBusy(partnerId);
    try {
      await api('POST', `/quotes/${id}/reserve`, {partnerId, requestItemIds});
      await load();
      Alert.alert('Reservado!', `Mostre o código no caixa de ${partnerName}. O preço vale até a validade da proposta.`);
    } catch (e) {
      Alert.alert('Não foi possível reservar', e.message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = () =>
    Alert.alert('Encerrar pedido?', 'As lojas param de receber o pedido. As propostas que já chegaram continuam aqui.', [
      {text: 'Voltar', style: 'cancel'},
      {
        text: 'Encerrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('POST', `/quotes/${id}/cancel`);
            load();
          } catch (e) {
            Alert.alert('Erro', e.message);
          }
        },
      },
    ]);

  if (!data) {
    return error ? (
      <Text style={[styles.error, {margin: 24}]}>{error}</Text>
    ) : (
      <ActivityIndicator style={{marginTop: 40}} color={PURPLE} />
    );
  }

  const {request, items, stores, bestStore, perItem} = data;
  const st = STATUS_LABEL[request.status] || STATUS_LABEL.CLOSED;
  const groups = groupPerItemByStore(perItem, items);
  const savingsVsBest = bestStore && perItem.covered === items.length ? Math.round((bestStore.total - perItem.total) * 100) / 100 : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{padding: 16, paddingBottom: 40}}
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
      <View style={styles.head}>
        <View style={[styles.status, {backgroundColor: st.tone === 'ok' ? '#DCFCE7' : '#F3F4F6'}]}>
          {open ? <View style={styles.liveDot} /> : null}
          <Text style={[styles.statusText, {color: st.tone === 'ok' ? '#166534' : '#4B5563'}]}>{st.text}</Text>
        </View>
        {open ? <Text style={styles.meta}>{timeLeft(request.expiresAt)}</Text> : null}
      </View>
      <Text style={styles.title}>
        {items.length} {items.length === 1 ? 'item' : 'itens'}
        {request.species ? ` · ${request.species}` : ''}
        {request.petWeight ? ` ${request.petWeight} kg` : ''}
      </Text>
      <Text style={styles.meta} testID="contadores">
        {request.targets} {request.targets === 1 ? 'loja avisada' : 'lojas avisadas'} · {request.quotes}{' '}
        {request.quotes === 1 ? 'proposta' : 'propostas'}
        {request.createdByPartnerId ? ' · lista feita pelo veterinário' : ''}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.tabs}>
        {[
          ['store', 'Melhor loja', 'storefront'],
          ['item', 'Item a item', 'list'],
        ].map(([k, label, icon]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)} testID={`aba-${k}`}>
            <Ionicons name={icon} size={16} color={tab === k ? '#FFFFFF' : '#4B5563'} />
            <Text style={[styles.tabText, tab === k && {color: '#FFFFFF'}]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!stores.length ? (
        <View style={styles.empty}>
          <Ionicons name={open ? 'hourglass-outline' : 'pricetags-outline'} size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{open ? 'Aguardando as propostas' : 'Nenhuma loja respondeu'}</Text>
          <Text style={styles.emptyText}>
            {open ? 'Avisamos as lojas agora. Você recebe uma notificação a cada proposta.' : 'Tente de novo com outro prazo ou menos itens.'}
          </Text>
        </View>
      ) : tab === 'store' ? (
        stores.map((s, idx) => {
          const isBest = bestStore?.partnerId === s.partner.id;
          const showLines = expanded === s.partner.id || (expanded == null && idx === 0);
          return (
            <View key={s.partner.id} style={[styles.card, isBest && {borderColor: '#86EFAC'}]} testID={`loja-${s.partner.id}`}>
              <TouchableOpacity onPress={() => setExpanded(showLines ? '' : s.partner.id)} style={styles.cardHead}>
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
                    <Text style={styles.store}>{s.partner.name}</Text>
                    {isBest ? (
                      <View style={[styles.tag, {backgroundColor: '#DCFCE7'}]}>
                        <Text style={[styles.tagText, {color: '#166534'}]}>MELHOR PREÇO</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.meta}>
                    {s.complete ? 'Tem a lista inteira' : `Tem ${s.covered} de ${items.length} itens`}
                    {s.hasQuote ? ` · ${validLabel(s.validUntil)}` : ' · preço de tabela'}
                  </Text>
                </View>
                <Text style={styles.total}>{brl(s.total)}</Text>
                <Ionicons name={showLines ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
              </TouchableOpacity>
              {showLines ? (
                <View style={{marginTop: 8}}>
                  {s.lines.map(l => {
                    const it = items.find(i => i.id === l.requestItemId);
                    return (
                      <View key={l.requestItemId} style={styles.line}>
                        <Text style={styles.lineName} numberOfLines={2}>
                          {it.quantity > 1 ? `${it.quantity}× ` : ''}
                          {it.label}
                          {l.note ? <Text style={styles.lineNote}>{`\n${l.note}`}</Text> : null}
                        </Text>
                        <SourceTag source={l.total != null ? l.source : null} />
                        <Text style={[styles.linePrice, l.total == null && {color: '#9CA3AF'}]}>
                          {l.total != null ? brl(l.total) : l.unavailable ? 'não tem' : '—'}
                        </Text>
                      </View>
                    );
                  })}
                  {s.quoteNote ? <Text style={styles.quoteNote}>“{s.quoteNote}”</Text> : null}
                </View>
              ) : null}
              {s.reservation && s.reservation.status !== 'CANCELLED' ? (
                <ReservationBox reservation={s.reservation} />
              ) : (
                <TouchableOpacity
                  style={[styles.reserve, busy && {opacity: 0.5}]}
                  disabled={!!busy}
                  onPress={() => reserve(s.partner.id, s.partner.name)}
                  testID={`reservar-${s.partner.id}`}>
                  <Text style={styles.reserveText}>
                    {busy === s.partner.id ? 'Reservando…' : s.complete ? 'Reservar a lista aqui' : `Reservar os ${s.covered} itens aqui`}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => navigation.navigate('PartnerDetail', {partner: toMemberPartner(s.partner)})}
                style={{alignSelf: 'center', marginTop: 8}}>
                <Text style={{color: PURPLE, fontWeight: '600', fontSize: 13}}>Ver endereço e horário</Text>
              </TouchableOpacity>
            </View>
          );
        })
      ) : (
        <View>
          <View style={styles.summary} testID="resumo-item">
            <Text style={styles.summaryText}>
              {perItem.covered} de {items.length} itens · em {perItem.stores} {perItem.stores === 1 ? 'loja' : 'lojas'}
            </Text>
            <Text style={styles.summaryTotal}>{brl(perItem.total)}</Text>
            {savingsVsBest > 0 ? (
              <Text style={styles.summarySave}>
                {brl(savingsVsBest)} a menos que a melhor loja, comprando em {perItem.stores} lugares
              </Text>
            ) : null}
          </View>
          {perItem.lines.map(l => {
            const it = items.find(i => i.id === l.requestItemId);
            return (
              <View key={l.requestItemId} style={styles.itemRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.lineName}>
                    {it.quantity > 1 ? `${it.quantity}× ` : ''}
                    {it.label}
                  </Text>
                  <Text style={styles.meta}>{l.best ? l.best.partnerName : 'Nenhuma loja tem ainda'}</Text>
                </View>
                {l.best ? <SourceTag source={l.best.source} /> : null}
                <Text style={styles.linePrice}>{l.best ? brl(l.best.total) : '—'}</Text>
              </View>
            );
          })}
          {groups.map(g => {
            const s = stores.find(x => x.partner.id === g.partnerId);
            const rsv = s?.reservation && s.reservation.status !== 'CANCELLED' ? s.reservation : null;
            return rsv ? (
              <View key={g.partnerId} style={{marginTop: 10}}>
                <Text style={styles.store}>{g.partnerName}</Text>
                <ReservationBox reservation={rsv} />
              </View>
            ) : (
              <TouchableOpacity
                key={g.partnerId}
                style={[styles.reserve, {marginTop: 10}, busy && {opacity: 0.5}]}
                disabled={!!busy}
                onPress={() => reserve(g.partnerId, g.partnerName, g.requestItemIds)}
                testID={`reservar-itens-${g.partnerId}`}>
                <Text style={styles.reserveText}>
                  {busy === g.partnerId ? 'Reservando…' : `Reservar ${g.requestItemIds.length} ${g.requestItemIds.length === 1 ? 'item' : 'itens'} em ${g.partnerName} · ${brl(g.total)}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.footer}>
        PROPOSTA = preço que a loja mandou só para você, às cegas (nenhuma loja vê a proposta da outra). TABELA = preço
        normal de membro da loja. Confirme a disponibilidade antes de ir.
      </Text>
      {open ? (
        <TouchableOpacity onPress={cancel} style={{alignSelf: 'center', marginTop: 16}} testID="encerrar">
          <Text style={{color: '#B91C1C', fontWeight: '600'}}>Encerrar pedido</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F9FAFB'},
  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  status: {flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4},
  statusText: {fontSize: 12, fontWeight: '800'},
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A'},
  title: {fontSize: 20, fontWeight: '800', color: '#1F2937', marginTop: 10},
  meta: {fontSize: 12, color: '#6B7280', marginTop: 2},
  error: {color: '#B91C1C', marginTop: 8},
  tabs: {flexDirection: 'row', gap: 8, marginVertical: 14},
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabActive: {backgroundColor: PURPLE, borderColor: PURPLE},
  tabText: {fontSize: 14, fontWeight: '700', color: '#4B5563'},
  empty: {alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16},
  emptyTitle: {fontSize: 17, fontWeight: '700', color: '#1F2937', marginTop: 12},
  emptyText: {fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6},
  card: {backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: '#F3F4F6'},
  cardHead: {flexDirection: 'row', alignItems: 'center', gap: 8},
  store: {fontSize: 16, fontWeight: '800', color: '#1F2937'},
  total: {fontSize: 19, fontWeight: '800', color: '#6D28D9'},
  tag: {borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2},
  tagText: {fontSize: 9, fontWeight: '800'},
  line: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#F3F4F6'},
  lineName: {flex: 1, fontSize: 14, color: '#374151'},
  lineNote: {fontSize: 12, color: '#6B7280'},
  linePrice: {fontSize: 14, fontWeight: '700', color: '#1F2937', minWidth: 76, textAlign: 'right'},
  quoteNote: {fontSize: 13, color: '#4B5563', fontStyle: 'italic', marginTop: 6},
  reserve: {backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', marginTop: 10},
  reserveText: {color: '#FFFFFF', fontWeight: '800', fontSize: 14, textAlign: 'center'},
  rsv: {backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 10},
  rsvLabel: {fontSize: 12, color: '#5B21B6', fontWeight: '600'},
  rsvCode: {fontSize: 30, fontWeight: '900', letterSpacing: 6, color: '#4C1D95', marginVertical: 4},
  rsvMeta: {fontSize: 12, color: '#6B7280'},
  summary: {backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, alignItems: 'center', marginBottom: 10},
  summaryText: {fontSize: 13, color: '#6B7280'},
  summaryTotal: {fontSize: 26, fontWeight: '900', color: '#6D28D9', marginTop: 2},
  summarySave: {fontSize: 12, color: '#166534', fontWeight: '600', marginTop: 4, textAlign: 'center'},
  itemRow: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 6},
  footer: {fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 16, lineHeight: 16},
});
