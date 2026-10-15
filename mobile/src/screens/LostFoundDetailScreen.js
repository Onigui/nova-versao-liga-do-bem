/**
 * Aviso de achados e perdidos: fotos, como é o animal, mapa do local, WhatsApp de quem publicou,
 * como chegar e compartilhar. Para quem publicou: possíveis encontros, encerrar, renovar, apagar.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Dimensions, Image, Linking, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {MapFullscreen, MapPreview} from '../components/MapSheet';
import {memberApi} from '../utils/quotes';
import {LF_TYPES, directionsUrl, photoUrl, shareUrl, sizeLabel, speciesLabel, timeAgo, toMarkers, whatsappUrl, whenLabel, withLabel} from '../utils/lostfound';
import {ReportRow} from './LostFoundScreen';
import {F} from '../theme/home';

const W = Dimensions.get('window').width;

export default function LostFoundDetailScreen({navigation, route, fetchImpl = fetch, openUrl = url => Linking.openURL(url), share = opts => Share.share(opts)}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const id = route?.params?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState(null);
  const [flagging, setFlagging] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api('GET', `/lostfound/${id}`);
      setData(d);
      setError('');
      navigation?.setOptions?.({title: LF_TYPES[d.report.type]?.label || 'Aviso'});
      if (d.report.mine && d.report.status === 'ACTIVE') {
        api('GET', `/lostfound/${id}/matches`)
          .then(m => setMatches(m.matches || []))
          .catch(() => {});
      }
    } catch (e) {
      setError(e.status === 404 ? 'Este aviso não está mais disponível.' : e.message);
    }
  }, [api, id, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const act = async (path, method, body, msg) => {
    try {
      const r = await api(method, `/lostfound/${id}${path}`, body);
      if (msg !== false) Alert.alert('Pronto', r.message || msg || 'Feito');
      if (method === 'DELETE') navigation.goBack();
      else load();
    } catch (e) {
      Alert.alert('Não foi possível', e.message);
    }
  };

  const mapMarkers = useMemo(() => (data ? toMarkers([data.report]) : null), [data]);

  if (!data) return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{marginTop: 40}} color="#7C3AED" />;
  const r = data.report;
  const t = LF_TYPES[r.type];
  const closed = r.status !== 'ACTIVE';
  const wa = whatsappUrl(r);

  const facts = [
    ['Espécie', speciesLabel(r.species)],
    ['Cor', r.colors],
    ['Porte', sizeLabel(r.size)],
    ['Sexo', r.sex === 'MACHO' ? 'Macho' : r.sex === 'FEMEA' ? 'Fêmea' : null],
    ['Raça', r.breed],
    ['Coleira', r.hasCollar === true ? 'Com coleira' : r.hasCollar === false ? 'Sem coleira' : null],
    ['Está', r.type === 'FOUND' ? withLabel(r.currentlyWith) : null],
  ].filter(([, v]) => v);

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#F9FAFB'}} contentContainerStyle={{paddingBottom: 40}}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {r.photos.map((p, i) => (
          <Image key={i} source={{uri: photoUrl(p)}} style={{width: W, height: W * 0.8, backgroundColor: '#E5E7EB'}} resizeMode="cover" />
        ))}
      </ScrollView>
      <View style={{padding: 16}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          <View style={[styles.tag, {backgroundColor: t.color}]}>
            <Text style={styles.tagText}>{t.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.meta}>publicado {timeAgo(r.createdAt)}</Text>
          {r.photos.length > 1 ? <Text style={styles.meta}>· {r.photos.length} fotos, deslize</Text> : null}
        </View>
        {closed ? (
          <View style={[styles.closed, r.status === 'RESOLVED' ? {backgroundColor: '#DCFCE7'} : null]} testID="encerrado">
            <Text style={{fontWeight: '800', color: r.status === 'RESOLVED' ? '#166534' : '#4B5563'}}>
              {r.status === 'RESOLVED' ? '💚 Voltou para casa!' : 'Aviso expirado'}
            </Text>
          </View>
        ) : null}
        {r.hidden ? (
          <Text style={[styles.meta, {color: '#B91C1C', marginTop: 6}]}>Este aviso está escondido para revisão da Liga.</Text>
        ) : null}
        <Text style={styles.title}>
          {r.petName ? `${r.petName} · ` : ''}
          {speciesLabel(r.species)} {r.colors}
        </Text>
        <Text style={styles.when}>
          {r.type === 'LOST' ? 'Sumiu' : 'Visto'} em {whenLabel(r.happenedAt)}
          {r.distanceKm != null ? ` · a ${r.distanceKm} km` : ''}
        </Text>

        <View style={styles.facts}>
          {facts.map(([k, v]) => (
            <View key={k} style={styles.fact}>
              <Text style={styles.factK}>{k}</Text>
              <Text style={styles.factV}>{v}</Text>
            </View>
          ))}
        </View>
        {r.description ? <Text style={styles.desc}>{r.description}</Text> : null}

        <Text style={styles.section}>Onde</Text>
        <Text style={styles.place}>
          {[r.locationNote, r.district, r.city].filter(Boolean).join(' · ') || 'Veja no mapa'}
          {r.approximate ? ' (região aproximada)' : ''}
        </Text>
        <MapPreview style={styles.map} center={{lat: r.lat, lng: r.lng}} zoom={16} markers={mapMarkers} onPress={() => setMapOpen(true)} testID="mapa-aviso" />
        <MapFullscreen
          visible={mapOpen}
          onClose={() => setMapOpen(false)}
          title={`${t.label}: ${speciesLabel(r.species)}${r.petName ? ` ${r.petName}` : ''}`}
          subtitle={[r.locationNote, r.district, r.city].filter(Boolean).join(' · ') + (r.approximate ? ' (região aproximada)' : '')}
          center={{lat: r.lat, lng: r.lng}}
          zoom={16}
          markers={mapMarkers}
          testID="mapa-aviso-tela-cheia"
          footer={
            <TouchableOpacity style={styles.mapGo} onPress={() => openUrl(directionsUrl(r))} testID="como-chegar-mapa">
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.mapGoText}>Como chegar</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => openUrl(directionsUrl(r))} testID="como-chegar">
            <Ionicons name="navigate" size={18} color="#7C3AED" />
            <Text style={styles.actionText}>Como chegar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            onPress={() =>
              share({
                message: `${t.label.toUpperCase()}: ${speciesLabel(r.species)}${r.petName ? ` ${r.petName}` : ''}, ${r.colors}. ${[r.locationNote, r.district].filter(Boolean).join(', ')}. Veja a foto e o mapa: ${shareUrl(r.id)}`,
              })
            }
            testID="compartilhar">
            <Ionicons name="share-social" size={18} color="#7C3AED" />
            <Text style={styles.actionText}>Compartilhar</Text>
          </TouchableOpacity>
        </View>

        {!r.mine && !closed ? (
          wa ? (
            <TouchableOpacity style={styles.whats} onPress={() => openUrl(wa)} testID="whatsapp">
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
              <Text style={styles.whatsText}>Falar no WhatsApp com {r.author || 'quem publicou'}</Text>
            </TouchableOpacity>
          ) : data.needsLoginForContact ? (
            <Text style={styles.meta}>Entre na sua conta para ver o contato de quem publicou.</Text>
          ) : null
        ) : null}
        <View style={styles.warn}>
          <Ionicons name="shield-checkmark" size={18} color="#92400E" />
          <Text style={styles.warnText}>Nunca faça PIX ou pagamento para "liberar" ou "devolver" um animal. Na dúvida, combine em local público.</Text>
        </View>

        {r.mine ? (
          <View style={{marginTop: 16}}>
            {matches?.length ? (
              <>
                <Text style={styles.section}>{r.type === 'LOST' ? 'Pode ser o seu?' : 'Pode ser um destes perdidos?'}</Text>
                {matches.map(m => (
                  <ReportRow key={m.id} r={m} onPress={() => navigation.push('LostFoundDetail', {id: m.id})} />
                ))}
              </>
            ) : null}
            {!closed ? (
              <TouchableOpacity
                style={[styles.big, {backgroundColor: '#059669'}]}
                onPress={() =>
                  Alert.alert(r.type === 'LOST' ? 'Ele voltou para casa?' : 'O dono foi encontrado?', 'O aviso sai do mapa e quem ajudou recebe a boa notícia.', [
                    {text: 'Ainda não', style: 'cancel'},
                    {text: 'Sim!', onPress: () => act('/resolve', 'POST', {})},
                  ])
                }
                testID="resolver">
                <Text style={styles.bigText}>{r.type === 'LOST' ? '💚 Encontrei meu pet' : '💚 O dono foi encontrado'}</Text>
              </TouchableOpacity>
            ) : null}
            {r.status !== 'RESOLVED' ? (
              <TouchableOpacity style={styles.link} onPress={() => act('/renew', 'POST', {})} testID="renovar">
                <Text style={styles.linkText}>Renovar por mais 30 dias</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.link}
              onPress={() =>
                Alert.alert('Apagar aviso?', 'Ele sai do mapa e as fotos são apagadas.', [
                  {text: 'Voltar', style: 'cancel'},
                  {text: 'Apagar', style: 'destructive', onPress: () => act('', 'DELETE')},
                ])
              }
              testID="apagar">
              <Text style={[styles.linkText, {color: '#B91C1C'}]}>Apagar aviso</Text>
            </TouchableOpacity>
          </View>
        ) : flagging ? (
          <View style={{marginTop: 16}}>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="O que há de errado? (golpe, falso, ofensivo…)"
              placeholderTextColor="#9CA3AF"
              maxLength={200}
              testID="motivo-denuncia"
            />
            <TouchableOpacity
              style={[styles.big, {backgroundColor: '#B91C1C'}]}
              onPress={async () => {
                await act('/flag', 'POST', {reason});
                setFlagging(false);
              }}
              testID="enviar-denuncia">
              <Text style={styles.bigText}>Enviar denúncia</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.link} onPress={() => setFlagging(true)} testID="denunciar">
            <Text style={[styles.linkText, {color: '#6B7280'}]}>Denunciar aviso</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: {color: '#B91C1C', margin: 24},
  tag: {borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3},
  tagText: {color: '#FFFFFF', ...F.heavy, fontSize: 12},
  meta: {
    ...F.regular, fontSize: 12, color: '#6B7280'},
  closed: {backgroundColor: '#F3F4F6', borderRadius: 10, padding: 10, marginTop: 10},
  title: {fontSize: 22, ...F.heavy, color: '#1F2937', marginTop: 10},
  when: {
    ...F.regular, fontSize: 14, color: '#4B5563', marginTop: 4},
  facts: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12},
  fact: {backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6},
  factK: {fontSize: 10, color: '#6B7280', ...F.bold, textTransform: 'uppercase'},
  factV: {fontSize: 14, color: '#1F2937', ...F.semibold, },
  desc: {
    ...F.regular, fontSize: 15, color: '#374151', marginTop: 12, lineHeight: 21},
  section: {fontSize: 16, ...F.heavy, color: '#1F2937', marginTop: 18, marginBottom: 6},
  place: {
    ...F.regular, fontSize: 14, color: '#374151', marginBottom: 8},
  map: {height: 180, borderRadius: 14},
  mapGo: {height: 50, borderRadius: 14, backgroundColor: '#7C3AED', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center'},
  mapGoText: {color: '#FFFFFF', ...F.heavy, fontSize: 15},
  actions: {flexDirection: 'row', gap: 10, marginTop: 10},
  action: {flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, backgroundColor: '#F5F3FF'},
  actionText: {color: '#6D28D9', ...F.bold, },
  whats: {flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16A34A', height: 54, borderRadius: 14, marginTop: 14},
  whatsText: {color: '#FFFFFF', ...F.heavy, fontSize: 15},
  warn: {flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 10, marginTop: 12},
  warnText: {
    ...F.regular, flex: 1, fontSize: 12, color: '#92400E'},
  big: {height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12},
  bigText: {color: '#FFFFFF', ...F.heavy, fontSize: 16},
  link: {alignSelf: 'center', marginTop: 14},
  linkText: {color: '#7C3AED', ...F.bold, },
  input: {
    ...F.regular, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937'},
});
