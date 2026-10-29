/**
 * "Vi este animal": adiciona um avistamento ao caso (em vez de criar outro aviso).
 * Foto obrigatória — é ela que confirma que é o mesmo animal (há muitos parecidos).
 * Entra na linha do tempo e no trajeto do caso, e avisa quem publicou e quem já ajudou.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {MapFullscreen, MapPreview} from '../components/MapSheet';
import DateField from '../components/DateField';
import useUserLocation from '../services/useUserLocation';
import {memberApi} from '../utils/quotes';
import {getPicker} from '../utils/photoPicker';
import {LF_TYPES, SIGHTING_KINDS, buildSightingBody, nowInput, parseDateTime, photoUrl, speciesLabel} from '../utils/lostfound';
import {F} from '../theme/home';

export default function LostFoundSightingScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const report = route?.params?.report || {};
  const t = LF_TYPES[report.type] || LF_TYPES.SIGHTED;
  const location = useUserLocation({autoStart: true});
  const here = location.coords ? {lat: location.coords.latitude, lng: location.coords.longitude} : null;
  const [form, setForm] = useState({kind: route?.params?.kind || 'SEEN', photo: null, location: null, when: nowInput(), locationNote: '', note: ''});
  const [mapOpen, setMapOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [pickTo, setPickTo] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = patch => setForm(f => ({...f, ...patch}));
  const k = SIGHTING_KINDS[form.kind];

  useEffect(() => {
    navigation?.setOptions?.({title: 'Vi este animal'});
  }, [navigation]);
  useEffect(() => {
    if (here && !form.location) set({location: here});
  }, [here?.lat, here?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickPhoto = async kind => {
    const launch = getPicker(kind);
    const res = await launch({mediaType: 'photo', maxWidth: 1200, maxHeight: 1200, quality: 0.6, includeBase64: true});
    const a = res?.assets?.[0];
    if (!a?.base64) return;
    if (a.base64.length * 0.75 > 780 * 1024) {
      Alert.alert('Foto muito grande', 'Tente de novo um pouco mais de longe.');
      return;
    }
    set({photo: {uri: a.uri, data: `data:${a.type || 'image/jpeg'};base64,${a.base64}`}});
  };

  const pin = useMemo(() => (form.location ? [{id: 'pino', lat: form.location.lat, lng: form.location.lng, color: k.color}] : null), [form.location, k.color]);

  const submit = async () => {
    const {error, body} = buildSightingBody(form);
    if (error) {
      Alert.alert('Falta pouco', error);
      return;
    }
    setSaving(true);
    try {
      const d = await api('POST', `/lostfound/${report.id}/sightings`, body);
      Alert.alert('Obrigado! 🐾', d.notified ? `Avisamos ${d.notified} ${d.notified === 1 ? 'pessoa' : 'pessoas'} que acompanham este caso.` : 'O avistamento entrou na linha do tempo.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#F9FAFB'}} contentContainerStyle={{padding: 16, paddingBottom: 40}} keyboardShouldPersistTaps="handled">
      <View style={styles.caseCard} testID="caso-resumo">
        {report.photos?.[0] ? <Image source={{uri: photoUrl(report.photos[0])}} style={styles.caseImg} /> : null}
        <View style={{flex: 1}}>
          <Text style={[styles.caseTag, {color: t.color}]}>{t.label.toUpperCase()}</Text>
          <Text style={styles.caseTitle} numberOfLines={2}>
            {report.petName ? `${report.petName} · ` : ''}
            {speciesLabel(report.species)} {report.colors}
          </Text>
          <Text style={styles.caseHint}>Compare com a foto antes de registrar.</Text>
        </View>
      </View>

      <Text style={styles.section}>O que aconteceu</Text>
      <View style={{gap: 8}}>
        {Object.entries(SIGHTING_KINDS).map(([id, v]) => {
          const on = form.kind === id;
          return (
            <TouchableOpacity key={id} style={[styles.kind, on && {borderColor: v.color, backgroundColor: v.soft}]} onPress={() => set({kind: id})} testID={`tipo-${id}`}>
              <Ionicons name={v.icon} size={20} color={v.color} />
              <Text style={[styles.kindText, on && {color: v.color}]}>{v.long}</Text>
              {on ? <Ionicons name="checkmark-circle" size={20} color={v.color} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.section}>Foto do animal *</Text>
      <Text style={styles.hint}>Obrigatória: é ela que confirma que é o mesmo animal. Há muitos parecidos perdidos perto.</Text>
      {form.photo ? (
        <View style={{marginTop: 8}}>
          <Image source={{uri: form.photo.uri}} style={styles.photo} testID="foto-escolhida" />
          <Pressable style={styles.removePhoto} onPress={() => set({photo: null})} accessibilityLabel="Trocar foto">
            <Ionicons name="close-circle" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        <View style={{flexDirection: 'row', gap: 10, marginTop: 8}}>
          <TouchableOpacity style={styles.addPhoto} onPress={() => pickPhoto('camera')} testID="foto-camera">
            <Ionicons name="camera" size={26} color={k.color} />
            <Text style={styles.addPhotoText}>Tirar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addPhoto} onPress={() => pickPhoto('library')} testID="foto-galeria">
            <Ionicons name="images" size={26} color={k.color} />
            <Text style={styles.addPhotoText}>Da galeria</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.section}>Onde e quando</Text>
      <MapPreview style={styles.map} center={form.location || here} zoom={16} markers={pin} hint={form.location ? 'Toque para ajustar' : 'Toque para marcar'} onPress={() => setMapOpen(true)} testID="mapa-avistamento" />
      {form.kind === 'WITH_ME' ? <Text style={[styles.hint, {marginTop: 6}]}>Como é a sua casa, no mapa aparece só a região aproximada.</Text> : null}
      <MapFullscreen
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Onde você viu o animal?"
        subtitle="Arraste o pino ou toque no mapa."
        center={form.location || here || undefined}
        zoom={17}
        pick
        pickTo={pickTo}
        onPick={setDraft}
        userLocation={here}
        footer={
          <>
            {here ? (
              <TouchableOpacity style={styles.mapSecondary} onPress={() => setPickTo({...here, key: Date.now()})}>
                <Ionicons name="locate" size={18} color={k.color} />
                <Text style={[styles.mapSecondaryText, {color: k.color}]}>Usar minha localização</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.save, {backgroundColor: k.color, marginTop: 0}]}
              onPress={() => {
                const p = draft || form.location || here;
                if (p) set({location: {lat: p.lat, lng: p.lng}});
                setMapOpen(false);
              }}
              testID="confirmar-local">
              <Text style={styles.saveText}>Confirmar local</Text>
            </TouchableOpacity>
          </>
        }
      />
      <View style={{marginTop: 12}}>
        <Text style={styles.label}>Ponto de referência</Text>
        <TextInput style={styles.input} value={form.locationNote} onChangeText={v => set({locationNote: v})} maxLength={120} placeholder="Ex.: em frente ao mercado" placeholderTextColor="#9CA3AF" testID="campo-referencia" />
      </View>
      <DateField
        label="Quando"
        labelStyle={styles.label}
        style={{marginTop: 12}}
        mode="datetime"
        value={parseDateTime(form.when)}
        onChange={d => d && set({when: nowInput(d)})}
        minDate={new Date(Date.now() - 30 * 864e5)}
        maxDate={new Date()}
        accent={k.color}
        testID="campo-quando"
      />
      <View style={{marginTop: 12}}>
        <Text style={styles.label}>Observação (opcional)</Text>
        <TextInput
          style={[styles.input, {minHeight: 70, textAlignVertical: 'top'}]}
          value={form.note}
          onChangeText={v => set({note: v})}
          maxLength={300}
          multiline
          placeholder={form.kind === 'CLINIC' ? 'Qual clínica? Como ele está?' : 'Estava machucado? Para onde foi?'}
          placeholderTextColor="#9CA3AF"
          testID="campo-observacao"
        />
      </View>

      <TouchableOpacity style={[styles.save, {backgroundColor: k.color}, saving && {opacity: 0.6}]} onPress={submit} disabled={saving} testID="registrar-avistamento">
        <Text style={styles.saveText}>{saving ? 'Enviando…' : 'Registrar avistamento'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  caseCard: {flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, alignItems: 'center'},
  caseImg: {width: 72, height: 72, borderRadius: 10, backgroundColor: '#E5E7EB'},
  caseTag: {fontSize: 11, ...F.heavy},
  caseTitle: {fontSize: 15, ...F.bold, color: '#1F2937', marginTop: 2},
  caseHint: {fontSize: 12, ...F.regular, color: '#6B7280', marginTop: 2},
  section: {fontSize: 16, ...F.heavy, color: '#1F2937', marginTop: 20, marginBottom: 8},
  label: {fontSize: 13, ...F.bold, color: '#374151', marginBottom: 6},
  hint: {...F.regular, fontSize: 12, color: '#6B7280'},
  kind: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', padding: 12},
  kindText: {flex: 1, fontSize: 15, ...F.bold, color: '#374151'},
  photo: {width: '100%', height: 220, borderRadius: 14, backgroundColor: '#E5E7EB'},
  removePhoto: {position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14},
  addPhoto: {flex: 1, height: 110, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  addPhotoText: {...F.semibold, fontSize: 13, color: '#4B5563', marginTop: 4},
  map: {height: 170, borderRadius: 14},
  mapSecondary: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB'},
  mapSecondaryText: {...F.bold, fontSize: 14},
  input: {...F.regular, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937'},
  save: {height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20},
  saveText: {color: '#FFFFFF', ...F.heavy, fontSize: 16},
});
