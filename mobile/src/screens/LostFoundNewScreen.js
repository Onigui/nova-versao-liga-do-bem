/**
 * Publicar aviso de achados e perdidos: foto, local exato no mapa, quando, como é o animal e WhatsApp.
 * Vai para o mapa na hora e avisa quem está perto.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {MapFullscreen, MapPreview} from '../components/MapSheet';
import useUserLocation from '../services/useUserLocation';
import {useAuth} from '../services/AuthService';
import {memberApi} from '../utils/quotes';
import {LF_SEX, LF_SIZES, LF_SPECIES, LF_TYPES, LF_WITH, buildReportBody, formatPhone, nowInput} from '../utils/lostfound';
import {F} from '../theme/home';

function getPicker(kind) {
  try {
    const m = require('react-native-image-picker');
    return kind === 'camera' ? m.launchCamera : m.launchImageLibrary;
  } catch {
    return null;
  }
}

function useAuthSafe() {
  try {
    return useAuth() || {};
  } catch {
    return {};
  }
}

function Chips({options, value, onChange, color, prefix}) {
  return (
    <View style={styles.chips}>
      {options.map(o => (
        <TouchableOpacity
          key={o.id}
          style={[styles.chip, value === o.id && {backgroundColor: color, borderColor: color}]}
          onPress={() => onChange(value === o.id ? null : o.id)}
          testID={`${prefix}-${o.id}`}>
          <Text style={[styles.chipText, value === o.id && {color: '#FFFFFF'}]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const speciesFromPet = s => (/gat/i.test(s || '') ? 'CAT' : /c[aã]o|cachorr|dog/i.test(s || '') ? 'DOG' : 'OTHER');

export default function LostFoundNewScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const type = route?.params?.type || 'FOUND';
  const t = LF_TYPES[type];
  const {user} = useAuthSafe();
  const location = useUserLocation({autoStart: true});
  const here = location.coords ? {lat: location.coords.latitude, lng: location.coords.longitude} : null;
  const [form, setForm] = useState({
    type,
    photos: [],
    species: null,
    sex: 'NAO_SEI',
    size: null,
    colors: '',
    breed: '',
    hasCollar: null,
    description: '',
    petName: '',
    petId: null,
    currentlyWith: type === 'FOUND' ? 'COMIGO' : null,
    when: nowInput(),
    location: null,
    locationNote: '',
    district: '',
    whatsapp: formatPhone(user?.phone || ''),
    showWhatsapp: true,
  });
  const [pets, setPets] = useState([]);
  const [pickTo, setPickTo] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [draft, setDraft] = useState(null); // ponto escolhido no mapa em tela cheia, antes de confirmar
  const [saving, setSaving] = useState(false);
  const set = patch => setForm(f => ({...f, ...patch}));

  useEffect(() => {
    navigation?.setOptions?.({title: t.verb});
    if (type === 'LOST') {
      api('GET', '/user/pets')
        .then(d => setPets(d.pets || []))
        .catch(() => {});
    }
  }, [api, type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Primeira posição do GPS vira o ponto inicial do pino
  useEffect(() => {
    if (here && !form.location) set({location: here});
  }, [here?.lat, here?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const choosePet = p => {
    if (form.petId === p.id) {
      set({petId: null});
      return;
    }
    set({petId: p.id, petName: p.name, species: speciesFromPet(p.species), breed: p.breed || form.breed, colors: p.color || form.colors});
  };

  const addPhoto = async kind => {
    if (form.photos.length >= 3) return;
    const launch = getPicker(kind);
    if (!launch) return;
    const res = await launch({mediaType: 'photo', maxWidth: 1200, maxHeight: 1200, quality: 0.6, includeBase64: true, saveToPhotos: false});
    const a = res?.assets?.[0];
    if (!a?.base64) return;
    if (a.base64.length * 0.75 > 780 * 1024) {
      Alert.alert('Foto muito grande', 'Tente de novo um pouco mais de longe.');
      return;
    }
    set({photos: [...form.photos, {uri: a.uri, data: `data:${a.type || 'image/jpeg'};base64,${a.base64}`}]});
  };

  const pinMarker = useMemo(() => (form.location ? [{id: 'pino', lat: form.location.lat, lng: form.location.lng, color: t.color}] : null), [form.location, t.color]);
  const openMap = () => {
    setDraft(null);
    setPickTo(null);
    setMapOpen(true);
  };
  const confirmMap = () => {
    const p = draft || form.location || here;
    if (p) set({location: {lat: p.lat, lng: p.lng}});
    setMapOpen(false);
  };

  const submit = async () => {
    const {error, body} = buildReportBody(form);
    if (error) {
      Alert.alert('Falta pouco', error);
      return;
    }
    setSaving(true);
    try {
      const d = await api('POST', '/lostfound', body);
      const n = (d.alerts?.nearby || 0) + (d.alerts?.matched || 0);
      Alert.alert('Publicado!', n ? `Avisamos ${n} ${n === 1 ? 'pessoa' : 'pessoas'} por perto.` : 'Seu aviso já está no mapa.');
      navigation.replace('LostFoundDetail', {id: d.report.id});
    } catch (e) {
      Alert.alert('Não foi possível publicar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, props = {}) => (
    <View style={{marginTop: 12}}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, props.multiline && {minHeight: 80, textAlignVertical: 'top'}]}
        value={form[key]}
        onChangeText={v => set({[key]: v})}
        placeholderTextColor="#9CA3AF"
        testID={`campo-${key}`}
        {...props}
      />
    </View>
  );

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#F9FAFB'}} contentContainerStyle={{padding: 16, paddingBottom: 40}} keyboardShouldPersistTaps="handled">
      <View style={[styles.banner, {backgroundColor: t.soft}]}>
        <Ionicons name={t.icon} size={22} color={t.color} />
        <Text style={[styles.bannerText, {color: t.color}]}>
          {type === 'LOST'
            ? 'No mapa aparece só a região aproximada, para não expor o seu endereço.'
            : 'Marque o ponto exato: isso ajuda muito o dono a encontrar.'}
        </Text>
      </View>

      <Text style={styles.section}>Fotos {form.photos.length}/3</Text>
      <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
        {form.photos.map((p, i) => (
          <View key={i}>
            <Image source={{uri: p.uri}} style={styles.photo} />
            <Pressable style={styles.removePhoto} onPress={() => set({photos: form.photos.filter((_, j) => j !== i)})} accessibilityLabel="Remover foto">
              <Ionicons name="close-circle" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
        {form.photos.length < 3 ? (
          <>
            <TouchableOpacity style={styles.addPhoto} onPress={() => addPhoto('camera')} testID="foto-camera">
              <Ionicons name="camera" size={26} color={t.color} />
              <Text style={styles.addPhotoText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addPhoto} onPress={() => addPhoto('library')} testID="foto-galeria">
              <Ionicons name="images" size={26} color={t.color} />
              <Text style={styles.addPhotoText}>Galeria</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {type === 'LOST' && pets.length ? (
        <>
          <Text style={styles.section}>É um dos seus pets?</Text>
          <View style={styles.chips}>
            {pets.map(p => (
              <TouchableOpacity key={p.id} style={[styles.chip, form.petId === p.id && {backgroundColor: t.color, borderColor: t.color}]} onPress={() => choosePet(p)} testID={`pet-${p.id}`}>
                <Text style={[styles.chipText, form.petId === p.id && {color: '#FFFFFF'}]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.section}>Como é o animal</Text>
      <Chips options={LF_SPECIES} value={form.species} onChange={v => set({species: v})} color={t.color} prefix="especie" />
      {type === 'LOST' ? field('petName', 'Nome do pet', {maxLength: 40, placeholder: 'Ex.: Thor'}) : null}
      {field('colors', 'Cor(es)', {maxLength: 60, placeholder: 'Ex.: caramelo com mancha branca no peito'})}
      <Text style={[styles.label, {marginTop: 12}]}>Porte</Text>
      <Chips options={LF_SIZES} value={form.size} onChange={v => set({size: v})} color={t.color} prefix="porte" />
      <Text style={[styles.label, {marginTop: 12}]}>Sexo</Text>
      <Chips options={LF_SEX} value={form.sex} onChange={v => set({sex: v || 'NAO_SEI'})} color={t.color} prefix="sexo" />
      <Text style={[styles.label, {marginTop: 12}]}>Coleira</Text>
      <Chips
        options={[
          {id: 'SIM', label: 'Com coleira'},
          {id: 'NAO', label: 'Sem coleira'},
        ]}
        value={form.hasCollar === true ? 'SIM' : form.hasCollar === false ? 'NAO' : null}
        onChange={v => set({hasCollar: v === 'SIM' ? true : v === 'NAO' ? false : null})}
        color={t.color}
        prefix="coleira"
      />
      {field('breed', 'Raça (se souber)', {maxLength: 40})}
      {field('description', 'Detalhes', {
        multiline: true,
        maxLength: 600,
        placeholder: type === 'LOST' ? 'Como ele reage, se é medroso, sinais, cicatriz…' : 'Está machucado? Dócil? Para onde foi?',
      })}
      {type === 'FOUND' ? (
        <>
          <Text style={[styles.label, {marginTop: 12}]}>Onde o animal está agora</Text>
          <Chips options={LF_WITH} value={form.currentlyWith} onChange={v => set({currentlyWith: v})} color={t.color} prefix="com" />
        </>
      ) : null}

      <Text style={styles.section}>Onde e quando</Text>
      <MapPreview
        style={styles.map}
        center={form.location || here}
        zoom={16}
        markers={pinMarker}
        hint={form.location ? 'Toque para ajustar o local' : 'Toque para marcar o local'}
        onPress={openMap}
        testID="mapa-escolher"
      />
      <Text style={[styles.hint, {marginTop: 6}]}>
        {form.location ? 'O pino mostra o local escolhido. Toque no mapa para ajustar.' : 'Ainda sem local: toque no mapa para marcar.'}
      </Text>
      <MapFullscreen
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        title={type === 'LOST' ? 'Onde o pet sumiu?' : 'Onde você viu o animal?'}
        subtitle="Arraste o pino ou toque no mapa. Use dois dedos para aproximar."
        center={form.location || here || undefined}
        zoom={17}
        pick
        pickTo={pickTo}
        onPick={setDraft}
        userLocation={here}
        testID="mapa-tela-cheia"
        footer={
          <>
            {here ? (
              <TouchableOpacity style={styles.mapSecondary} onPress={() => setPickTo({...here, key: Date.now()})} testID="usar-minha-localizacao">
                <Ionicons name="locate" size={18} color={t.color} />
                <Text style={[styles.mapSecondaryText, {color: t.color}]}>Usar minha localização</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.save, {backgroundColor: t.color, marginTop: 0}]} onPress={confirmMap} testID="confirmar-local">
              <Text style={styles.saveText}>Confirmar local</Text>
            </TouchableOpacity>
          </>
        }
      />
      {field('locationNote', 'Ponto de referência', {maxLength: 120, placeholder: 'Ex.: em frente à padaria, esquina com a Rua X'})}
      {field('district', 'Bairro', {maxLength: 60})}
      {field('when', type === 'LOST' ? 'Quando sumiu' : 'Quando você viu', {placeholder: 'DD/MM/AAAA HH:MM', keyboardType: 'numbers-and-punctuation', maxLength: 16})}

      <Text style={styles.section}>Contato</Text>
      <View style={styles.switchRow}>
        <Text style={{flex: 1, color: '#374151'}}>Mostrar meu WhatsApp para quem estiver logado no app</Text>
        <Switch value={form.showWhatsapp} onValueChange={v => set({showWhatsapp: v})} testID="mostrar-whatsapp" />
      </View>
      {form.showWhatsapp ? field('whatsapp', 'WhatsApp', {keyboardType: 'phone-pad', placeholder: '(14) 99999-9999', onChangeText: v => set({whatsapp: formatPhone(v)})}) : null}
      <View style={styles.warn}>
        <Ionicons name="shield-checkmark" size={18} color="#92400E" />
        <Text style={styles.warnText}>Nunca peça nem faça PIX para "devolver" um animal. A Liga remove avisos com golpe.</Text>
      </View>

      <TouchableOpacity style={[styles.save, {backgroundColor: t.color}, saving && {opacity: 0.6}]} onPress={submit} disabled={saving} testID="publicar-aviso">
        <Text style={styles.saveText}>{saving ? 'Publicando…' : 'Publicar no mapa'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  banner: {flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 12, padding: 12},
  bannerText: {flex: 1, fontSize: 13, ...F.semibold, },
  section: {fontSize: 16, ...F.heavy, color: '#1F2937', marginTop: 20, marginBottom: 8},
  label: {fontSize: 13, ...F.bold, color: '#374151', marginBottom: 6},
  hint: {
    ...F.regular, fontSize: 12, color: '#6B7280', flex: 1},
  input: {
    ...F.regular, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937'},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  chip: {paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB'},
  chipText: {fontSize: 13, ...F.semibold, color: '#4B5563'},
  photo: {width: 96, height: 96, borderRadius: 12},
  removePhoto: {position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12},
  addPhoto: {width: 96, height: 96, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  addPhotoText: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginTop: 2},
  map: {height: 180, borderRadius: 14},
  mapSecondary: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB'},
  mapSecondaryText: {...F.bold, fontSize: 14},
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12},
  warn: {flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 10, marginTop: 12},
  warnText: {
    ...F.regular, flex: 1, fontSize: 12, color: '#92400E'},
  save: {height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20},
  saveText: {color: '#FFFFFF', ...F.heavy, fontSize: 16},
});
