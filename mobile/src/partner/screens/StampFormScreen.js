/**
 * Carimbo: vacina, vermífugo ou antipulgas aplicado agora. Nome e CRMV do veterinário e a
 * clínica são preenchidos pelo servidor (não dá para "assinar" por outra pessoa).
 * Com `record` nos parâmetros, corrige um carimbo da clínica feito há menos de 24 h.
 */
import React, {useMemo, useState} from 'react';
import {Alert, Image, PermissionsAndroid, Platform, Pressable, ScrollView, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, formatDateBR, usePartner} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';
import {
  MANUFACTURERS,
  NEXT_DOSE_OPTIONS,
  RECORD_CATEGORIES,
  addDays,
  catalogFor,
  categoryLabel,
} from '../../utils/vaccineCatalog';

function getCamera() {
  try {
    return require('react-native-image-picker').launchCamera || null;
  } catch {
    return null;
  }
}

function Chip({label, active, onPress, testID, icon}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityState={{selected: !!active}}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? COLORS.primary : '#CBD5E1',
        backgroundColor: active ? COLORS.primary : '#FFFFFF',
      }}>
      {icon ? <Icon name={icon} size={14} color={active ? '#FFFFFF' : COLORS.muted} /> : null}
      <Text style={{fontWeight: '600', fontSize: 13, color: active ? '#FFFFFF' : '#334155'}}>{label}</Text>
    </Pressable>
  );
}

/** Corpo da API a partir do formulário. {error} ou {body}. */
export function buildStampBody(form, now = new Date()) {
  const name = form.vaccineName.trim();
  if (!name) return {error: 'Escolha ou escreva o nome.'};
  if (form.category === 'VACCINE' && !form.batchNumber.trim()) return {error: 'Informe o lote da vacina (está no frasco ou no selo).'};
  const weight = form.petWeight.trim() ? Number(form.petWeight.replace(',', '.')) : null;
  if (weight != null && (!Number.isFinite(weight) || weight <= 0 || weight > 150)) return {error: 'Peso inválido.'};
  const app = form.applicationDate ? new Date(form.applicationDate) : now;
  const body = {
    category: form.category,
    vaccineName: name,
    vaccineType: form.vaccineType.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    batchNumber: form.batchNumber.trim() || null,
    notes: form.notes.trim() || null,
    petWeight: weight,
    nextDoseDate: form.nextDays ? addDays(app, form.nextDays).toISOString() : null,
  };
  if (form.labelPhoto) body.labelPhoto = form.labelPhoto;
  return {body};
}

export default function StampFormScreen({route, navigation}) {
  const {api} = usePartner();
  const {visitId, pet, record} = route?.params || {};
  const editing = !!record;
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const [form, setForm] = useState(() => ({
    category: record?.category || 'VACCINE',
    vaccineName: record?.vaccineName || '',
    vaccineType: record?.vaccineType || '',
    manufacturer: record?.manufacturer || '',
    batchNumber: record?.batchNumber || '',
    notes: record?.notes || '',
    petWeight: record?.petWeight != null ? String(record.petWeight).replace('.', ',') : pet?.weight ? String(pet.weight).replace('.', ',') : '',
    nextDays: record ? (record.nextDoseDate ? daysBetween(record.applicationDate, record.nextDoseDate) : 0) : 365,
    applicationDate: record?.applicationDate || null,
    labelPhoto: null,
    photoUri: null,
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = patch => setForm(f => ({...f, ...patch}));

  const catalog = useMemo(() => catalogFor(form.category, pet?.species), [form.category, pet?.species]);
  const pickCatalog = item =>
    set({vaccineName: item.name, vaccineType: item.type || '', nextDays: item.nextDays ?? form.nextDays});
  const setCategory = c => {
    const first = catalogFor(c, pet?.species)[0];
    set({category: c, vaccineName: '', vaccineType: '', nextDays: first?.nextDays ?? 365});
  };

  const takePhoto = async () => {
    const launchCamera = getCamera();
    if (!launchCamera) {
      Alert.alert('Câmera', 'Câmera indisponível neste aparelho.');
      return;
    }
    if (Platform.OS === 'android') {
      const ok = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (ok !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    const res = await launchCamera({mediaType: 'photo', maxWidth: 1000, maxHeight: 1000, quality: 0.6, includeBase64: true, saveToPhotos: false});
    const a = res?.assets?.[0];
    if (!a?.base64) return;
    if (a.base64.length * 0.75 > 600 * 1024) {
      Alert.alert('Foto muito grande', 'Tente de novo um pouco mais perto do selo.');
      return;
    }
    set({labelPhoto: `data:${a.type || 'image/jpeg'};base64,${a.base64}`, photoUri: a.uri});
  };

  const send = async (confirmDuplicate = false) => {
    const {error: err, body} = buildStampBody(form);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSaving(true);
    try {
      let r;
      if (editing) {
        const {labelPhoto, ...patch} = body; // a foto do selo não muda na correção
        r = await api('PUT', `/partner/records/${record.id}`, patch);
      } else {
        r = await api('POST', `/partner/pets/visits/${visitId}/records`, {...body, ...(confirmDuplicate ? {confirmDuplicate: true} : {})});
      }
      navigation.navigate({name: 'PetVisit', params: {saved: r.record}, merge: true});
      if (!editing) Alert.alert('Carimbado! ✅', `${body.vaccineName} já está na carteira de ${pet?.name}. O tutor recebeu um aviso.`);
    } catch (e) {
      if (e.code === 'DUPLICATE' || /já foi carimbada/.test(e.message)) {
        Alert.alert('Já carimbada hoje', e.message, [
          {text: 'Cancelar', style: 'cancel'},
          {text: 'É outra dose, carimbar', onPress: () => send(true)},
        ]);
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const voidStamp = () =>
    Alert.alert('Anular carimbo?', 'O registro sai da carteira do pet. A anulação fica registrada.', [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', `/partner/records/${record.id}`);
            navigation.navigate({name: 'PetVisit', params: {removed: record.id}, merge: true});
          } catch (e) {
            setError(e.message);
          }
        },
      },
    ]);

  const nextDate = form.nextDays ? addDays(form.applicationDate || new Date(), form.nextDays) : null;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Text style={[ui.muted, {marginBottom: 10}]}>
        {editing ? 'Correção do carimbo' : 'Carimbo'} na carteira de <Text style={{fontWeight: '800', color: COLORS.text}}>{pet?.name}</Text>
        {' · '}aplicado em {formatDateBR(form.applicationDate || new Date().toISOString())}
      </Text>

      <Card>
        <Text style={ui.label}>O que foi aplicado?</Text>
        <View style={{flexDirection: 'row', gap: 8, marginBottom: 14}}>
          {RECORD_CATEGORIES.map(c => (
            <Chip key={c.id} label={c.label} icon={c.icon} active={form.category === c.id} onPress={() => setCategory(c.id)} testID={`cat-${c.id}`} />
          ))}
        </View>

        <Text style={ui.label}>{categoryLabel(form.category)}</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10}}>
          {catalog.map(item => (
            <Chip
              key={item.name}
              label={item.name}
              active={form.vaccineName === item.name}
              onPress={() => pickCatalog(item)}
              testID={`item-${item.name}`}
            />
          ))}
        </View>
        <Field
          placeholder="Ou escreva o nome"
          value={form.vaccineName}
          onChangeText={v => set({vaccineName: v})}
          maxLength={80}
          testID="nome-produto"
        />

        <Text style={ui.label}>Laboratório</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10}}>
          {MANUFACTURERS.map(m => (
            <Chip key={m} label={m} active={form.manufacturer === m} onPress={() => set({manufacturer: form.manufacturer === m ? '' : m})} />
          ))}
        </View>
        <View style={{flexDirection: 'row', gap: 10}}>
          <Field
            style={{flex: 1}}
            label={form.category === 'VACCINE' ? 'Lote *' : 'Lote'}
            value={form.batchNumber}
            onChangeText={v => set({batchNumber: v.toUpperCase()})}
            autoCapitalize="characters"
            maxLength={40}
            testID="lote"
          />
          <Field
            style={{flex: 1}}
            label="Peso (kg)"
            value={form.petWeight}
            onChangeText={v => set({petWeight: v.replace(/[^\d,]/g, '')})}
            keyboardType="decimal-pad"
            testID="peso"
          />
        </View>

        <Text style={ui.label}>Próxima dose</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4}}>
          {NEXT_DOSE_OPTIONS.map(o => (
            <Chip key={o.days} label={o.label} active={form.nextDays === o.days} onPress={() => set({nextDays: o.days})} testID={`prox-${o.days}`} />
          ))}
        </View>
        <Text style={[ui.hint, {marginBottom: 12}]} testID="prox-data">
          {nextDate ? `Lembrete para o tutor em ${formatDateBR(nextDate.toISOString())}.` : 'Sem lembrete de próxima dose.'}
        </Text>

        {!editing ? (
          <>
            <Text style={ui.label}>Foto do selo / etiqueta (recomendado)</Text>
            {form.photoUri ? (
              <View style={[ui.row, {gap: 12, marginBottom: 12}]}>
                <Image source={{uri: form.photoUri}} style={{width: 72, height: 72, borderRadius: 10}} />
                <Button title="Tirar outra" variant="secondary" onPress={takePhoto} style={{flex: 1, minHeight: 42}} />
              </View>
            ) : (
              <Button
                title="Fotografar o selo"
                variant="secondary"
                icon={<Icon name="camera" size={18} color={COLORS.primary} />}
                onPress={takePhoto}
                style={{marginBottom: 12, minHeight: 44}}
                testID="foto-selo"
              />
            )}
          </>
        ) : null}

        <Field
          label="Observações (opcional)"
          value={form.notes}
          onChangeText={v => set({notes: v})}
          multiline
          maxLength={500}
          placeholder="Reações, orientações, dose de reforço…"
        />
      </Card>

      {error ? <Text style={[ui.error, {marginBottom: 10, fontSize: 14}]} testID="erro-carimbo">{error}</Text> : null}
      <Button
        title={editing ? 'Salvar correção' : 'Carimbar na carteira'}
        icon={<Icon name="ribbon" size={20} color="#FFFFFF" />}
        onPress={() => send(false)}
        loading={saving}
        testID="confirmar-carimbo"
      />
      <Text style={[ui.muted, {textAlign: 'center', marginTop: 8, fontSize: 12}]}>
        Vai com seu nome e CRMV. Você pode corrigir ou anular em até 24 horas.
      </Text>
      {editing ? <Button title="Anular carimbo" variant="danger" onPress={voidStamp} style={{marginTop: 12}} /> : null}
    </ScrollView>
  );
}
