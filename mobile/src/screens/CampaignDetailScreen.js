/**
 * Página de uma vaquinha: capa, meta e progresso, história, atualizações da ONG,
 * apoiadores e o botão "Doar para esta vaquinha" (checkout de doação com campaignId).
 */
import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../config/apiConfig';
import {ProgressBar, brl, campaignStatusText} from '../components/CampaignCard';
import {C, F, dateBR} from '../theme/home';

export default function CampaignDetailScreen({route, navigation, fetchImpl = fetch}) {
  const id = route?.params?.campaignId || route?.params?.id;
  const [state, setState] = useState({loading: true});

  const load = useCallback(async () => {
    try {
      const res = await fetchImpl(`${API_BASE_PATH}/campaigns/${encodeURIComponent(id)}`, {
        headers: {'Content-Type': 'application/json'},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível abrir a vaquinha');
      setState({campaign: data.campaign});
    } catch (e) {
      setState(s => (s.campaign ? s : {error: e.message}));
    }
  }, [fetchImpl, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (state.loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }
  if (state.error) {
    return (
      <View style={[styles.container, styles.center, {padding: 24}]}>
        <Ionicons name="alert-circle" size={42} color={C.muted} />
        <Text style={[styles.muted, F.semibold, {marginTop: 10, textAlign: 'center'}]}>{state.error}</Text>
      </View>
    );
  }

  const c = state.campaign;
  const share = () =>
    Share.share({
      message: `${c.title}\n${c.summary || ''}\nFaltam ${brl(c.remaining)} para a meta. Ajude pelo app da ONG!`.trim(),
    }).catch(() => {});

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{paddingBottom: 120}}>
        {c.coverUrl ? (
          <Image source={{uri: c.coverUrl}} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.center]}>
            <Ionicons name="heart" size={48} color={C.primary} />
          </View>
        )}
        <View style={styles.section}>
          <Text style={[styles.title, F.heavy]} testID="vaquinha-titulo">
            {c.title}
          </Text>
          {c.animal?.name ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('AnimalDetail', {animalId: c.animal.id})}
              style={styles.animalRow}
              testID="vaquinha-animal">
              <Ionicons name="paw" size={14} color={C.primary} />
              <Text style={[styles.animalText, F.bold]}>{c.animal.name}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.goalCard}>
            <View style={{flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap'}}>
              <Text style={[styles.raised, F.heavy]} testID="vaquinha-arrecadado">
                {brl(c.raised)}
              </Text>
              <Text style={[styles.muted, F.regular]}> arrecadados de {brl(c.goal)}</Text>
            </View>
            <ProgressBar percent={c.percent} height={10} />
            <View style={styles.statsRow}>
              <Stat label="da meta" value={`${c.percent}%`} />
              <Stat label={c.donorsCount === 1 ? 'doação' : 'doações'} value={String(c.donorsCount)} />
              <Stat label={c.status === 'ENDED' ? 'situação' : 'prazo'} value={campaignStatusText(c)} small />
            </View>
            {c.status === 'ACTIVE' && c.remaining > 0 ? (
              <Text style={[styles.muted, F.semibold, {marginTop: 6}]}>Faltam {brl(c.remaining)} para a meta</Text>
            ) : null}
          </View>

          {c.summary ? <Text style={[styles.summary, F.semibold]}>{c.summary}</Text> : null}
          {c.story ? <Text style={[styles.story, F.regular]}>{c.story}</Text> : null}
        </View>

        {c.updates?.length ? (
          <View style={styles.section}>
            <Text style={[styles.h2, F.heavy]}>Atualizações</Text>
            {c.updates.map(u => (
              <View key={u.id} style={styles.update}>
                <Text style={[styles.updateDate, F.bold]}>{dateBR(u.createdAt)}</Text>
                <Text style={[styles.story, F.regular, {marginTop: 2}]}>{u.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {c.showDonors && c.donors?.length ? (
          <View style={styles.section}>
            <Text style={[styles.h2, F.heavy]}>Quem já ajudou</Text>
            {c.donors.map((d, i) => (
              <View key={i} style={styles.donor}>
                <View style={styles.donorIcon}>
                  <Ionicons name="heart" size={14} color={C.primary} />
                </View>
                <Text style={[styles.donorName, F.semibold]}>{d.name}</Text>
                {d.amount != null ? <Text style={[styles.muted, F.bold]}>{brl(d.amount)}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} onPress={share} accessibilityLabel="Compartilhar" testID="vaquinha-compartilhar">
          <Ionicons name="share-social" size={22} color={C.primary} />
        </TouchableOpacity>
        {c.acceptingDonations ? (
          <TouchableOpacity
            style={styles.donateBtn}
            onPress={() => navigation.navigate('Donation', {campaign: {id: c.id, title: c.title}})}
            testID="vaquinha-doar">
            <Ionicons name="heart" size={18} color="#FFFFFF" />
            <Text style={[styles.donateText, F.heavy]}>Doar para esta vaquinha</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.donateBtn, {backgroundColor: C.line}]} testID="vaquinha-encerrada">
            <Text style={[styles.donateText, F.heavy, {color: C.muted}]}>
              {c.closedReason === 'GOAL' ? 'Meta alcançada. Obrigado!' : 'Vaquinha encerrada'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({label, value, small}) {
  return (
    <View style={{flex: 1}}>
      <Text style={[{fontSize: small ? 13 : 17, color: C.ink}, F.heavy]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[{fontSize: 12, color: C.muted}, F.regular]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bg},
  center: {alignItems: 'center', justifyContent: 'center'},
  cover: {width: '100%', height: 220, backgroundColor: C.primarySoft},
  section: {paddingHorizontal: 16, paddingTop: 16},
  title: {fontSize: 22, color: C.ink},
  animalRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6},
  animalText: {color: C.primary, fontSize: 14},
  goalCard: {backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 14, gap: 8, borderWidth: 1, borderColor: C.line},
  raised: {fontSize: 24, color: C.ink},
  statsRow: {flexDirection: 'row', gap: 10, marginTop: 4},
  muted: {fontSize: 13, color: C.muted},
  summary: {fontSize: 15, color: C.ink, marginTop: 16},
  story: {fontSize: 14, color: '#3F3D56', lineHeight: 21, marginTop: 8},
  h2: {fontSize: 17, color: C.ink, marginBottom: 8},
  update: {borderLeftWidth: 3, borderLeftColor: C.primary, paddingLeft: 10, marginBottom: 12},
  updateDate: {fontSize: 12, color: C.primary},
  donor: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line},
  donorIcon: {width: 28, height: 28, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center'},
  donorName: {flex: 1, fontSize: 14, color: C.ink},
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 14,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line},
  shareBtn: {width: 52, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: C.primarySoft, alignItems: 'center', justifyContent: 'center'},
  donateBtn: {flex: 1, height: 52, borderRadius: 14, backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8},
  donateText: {color: '#FFFFFF', fontSize: 16},
});
