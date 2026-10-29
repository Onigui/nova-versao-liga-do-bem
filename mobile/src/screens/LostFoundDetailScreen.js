/**
 * Caso de achados e perdidos: fotos, como é o animal, situação atual ("visto há 2 h"), trajeto no
 * mapa, linha do tempo dos avistamentos, WhatsApp de quem publicou, como chegar e compartilhar.
 * Qualquer pessoa pode registrar "Vi este animal" (com foto). Para quem publicou: possíveis
 * encontros, tirar avistamento errado, encerrar, renovar, apagar.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Dimensions, Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {MapFullscreen, MapPreview} from '../components/MapSheet';
import {memberApi} from '../utils/quotes';
import {LF_TYPES, SIGHTING_KINDS, caseSituation, caseTrack, directionsUrl, distanceLabel, photoUrl, shareUrl, sizeLabel, speciesLabel, timeAgo, whatsappUrl, whenLabel, withLabel} from '../utils/lostfound';
import {ReportRow} from './LostFoundScreen';
import {F} from '../theme/home';

const W = Dimensions.get('window').width;

function TimelineItem({color, icon, title, when, place, note, photo, number, first, last, onRemove, testID}) {
  return (
    <View style={styles.tlRow} testID={testID}>
      <View style={styles.tlRail}>
        <View style={[styles.tlDot, {backgroundColor: color}]}>
          {number ? <Text style={styles.tlNum}>{number}</Text> : <Ionicons name={icon} size={12} color="#FFFFFF" />}
        </View>
        {!last ? <View style={styles.tlLine} /> : null}
      </View>
      <View style={[styles.tlBody, !last && {paddingBottom: 16}]}>
        <Text style={styles.tlTitle}>{title}</Text>
        <Text style={styles.meta}>
          {whenLabel(when)} · {timeAgo(when)}
          {place ? ` · ${place}` : ''}
        </Text>
        {note ? <Text style={styles.tlNote}>{note}</Text> : null}
        {photo && !first ? <Image source={{uri: photoUrl(photo)}} style={styles.tlPhoto} /> : null}
        {onRemove ? (
          <TouchableOpacity onPress={onRemove} style={{marginTop: 6}} testID={`${testID}-tirar`}>
            <Text style={[styles.meta, {color: '#B91C1C'}]}>Não é este animal / tirar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function LostFoundDetailScreen({navigation, route, fetchImpl = fetch, openUrl = url => Linking.openURL(url), share = opts => Share.share(opts)}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const id = route?.params?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState(null);
  const [flagging, setFlagging] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [reason, setReason] = useState('');

  const [merges, setMerges] = useState([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeCands, setMergeCands] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api('GET', `/lostfound/${id}`);
      if (d.redirectTo) {
        // Caso unificado: abre o caso que ficou
        navigation.replace('LostFoundDetail', {id: d.redirectTo, mergedFrom: id});
        return;
      }
      setData(d);
      if (d.pendingMerges) {
        api('GET', `/lostfound/${id}/merges`)
          .then(m => setMerges(m.merges || []))
          .catch(() => {});
      } else {
        setMerges([]);
      }
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
      if (method === 'DELETE' && !path) navigation.goBack();
      else load();
    } catch (e) {
      Alert.alert('Não foi possível', e.message);
    }
  };

  const decideMerge = (m, ok) =>
    Alert.alert(
      ok ? 'É o mesmo animal?' : 'Não é o mesmo animal?',
      ok ? 'Os dois avisos viram um caso só: fotos, trajeto, conversa e quem acompanha vão juntos.' : 'Os avisos continuam separados.',
      [
        {text: 'Voltar', style: 'cancel'},
        {
          text: ok ? 'Sim, é o mesmo' : 'Não é',
          onPress: async () => {
            try {
              const r2 = await api('POST', `/lostfound/merges/${m.id}/${ok ? 'confirm' : 'reject'}`, {});
              Alert.alert('Pronto', r2.message);
              if (r2.targetId && r2.targetId !== id) navigation.replace('LostFoundDetail', {id: r2.targetId});
              else load();
            } catch (e) {
              Alert.alert('Não foi possível', e.message);
            }
          },
        },
      ],
    );

  const openMergePicker = async () => {
    setMergeOpen(true);
    setMergeCands(null);
    try {
      const r0 = data.report;
      const d = await api('POST', '/lostfound/similar', {
        species: r0.species,
        lat: r0.lastSeen?.lat ?? r0.lat,
        lng: r0.lastSeen?.lng ?? r0.lng,
        colors: r0.colors,
        size: r0.size,
        sex: r0.sex,
        breed: r0.breed,
        happenedAt: r0.lastSeen?.at || r0.happenedAt,
      });
      setMergeCands((d.similar || []).filter(c => c.id !== id));
    } catch {
      setMergeCands([]);
    }
  };

  const suggestMerge = other =>
    Alert.alert('Sugerir que é o mesmo animal?', 'Quem conhece o animal (o tutor ou quem publicou) confere as fotos e confirma.', [
      {text: 'Voltar', style: 'cancel'},
      {
        text: 'Sugerir',
        onPress: async () => {
          try {
            const r2 = await api('POST', `/lostfound/${id}/merge`, {otherId: other.id});
            setMergeOpen(false);
            Alert.alert('Obrigado!', r2.message);
            if (r2.targetId && r2.targetId !== id) navigation.replace('LostFoundDetail', {id: r2.targetId});
            else load();
          } catch (e) {
            Alert.alert('Não foi possível', e.message);
          }
        },
      },
    ]);

  // Trajeto: 1 = onde o caso começou, depois cada avistamento em ordem
  const trail = useMemo(() => (data ? caseTrack(data.report, data.timeline) : {markers: null, track: null}), [data]);
  const mapMarkers = trail.markers;

  if (!data) return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{marginTop: 40}} color="#7C3AED" />;
  const r = data.report;
  const t = LF_TYPES[r.type];
  const closed = r.status !== 'ACTIVE';
  const wa = whatsappUrl(r);
  const timeline = data.timeline || [];
  const situation = caseSituation(r);
  const lastPoint = r.lastSeen || {lat: r.lat, lng: r.lng};

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
        {route?.params?.mergedFrom ? (
          <View style={styles.mergedNote} testID="unificado">
            <Ionicons name="git-merge" size={16} color="#6D28D9" />
            <Text style={styles.mergedNoteText}>O aviso que você abriu foi unificado com este caso. Está tudo aqui.</Text>
          </View>
        ) : null}
        {merges.map(m => {
          const other = m.source.id === id ? m.target : m.source;
          return (
            <View key={m.id} style={styles.mergeCard} testID={`sugestao-${m.id}`}>
              <Text style={styles.mergeTitle}>🔗 Pode ser o mesmo animal?</Text>
              <Text style={styles.meta}>{m.auto ? 'Achamos outro aviso muito parecido.' : 'Alguém achou outro aviso muito parecido.'}{m.note ? ` "${m.note}"` : ''}</Text>
              <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
                {[r, other].map((x, i) => (
                  <Pressable key={x.id} style={{flex: 1}} onPress={() => (i ? navigation.push('LostFoundDetail', {id: x.id}) : null)} testID={i ? `ver-outro-${m.id}` : undefined}>
                    {x.photos?.[0] ? <Image source={{uri: photoUrl(x.photos[0])}} style={styles.mergeImg} /> : <View style={[styles.mergeImg, {backgroundColor: '#E5E7EB'}]} />}
                    <Text style={styles.mergeCap} numberOfLines={2}>
                      {i ? 'Outro aviso' : 'Este caso'} · {LF_TYPES[x.type]?.label} · {x.colors}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {m.canConfirm ? (
                <View style={{flexDirection: 'row', gap: 8, marginTop: 10}}>
                  <TouchableOpacity style={[styles.mergeBtn, {backgroundColor: '#F3F4F6'}]} onPress={() => decideMerge(m, false)} testID={`nao-e-${m.id}`}>
                    <Text style={[styles.mergeBtnText, {color: '#374151'}]}>Não é</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.mergeBtn, {backgroundColor: '#6D28D9'}]} onPress={() => decideMerge(m, true)} testID={`sim-e-${m.id}`}>
                    <Text style={styles.mergeBtnText}>Sim, é o mesmo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.meta, {marginTop: 8}]}>Aguardando a confirmação de {m.waitingFor} (ou da Liga).</Text>
              )}
            </View>
          );
        })}
        <Text style={styles.title}>
          {r.petName ? `${r.petName} · ` : ''}
          {speciesLabel(r.species)} {r.colors}
        </Text>
        <Text style={styles.when}>
          {r.type === 'LOST' ? 'Sumiu' : 'Visto'} em {whenLabel(r.happenedAt)}
          {r.distanceKm != null ? ` · a ${r.distanceKm} km` : ''}
        </Text>

        {situation && r.status === 'ACTIVE' ? (
          <View style={[styles.situation, {borderColor: situation.color}]} testID="situacao">
            <Ionicons name={situation.icon || 'eye'} size={16} color={situation.color} />
            <Text style={[styles.situationText, {color: situation.color}]}>{situation.text}</Text>
            {r.sightings ? <Text style={styles.meta}>· {r.sightings} {r.sightings === 1 ? 'avistamento' : 'avistamentos'}</Text> : null}
          </View>
        ) : null}

        <View style={styles.facts}>
          {facts.map(([k, v]) => (
            <View key={k} style={styles.fact}>
              <Text style={styles.factK}>{k}</Text>
              <Text style={styles.factV}>{v}</Text>
            </View>
          ))}
        </View>
        {r.description ? <Text style={styles.desc}>{r.description}</Text> : null}

        <Text style={styles.section}>{timeline.length ? 'Por onde passou' : 'Onde'}</Text>
        <Text style={styles.place}>
          {[r.locationNote, r.district, r.city].filter(Boolean).join(' · ') || 'Veja no mapa'}
          {r.approximate ? ' (região aproximada)' : ''}
        </Text>
        <MapPreview style={styles.map} center={lastPoint} zoom={16} markers={mapMarkers} track={trail.track} onPress={() => setMapOpen(true)} testID="mapa-aviso" />
        <MapFullscreen
          visible={mapOpen}
          onClose={() => setMapOpen(false)}
          title={`${t.label}: ${speciesLabel(r.species)}${r.petName ? ` ${r.petName}` : ''}`}
          subtitle={[r.locationNote, r.district, r.city].filter(Boolean).join(' · ') + (r.approximate ? ' (região aproximada)' : '')}
          center={lastPoint}
          zoom={16}
          markers={mapMarkers}
          track={trail.track}
          testID="mapa-aviso-tela-cheia"
          footer={
            <TouchableOpacity style={styles.mapGo} onPress={() => openUrl(directionsUrl(lastPoint))} testID="como-chegar-mapa">
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <Text style={styles.mapGoText}>Como chegar</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => openUrl(directionsUrl(lastPoint))} testID="como-chegar">
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

        {!closed && !r.hidden ? (
          <TouchableOpacity
            style={[styles.big, {backgroundColor: '#D97706'}]}
            onPress={() => navigation.navigate('LostFoundSighting', {report: r})}
            testID="vi-este-animal">
            <Text style={styles.bigText}>👀 Vi este animal</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.socialRow}>
          <TouchableOpacity
            style={[styles.social, data.following && styles.socialOn]}
            onPress={async () => {
              const on = !data.following;
              setData(d => ({...d, following: on}));
              try {
                await api(on ? 'POST' : 'DELETE', `/lostfound/${id}/follow`);
              } catch (e) {
                setData(d => ({...d, following: !on}));
                Alert.alert('Não foi possível', e.message);
              }
            }}
            testID="acompanhar">
            <Ionicons name={data.following ? 'notifications' : 'notifications-outline'} size={18} color={data.following ? '#FFFFFF' : '#6D28D9'} />
            <Text style={[styles.socialText, data.following && {color: '#FFFFFF'}]}>{data.following ? 'Acompanhando' : 'Acompanhar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.social}
            onPress={() => navigation.navigate('LostFoundComments', {id: r.id, title: r.petName || speciesLabel(r.species)})}
            testID="abrir-conversa">
            <Ionicons name="chatbubbles-outline" size={18} color="#6D28D9" />
            <Text style={styles.socialText}>Conversa{data.commentsCount ? ` (${data.commentsCount})` : ''}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Linha do tempo</Text>
        <View style={styles.tl} testID="linha-do-tempo">
          <TimelineItem
            first
            color={t.color}
            icon={t.icon}
            title={r.type === 'LOST' ? `Perdido${r.author ? ` · ${r.author}` : ''}` : r.type === 'FOUND' ? `Encontrado por ${r.author || 'alguém'}` : `Visto solto por ${r.author || 'alguém'}`}
            when={r.happenedAt}
            place={[r.locationNote, r.district].filter(Boolean).join(' · ')}
            photo={r.photos[0]}
            last={!timeline.length}
          />
          {timeline.map((s, i) => {
            const k = SIGHTING_KINDS[s.kind] || SIGHTING_KINDS.SEEN;
            return (
              <TimelineItem
                key={s.id}
                color={k.color}
                icon={k.icon}
                title={`${k.label} · ${s.author || 'alguém'}`}
                when={s.happenedAt}
                place={[s.locationNote, s.district].filter(Boolean).join(' · ') + (s.approximate ? ' (região aproximada)' : '')}
                note={s.note}
                photo={s.photo}
                number={i + 2}
                last={i === timeline.length - 1}
                onRemove={
                  s.canRemove
                    ? () =>
                        Alert.alert(
                          s.mine ? 'Tirar seu avistamento?' : 'Não é este animal?',
                          'O avistamento sai da linha do tempo e do mapa.',
                          [
                            {text: 'Voltar', style: 'cancel'},
                            {text: 'Tirar', style: 'destructive', onPress: () => act(`/sightings/${s.id}`, 'DELETE', undefined, false)},
                          ],
                        )
                    : null
                }
                testID={`avistamento-${s.id}`}
              />
            );
          })}
        </View>
        {!timeline.length && !closed ? <Text style={styles.meta}>Viu este animal? Toque em "Vi este animal" para ajudar a montar o trajeto.</Text> : null}

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

        {!closed && !r.hidden ? (
          <TouchableOpacity style={styles.link} onPress={openMergePicker} testID="mesmo-animal">
            <Text style={styles.linkText}>🔗 Acho que é o mesmo animal de outro aviso</Text>
          </TouchableOpacity>
        ) : null}
        <Modal visible={mergeOpen} transparent animationType="slide" onRequestClose={() => setMergeOpen(false)}>
          <Pressable style={styles.sheetBg} onPress={() => setMergeOpen(false)} />
          <View style={styles.sheet} testID="escolher-outro-aviso">
            <Text style={styles.mergeTitle}>Qual é o outro aviso?</Text>
            <Text style={styles.meta}>Avisos parecidos por perto. Compare as fotos: quem conhece o animal confirma antes de juntar.</Text>
            {!mergeCands ? (
              <ActivityIndicator style={{marginVertical: 24}} color="#6D28D9" />
            ) : !mergeCands.length ? (
              <Text style={[styles.meta, {marginVertical: 20}]}>Não achamos avisos parecidos por perto.</Text>
            ) : (
              <ScrollView style={{maxHeight: 360, marginTop: 10}}>
                {mergeCands.map(c => (
                  <View key={c.id} style={styles.candRow}>
                    {c.photos?.[0] ? <Image source={{uri: photoUrl(c.photos[0])}} style={styles.candImg} /> : <View style={[styles.candImg, {backgroundColor: '#E5E7EB'}]} />}
                    <View style={{flex: 1}}>
                      <Text style={[styles.meta, {color: LF_TYPES[c.type]?.color, fontWeight: '800'}]}>{LF_TYPES[c.type]?.label.toUpperCase()}</Text>
                      <Text style={styles.candTitle} numberOfLines={2}>
                        {c.petName ? `${c.petName} · ` : ''}
                        {c.colors}
                      </Text>
                      <Text style={styles.meta}>{[distanceLabel(c.distanceKm), timeAgo(c.happenedAt)].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <TouchableOpacity style={styles.candBtn} onPress={() => suggestMerge(c)} testID={`e-o-mesmo-${c.id}`}>
                      <Text style={styles.candBtnText}>É este</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.big, {backgroundColor: '#F3F4F6'}]} onPress={() => setMergeOpen(false)}>
              <Text style={[styles.bigText, {color: '#374151'}]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </Modal>

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
  mergedNote: {flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 10, padding: 10, marginTop: 10},
  mergedNoteText: {flex: 1, fontSize: 13, ...F.semibold, color: '#5B21B6'},
  mergeCard: {backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1.5, borderColor: '#C4B5FD', padding: 12, marginTop: 12},
  mergeTitle: {fontSize: 16, ...F.heavy, color: '#1F2937', marginBottom: 2},
  mergeImg: {width: '100%', height: 120, borderRadius: 10},
  mergeCap: {fontSize: 12, ...F.semibold, color: '#374151', marginTop: 4},
  mergeBtn: {flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  mergeBtnText: {color: '#FFFFFF', ...F.heavy, fontSize: 14},
  sheetBg: {flex: 1, backgroundColor: 'rgba(15,23,42,0.45)'},
  sheet: {backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 24},
  candRow: {flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 8, marginBottom: 8},
  candImg: {width: 64, height: 64, borderRadius: 10},
  candTitle: {fontSize: 14, ...F.bold, color: '#1F2937'},
  candBtn: {backgroundColor: '#6D28D9', borderRadius: 10, paddingHorizontal: 12, height: 38, alignItems: 'center', justifyContent: 'center'},
  candBtnText: {color: '#FFFFFF', ...F.heavy, fontSize: 13},
  socialRow: {flexDirection: 'row', gap: 10, marginTop: 12},
  social: {flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#6D28D9', backgroundColor: '#FFFFFF'},
  socialOn: {backgroundColor: '#6D28D9'},
  socialText: {color: '#6D28D9', ...F.bold, fontSize: 14},
  situation: {flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, backgroundColor: '#FFFFFF'},
  situationText: {fontSize: 13, ...F.bold},
  tl: {backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12},
  tlRow: {flexDirection: 'row', gap: 10},
  tlRail: {alignItems: 'center', width: 24},
  tlDot: {width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  tlNum: {color: '#FFFFFF', fontSize: 12, ...F.heavy},
  tlLine: {flex: 1, width: 2, backgroundColor: '#E5E7EB', marginTop: 2},
  tlBody: {flex: 1},
  tlTitle: {fontSize: 14, ...F.bold, color: '#1F2937'},
  tlNote: {fontSize: 14, ...F.regular, color: '#374151', marginTop: 4},
  tlPhoto: {width: '100%', height: 160, borderRadius: 10, marginTop: 8, backgroundColor: '#E5E7EB'},
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
