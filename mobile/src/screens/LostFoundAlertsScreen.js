/**
 * Alertas de achados e perdidos: receber notificação de animais encontrados/perdidos perto de mim.
 * Guardamos só a região (≈1 km), não o endereço.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import useUserLocation from '../services/useUserLocation';
import {memberApi} from '../utils/quotes';
import {F} from '../theme/home';

const PURPLE = '#7C3AED';
const RADII = [1, 3, 5, 10];

export default function LostFoundAlertsScreen({navigation, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const location = useUserLocation({autoStart: true});
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = p => setForm(f => ({...f, ...p}));

  useEffect(() => {
    api('GET', '/lostfound/alerts')
      .then(d =>
        setForm(
          d.alerts
            ? {enabled: d.alerts.enabled, radiusKm: d.alerts.radiusKm, species: d.alerts.species, notifyFound: d.alerts.notifyFound, notifyLost: d.alerts.notifyLost, saved: true}
            : {enabled: true, radiusKm: 3, species: 'ALL', notifyFound: true, notifyLost: true, saved: false},
        ),
      )
      .catch(() => setForm({enabled: true, radiusKm: 3, species: 'ALL', notifyFound: true, notifyLost: true, saved: false}));
  }, [api]);

  const save = async () => {
    if (!location.coords) {
      location.request();
      Alert.alert('Precisamos da sua região', 'Ative a localização para receber alertas do que acontece perto de você.');
      return;
    }
    setSaving(true);
    try {
      await api('PUT', '/lostfound/alerts', {...form, lat: location.coords.latitude, lng: location.coords.longitude});
      Alert.alert('Alertas salvos', form.enabled ? `Você será avisado num raio de ${form.radiusKm} km.` : 'Alertas desligados.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível salvar', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <ActivityIndicator style={{marginTop: 40}} color={PURPLE} />;

  const Row = ({label, value, onChange, testID}) => (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch value={value} onValueChange={onChange} testID={testID} />
    </View>
  );

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#F9FAFB'}} contentContainerStyle={{padding: 16, paddingBottom: 40}}>
      <View style={styles.hero}>
        <Ionicons name="notifications" size={26} color={PURPLE} />
        <Text style={styles.heroText}>Seja avisado quando aparecer um animal perdido ou encontrado perto de você. Quanto mais gente de olho, mais rápido eles voltam para casa.</Text>
      </View>
      <Row label="Receber alertas" value={form.enabled} onChange={v => set({enabled: v})} testID="ativar" />
      {form.enabled ? (
        <>
          <Text style={styles.label}>Raio</Text>
          <View style={styles.chips}>
            {RADII.map(r => (
              <TouchableOpacity key={r} style={[styles.chip, form.radiusKm === r && styles.chipOn]} onPress={() => set({radiusKm: r})} testID={`raio-${r}`}>
                <Text style={[styles.chipText, form.radiusKm === r && {color: '#FFFFFF'}]}>{r} km</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Espécie</Text>
          <View style={styles.chips}>
            {[
              ['ALL', 'Todos'],
              ['DOG', 'Cachorros'],
              ['CAT', 'Gatos'],
            ].map(([id, l]) => (
              <TouchableOpacity key={id} style={[styles.chip, form.species === id && styles.chipOn]} onPress={() => set({species: id})} testID={`especie-${id}`}>
                <Text style={[styles.chipText, form.species === id && {color: '#FFFFFF'}]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Row label="Animais encontrados ou vistos soltos" value={form.notifyFound} onChange={v => set({notifyFound: v})} testID="avisar-encontrados" />
          <Row label="Animais perdidos (para ficar de olho)" value={form.notifyLost} onChange={v => set({notifyLost: v})} testID="avisar-perdidos" />
        </>
      ) : null}
      <Text style={styles.hint}>Usamos só a sua região (cerca de 1 km), não o seu endereço. Quem publica "perdi" já recebe automaticamente os avisos parecidos perto de onde o pet sumiu.</Text>
      <TouchableOpacity style={[styles.save, saving && {opacity: 0.6}]} onPress={save} disabled={saving} testID="salvar-alertas">
        <Text style={styles.saveText}>{saving ? 'Salvando…' : 'Salvar'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14, marginBottom: 12},
  heroText: {
    ...F.regular, flex: 1, color: '#4C1D95', fontSize: 13, lineHeight: 19},
  row: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginTop: 8},
  rowText: {
    ...F.regular, flex: 1, fontSize: 15, color: '#1F2937'},
  label: {fontSize: 13, ...F.bold, color: '#374151', marginTop: 16, marginBottom: 6},
  chips: {flexDirection: 'row', gap: 8, flexWrap: 'wrap'},
  chip: {paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB'},
  chipOn: {backgroundColor: PURPLE, borderColor: PURPLE},
  chipText: {fontSize: 13, ...F.bold, color: '#4B5563'},
  hint: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginTop: 14, lineHeight: 17},
  save: {height: 52, borderRadius: 14, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', marginTop: 20},
  saveText: {color: '#FFFFFF', ...F.heavy, fontSize: 16},
});
