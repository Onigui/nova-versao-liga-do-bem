/**
 * Achados e perdidos: mapa da cidade com os animais perdidos, encontrados e vistos soltos.
 * Lista por proximidade, filtros, alertas por perto e "Publicar aviso".
 */
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LeafletMap from '../components/LeafletMap';
import useUserLocation from '../services/useUserLocation';
import {memberApi} from '../utils/quotes';
import {LF_TYPES, distanceLabel, photoUrl, speciesLabel, timeAgo, toMarkers} from '../utils/lostfound';
import {F} from '../theme/home';
import {useTour} from '../components/Tour';
import {TOURS} from '../tours';

const PURPLE = '#7C3AED';
const FILTERS = [
  {id: null, label: 'Todos'},
  {id: 'LOST', label: 'Perdidos'},
  {id: 'FOUND', label: 'Encontrados'},
  {id: 'SIGHTED', label: 'Vistos'},
];

export function ReportRow({r, onPress}) {
  const t = LF_TYPES[r.type];
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} testID={`aviso-${r.id}`}>
      {r.photos?.[0] ? <Image source={{uri: photoUrl(r.photos[0])}} style={styles.photo} /> : <View style={[styles.photo, {backgroundColor: '#E5E7EB'}]} />}
      <View style={{flex: 1}}>
        <View style={[styles.tag, {backgroundColor: t.soft}]}>
          <Text style={[styles.tagText, {color: t.color}]}>{t.label.toUpperCase()}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {speciesLabel(r.species)}
          {r.petName ? ` · ${r.petName}` : ''} · {r.colors}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[
            distanceLabel(r.distanceKm),
            r.district || r.locationNote,
            r.lastSeen ? `visto ${timeAgo(r.lastSeen.at)}` : timeAgo(r.happenedAt),
            r.sightings ? `${r.sightings} ${r.sightings === 1 ? 'avistamento' : 'avistamentos'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

export default function LostFoundScreen({navigation, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const location = useUserLocation({autoStart: true});
  const [mode, setMode] = useState('map');
  const [filter, setFilter] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [choose, setChoose] = useState(false);
  const tour = useTour(TOURS.lostfound.id, TOURS.lostfound.steps, {ready: !!data});

  const here = location.coords ? {lat: location.coords.latitude, lng: location.coords.longitude} : null;

  const load = useCallback(async () => {
    try {
      const qs = [here ? `lat=${here.lat}&lng=${here.lng}&radiusKm=20` : null, filter ? `type=${filter}` : null].filter(Boolean).join('&');
      setData(await api('GET', `/lostfound${qs ? `?${qs}` : ''}`));
      setError('');
    } catch (e) {
      setError(e.message);
      setData(d => d || {reports: [], counts: {}, reunited: 0});
    }
  }, [api, filter, here?.lat, here?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const reports = useMemo(() => data?.reports || [], [data]);
  const markers = useMemo(() => toMarkers(reports), [reports]);
  const sel = reports.find(r => r.id === selected);

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.modes}>
          {[
            ['map', 'Mapa', 'map'],
            ['list', 'Lista', 'list'],
          ].map(([id, label, icon]) => (
            <TouchableOpacity key={id} style={[styles.mode, mode === id && styles.modeOn]} onPress={() => setMode(id)} testID={`modo-${id}`}>
              <Ionicons name={icon} size={16} color={mode === id ? '#FFFFFF' : '#4B5563'} />
              <Text style={[styles.modeText, mode === id && {color: '#FFFFFF'}]}>{label}</Text>
            </TouchableOpacity>
          ))}
          <View style={{flex: 1}} />
          <TouchableOpacity onPress={() => navigation.navigate('LostFoundMine')} style={styles.iconBtn} accessibilityLabel="Meus avisos" ref={tour.ref('meus')} testID="meus-avisos">
            <Ionicons name="person-circle-outline" size={24} color={PURPLE} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('LostFoundAlerts')} style={styles.iconBtn} accessibilityLabel="Alertas por perto" ref={tour.ref('alertas')} testID="alertas">
            <Ionicons name="notifications-outline" size={23} color={PURPLE} />
          </TouchableOpacity>
        </View>
        <View style={styles.filters}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={String(f.id)}
              style={[styles.chip, filter === f.id && {backgroundColor: f.id ? LF_TYPES[f.id].color : PURPLE, borderColor: 'transparent'}]}
              onPress={() => setFilter(f.id)}
              testID={`filtro-${f.id || 'todos'}`}>
              <Text style={[styles.chipText, filter === f.id && {color: '#FFFFFF'}]}>
                {f.label}
                {f.id && data?.counts?.[f.id] != null && !filter ? ` ${data.counts[f.id]}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {data?.reunited ? (
          <Text style={styles.reunited} testID="reencontros">
            💚 {data.reunited} {data.reunited === 1 ? 'animal voltou' : 'animais voltaram'} para casa pelo app
          </Text>
        ) : null}
      </View>

      {!data ? (
        <ActivityIndicator style={{marginTop: 40}} color={PURPLE} />
      ) : mode === 'map' ? (
        <View style={{flex: 1}}>
          <LeafletMap
            style={{flex: 1}}
            center={here || undefined}
            zoom={here ? 14 : 13}
            markers={markers}
            fit={!here}
            userLocation={here}
            centerOnUser
            onMarkerPress={setSelected}
            testID="mapa"
          />
          {sel ? (
            <View style={styles.preview}>
              <ReportRow r={sel} onPress={() => navigation.navigate('LostFoundDetail', {id: sel.id})} />
              <Pressable onPress={() => setSelected(null)} style={styles.previewClose} accessibilityLabel="Fechar">
                <Ionicons name="close" size={18} color="#6B7280" />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={r => r.id}
          contentContainerStyle={{padding: 16, paddingBottom: 100}}
          ListHeaderComponent={
            <Text style={styles.hint}>
              {error || (here ? 'Mais perto de você primeiro (até 20 km).' : 'Ative a localização para ver os mais perto de você.')}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="paw-outline" size={52} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nenhum aviso por aqui. Que bom!</Text>
            </View>
          }
          renderItem={({item}) => <ReportRow r={item} onPress={() => navigation.navigate('LostFoundDetail', {id: item.id})} />}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setChoose(true)} ref={tour.ref('publicar')} testID="publicar">
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>Publicar aviso</Text>
      </TouchableOpacity>

      <Modal visible={choose} transparent animationType="fade" onRequestClose={() => setChoose(false)}>
        <Pressable style={styles.backdrop} onPress={() => setChoose(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>O que aconteceu?</Text>
            {Object.entries(LF_TYPES).map(([id, t]) => (
              <TouchableOpacity
                key={id}
                style={[styles.option, {borderColor: t.color, backgroundColor: t.soft}]}
                onPress={() => {
                  setChoose(false);
                  navigation.navigate('LostFoundNew', {type: id});
                }}
                testID={`novo-${id}`}>
                <Ionicons name={t.icon} size={24} color={t.color} />
                <Text style={[styles.optionText, {color: t.color}]}>{t.verb}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F6F5FB'},
  top: {backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB'},
  modes: {flexDirection: 'row', alignItems: 'center', gap: 8},
  mode: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6'},
  modeOn: {backgroundColor: PURPLE},
  modeText: {fontSize: 13, ...F.bold, color: '#4B5563'},
  iconBtn: {padding: 4},
  filters: {flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap'},
  chip: {paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB'},
  chipText: {fontSize: 12, ...F.bold, color: '#4B5563'},
  reunited: {fontSize: 12, color: '#047857', ...F.semibold, marginTop: 8},
  hint: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginBottom: 8},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, marginBottom: 8},
  photo: {width: 64, height: 64, borderRadius: 12},
  tag: {alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2},
  tagText: {fontSize: 10, ...F.heavy, },
  title: {fontSize: 15, ...F.bold, color: '#1F2937', marginTop: 3},
  meta: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginTop: 2},
  empty: {alignItems: 'center', paddingVertical: 50},
  emptyText: {color: '#6B7280', marginTop: 8},
  preview: {position: 'absolute', left: 12, right: 12, bottom: 90, elevation: 6},
  previewClose: {position: 'absolute', right: 6, top: 6, padding: 4},
  fab: {position: 'absolute', right: 16, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PURPLE, borderRadius: 28, paddingHorizontal: 20, height: 52, elevation: 4},
  fabText: {color: '#FFFFFF', fontSize: 15, ...F.heavy, },
  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32},
  sheetTitle: {fontSize: 18, ...F.heavy, color: '#1F2937', marginBottom: 12},
  option: {flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 16, marginBottom: 10},
  optionText: {fontSize: 16, ...F.heavy, },
});
