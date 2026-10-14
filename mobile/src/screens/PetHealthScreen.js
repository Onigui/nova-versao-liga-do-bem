/**
 * Histórico de saúde do pet: consultas, exames, vacinas, remédios e peso numa linha do tempo.
 * O que o veterinário parceiro registra vem conferido (CRMV) e não pode ser alterado pelo tutor.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HealthTimeline from '../components/HealthTimeline';
import WeightChart from '../components/WeightChart';
import {API_BASE_PATH} from '../config/apiConfig';
import {HISTORY_FILTERS, dayLabel, filterHistory} from '../utils/health';
import {memberApi} from '../utils/quotes';

const PURPLE = '#7C3AED';

export default function PetHealthScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const petId = route?.params?.petId;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [photo, setPhoto] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api('GET', `/user/pets/${petId}/history`);
      setData(d);
      setError('');
      navigation?.setOptions?.({title: `Saúde de ${d.pet?.name || 'seu pet'}`});
    } catch (e) {
      setError(e.message);
    }
  }, [api, petId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openPhoto = async item => {
    const token = await AsyncStorage.getItem('auth_token');
    setPhoto({uri: `${API_BASE_PATH}/user/pets/${petId}/history/${item.id}/photo`, headers: {Authorization: `Bearer ${token}`}});
  };

  if (!data) {
    return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{marginTop: 40}} color={PURPLE} />;
  }

  const items = filterHistory(data.items, filter);
  const width = Dimensions.get('window').width - 60;

  return (
    <View style={{flex: 1, backgroundColor: '#F9FAFB'}}>
      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 100}}>
        <View style={styles.stats}>
          {[
            ['Consultas', data.counts.consultas, 'medkit'],
            ['Vacinas', data.counts.vacinas, 'shield-checkmark'],
            ['Exames', data.counts.exames, 'flask'],
          ].map(([label, n, icon]) => (
            <View key={label} style={styles.stat}>
              <Ionicons name={icon} size={18} color={PURPLE} />
              <Text style={styles.statN}>{n}</Text>
              <Text style={styles.statL}>{label}</Text>
            </View>
          ))}
        </View>

        {data.nextReturn ? (
          <View style={styles.next} testID="proximo-retorno">
            <Ionicons name="calendar" size={20} color="#B45309" />
            <Text style={styles.nextText}>
              {data.nextReturn.type === 'VACCINATION' ? 'Próxima dose' : 'Retorno'} em {dayLabel(data.nextReturn.date)} · {data.nextReturn.title}
            </Text>
          </View>
        ) : null}

        <WeightChart weights={data.weights} color={PURPLE} width={width} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 6}}>
          {HISTORY_FILTERS.map(f => (
            <TouchableOpacity key={f.id} style={[styles.chip, filter === f.id && styles.chipActive]} onPress={() => setFilter(f.id)} testID={`filtro-${f.id}`}>
              <Text style={[styles.chipText, filter === f.id && {color: '#FFFFFF'}]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <HealthTimeline
          items={items}
          color={PURPLE}
          onPhoto={openPhoto}
          canEdit={it => it.type === 'ENTRY' && it.source === 'TUTOR'}
          onEdit={it => navigation.navigate('HealthEntryForm', {petId, entry: it})}
          emptyText={
            filter === 'ALL'
              ? 'Comece registrando um peso, um exame ou um remédio. No veterinário parceiro, mostre o QR do pet: a consulta entra aqui conferida.'
              : 'Nada deste tipo ainda.'
          }
        />
        <TouchableOpacity style={styles.qr} onPress={() => navigation.navigate('PetQr', {petId, petName: data.pet?.name})} testID="qr-veterinario">
          <Ionicons name="qr-code" size={18} color={PURPLE} />
          <Text style={styles.qrText}>No veterinário: mostrar o QR do pet</Text>
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('HealthEntryForm', {petId})} testID="novo-registro">
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>Registrar</Text>
      </TouchableOpacity>

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <Pressable style={styles.modal} onPress={() => setPhoto(null)}>
          {photo ? <Image source={photo} style={{width: '100%', height: '80%'}} resizeMode="contain" /> : null}
          <Text style={{color: '#FFFFFF', marginTop: 12}}>Toque para fechar</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {color: '#B91C1C', margin: 24},
  stats: {flexDirection: 'row', gap: 8, marginBottom: 12},
  stat: {flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, alignItems: 'center'},
  statN: {fontSize: 20, fontWeight: '900', color: '#1F2937', marginTop: 2},
  statL: {fontSize: 11, color: '#6B7280'},
  next: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12},
  nextText: {flex: 1, color: '#92400E', fontWeight: '600'},
  chip: {paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB'},
  chipActive: {backgroundColor: PURPLE, borderColor: PURPLE},
  chipText: {fontSize: 13, fontWeight: '600', color: '#4B5563'},
  qr: {flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16},
  qrText: {color: PURPLE, fontWeight: '700'},
  fab: {position: 'absolute', right: 16, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PURPLE, borderRadius: 28, paddingHorizontal: 20, height: 52, elevation: 4},
  fabText: {color: '#FFFFFF', fontSize: 15, fontWeight: '800'},
  modal: {flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 16},
});
