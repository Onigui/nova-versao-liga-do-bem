/**
 * Novo orçamento: o membro monta a lista e os parceiros mandam propostas às cegas.
 * Na hora já aparecem os preços de tabela de quem tem os itens.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import QuoteListBuilder from '../components/QuoteListBuilder';
import {QUOTE_DEADLINES, buildItems, memberApi} from '../utils/quotes';
import {F} from '../theme/home';
import {getPicker} from '../utils/photoPicker';
import {useTour} from '../components/Tour';
import {TOURS} from '../tours';

const PURPLE = '#6D28D9';
const SPECIES_ID = s => (/gat/i.test(s || '') ? 'CAT' : /c[aã]o|cachorr/i.test(s || '') ? 'DOG' : null);


export default function QuoteNewScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const preset = route?.params?.item;
  const [list, setList] = useState(
    preset ? [{key: 'preset', itemId: preset.id, label: preset.label, category: preset.category, quantity: 1}] : [],
  );
  const [pets, setPets] = useState([]);
  const [petId, setPetId] = useState(null);
  const [hours, setHours] = useState(24);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);
  const tour = useTour(TOURS.quote.id, TOURS.quote.steps);

  useEffect(() => {
    api('GET', '/user/pets')
      .then(d => setPets(d.pets || []))
      .catch(() => {});
  }, [api]);

  const pet = pets.find(p => p.id === petId);

  const pickPhoto = async kind => {
    const launch = getPicker(kind);
    if (!launch) return;
    const res = await launch({mediaType: 'photo', maxWidth: 1200, maxHeight: 1200, quality: 0.6, includeBase64: true, saveToPhotos: false});
    const a = res?.assets?.[0];
    if (!a?.base64) return;
    if (a.base64.length * 0.75 > 780 * 1024) {
      Alert.alert('Foto muito grande', 'Tire a foto um pouco mais de longe ou com menos luz forte.');
      return;
    }
    setPhoto({data: `data:${a.type || 'image/jpeg'};base64,${a.base64}`, uri: a.uri});
  };

  const send = async () => {
    if (!list.length) {
      Alert.alert('Lista vazia', 'Adicione pelo menos um item.');
      return;
    }
    setSending(true);
    try {
      const data = await api('POST', '/quotes', {
        items: buildItems(list),
        petId: petId || undefined,
        expiresInHours: hours,
        notes: notes.trim() || undefined,
        prescription: photo?.data,
      });
      navigation.replace('QuoteDetail', {id: data.request.id, initial: data});
    } catch (e) {
      Alert.alert('Não foi possível enviar', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{padding: 16, paddingBottom: 40}} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Ionicons name="flash" size={22} color="#6D28D9" />
        <Text style={styles.heroText}>
          Monte a lista e os parceiros mandam propostas. Nenhum vê o preço do outro, e você escolhe onde comprar.
        </Text>
      </View>

      <Text style={styles.section}>1. O que você precisa?</Text>
      <View ref={tour.ref('lista')} collapsable={false}>
        <QuoteListBuilder value={list} onChange={setList} color={PURPLE} species={SPECIES_ID(pet?.species)} fetchImpl={fetchImpl} />
      </View>

      <Text style={styles.section}>2. Para qual pet? (opcional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
        {[{id: null, name: 'Não informar'}, ...pets].map(p => (
          <TouchableOpacity
            key={String(p.id)}
            style={[styles.chip, petId === p.id && styles.chipActive]}
            onPress={() => setPetId(p.id)}
            testID={`pet-${p.id || 'nenhum'}`}>
            {p.id ? <Ionicons name="paw" size={14} color={petId === p.id ? '#FFFFFF' : '#6B7280'} /> : null}
            <Text style={[styles.chipText, petId === p.id && {color: '#FFFFFF'}]}>
              {p.name}
              {p.weight ? ` · ${p.weight} kg` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={styles.hint}>Espécie e peso ajudam a loja a acertar a dose e o tamanho. Seu nome não aparece para as lojas.</Text>

      <Text style={styles.section}>3. Prazo para as propostas</Text>
      <View style={{flexDirection: 'row', gap: 8}}>
        {QUOTE_DEADLINES.map(d => (
          <TouchableOpacity
            key={d.hours}
            style={[styles.chip, {flex: 1, justifyContent: 'center'}, hours === d.hours && styles.chipActive]}
            onPress={() => setHours(d.hours)}
            testID={`prazo-${d.hours}`}>
            <Text style={[styles.chipText, hours === d.hours && {color: '#FFFFFF'}]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.section}>4. Receita e observações (opcional)</Text>
      {photo ? (
        <View style={styles.photoRow}>
          <Image source={{uri: photo.uri}} style={styles.photo} />
          <Text style={{flex: 1, color: '#374151'}}>Receita anexada. Só as lojas que recebem o pedido veem.</Text>
          <Pressable onPress={() => setPhoto(null)} accessibilityLabel="Remover receita">
            <Ionicons name="close-circle" size={24} color="#9CA3AF" />
          </Pressable>
        </View>
      ) : (
        <View style={{flexDirection: 'row', gap: 8}}>
          <TouchableOpacity style={[styles.chip, {flex: 1, justifyContent: 'center'}]} onPress={() => pickPhoto('camera')} ref={tour.ref('receita')} testID="receita-camera">
            <Ionicons name="camera" size={16} color="#6B7280" />
            <Text style={styles.chipText}>Fotografar receita</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, {flex: 1, justifyContent: 'center'}]} onPress={() => pickPhoto('library')}>
            <Ionicons name="image" size={16} color="#6B7280" />
            <Text style={styles.chipText}>Da galeria</Text>
          </TouchableOpacity>
        </View>
      )}
      <TextInput
        style={styles.notes}
        placeholder="Ex.: preciso até sexta; marca preferida; entrega no bairro…"
        placeholderTextColor="#9CA3AF"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={500}
        testID="observacoes"
      />

      <TouchableOpacity
        style={[styles.send, (!list.length || sending) && {opacity: 0.5}]}
        onPress={send}
        disabled={!list.length || sending}
        testID="enviar-orcamento">
        <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
        <Text style={styles.sendText}>{sending ? 'Enviando…' : `Pedir orçamento (${list.length} ${list.length === 1 ? 'item' : 'itens'})`}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F6F5FB'},
  hero: {flexDirection: 'row', gap: 10, backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14, alignItems: 'center'},
  heroText: {
    ...F.regular, flex: 1, fontSize: 13, color: '#4C1D95', lineHeight: 18},
  section: {fontSize: 15, ...F.heavy, color: '#1F2937', marginTop: 20, marginBottom: 8},
  hint: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginTop: 6},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {backgroundColor: PURPLE, borderColor: PURPLE},
  chipText: {fontSize: 13, ...F.semibold, color: '#4B5563'},
  photoRow: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10},
  photo: {width: 56, height: 56, borderRadius: 8, backgroundColor: '#F3F4F6'},
  notes: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    minHeight: 70,
    marginTop: 10,
    textAlignVertical: 'top',
    color: '#1F2937',
  },
  send: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PURPLE,
    borderRadius: 14,
    height: 54,
    marginTop: 24,
  },
  sendText: {color: '#FFFFFF', fontSize: 16, ...F.heavy, },
});
