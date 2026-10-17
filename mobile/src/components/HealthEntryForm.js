/**
 * Formulário de registro de saúde (tutor e veterinário).
 */
import React, {useState} from 'react';
import {Alert, Image, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {HEALTH_KINDS, dayLabel, parseDateInput, todayInput} from '../utils/health';
import {F} from '../theme/home';
import {getPicker} from '../utils/photoPicker';


const TITLE_HINT = {
  CONSULTA: 'Motivo da consulta (ex.: coceira, check-up)',
  EXAME: 'Nome do exame (ex.: hemograma)',
  CIRURGIA: 'Procedimento (ex.: castração, limpeza de tártaro)',
  MEDICACAO: 'Remédio e dose (ex.: Apoquel 5,4 mg)',
  SINTOMA: 'O que aconteceu (ex.: vômito, diarreia)',
  PESO: 'Pesagem',
  OBSERVACAO: 'Título da anotação',
};

/** Monta o corpo do registro; {error} se faltar algo. */
export function buildEntryBody(form) {
  const date = parseDateInput(form.date);
  if (!date) return {error: 'Data inválida. Use DD/MM/AAAA.'};
  const returnDate = form.returnDate ? parseDateInput(form.returnDate) : null;
  if (form.returnDate && !returnDate) return {error: 'Data de retorno inválida. Use DD/MM/AAAA.'};
  const weight = String(form.weight || '').trim();
  if (form.kind === 'PESO' && !weight) return {error: 'Informe o peso.'};
  if (form.kind !== 'PESO' && String(form.title || '').trim().length < 2) return {error: 'Preencha o título.'};
  // Campos vazios vão como null: na edição, apagar o texto apaga no servidor também
  const body = {kind: form.kind, date, title: String(form.title || '').trim() || undefined, weight: weight ? weight.replace(',', '.') : null};
  for (const k of ['details', 'guidance', 'clinicName']) body[k] = String(form[k] || '').trim() || null;
  body.returnDate = returnDate;
  if (form.photo !== undefined) body.photo = form.photo;
  return {body};
}

export default function HealthEntryForm({mode = 'TUTOR', initial, color = '#7C3AED', onSubmit, saving, submitLabel}) {
  const isVet = mode === 'VET';
  const [form, setForm] = useState(() => ({
    kind: initial?.kind || 'CONSULTA',
    date: initial?.date ? dayLabel(initial.date) : todayInput(),
    title: initial?.title || '',
    details: initial?.details || '',
    guidance: initial?.guidance || '',
    weight: initial?.weight != null ? String(initial.weight).replace('.', ',') : '',
    returnDate: initial?.returnDate ? dayLabel(initial.returnDate) : '',
    clinicName: initial?.clinicName || '',
    photo: undefined,
    photoUri: null,
    hadPhoto: !!initial?.hasPhoto,
  }));
  const set = patch => setForm(f => ({...f, ...patch}));

  const pick = async kind => {
    const launch = getPicker(kind);
    if (!launch) return;
    const res = await launch({mediaType: 'photo', maxWidth: 1400, maxHeight: 1400, quality: 0.6, includeBase64: true, saveToPhotos: false});
    const a = res?.assets?.[0];
    if (!a?.base64) return;
    if (a.base64.length * 0.75 > 780 * 1024) {
      Alert.alert('Foto muito grande', 'Tente de novo um pouco mais de longe.');
      return;
    }
    set({photo: `data:${a.type || 'image/jpeg'};base64,${a.base64}`, photoUri: a.uri});
  };

  const submit = () => {
    const {error, body} = buildEntryBody(form);
    if (error) {
      Alert.alert('Confira o registro', error);
      return;
    }
    onSubmit(body);
  };

  const field = (key, label, props = {}) => (
    <View style={{marginTop: 12}}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, props.multiline && {minHeight: 80, textAlignVertical: 'top'}]}
        value={form[key]}
        onChangeText={t => set({[key]: t})}
        placeholderTextColor="#9CA3AF"
        testID={`campo-${key}`}
        {...props}
      />
    </View>
  );

  return (
    <View>
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.kinds}>
        {HEALTH_KINDS.filter(k => !isVet || k.id !== 'SINTOMA').map(k => (
          <TouchableOpacity
            key={k.id}
            style={[styles.kind, form.kind === k.id && {backgroundColor: color, borderColor: color}]}
            onPress={() => set({kind: k.id})}
            testID={`tipo-${k.id}`}>
            <Ionicons name={k.icon} size={15} color={form.kind === k.id ? '#FFFFFF' : k.color} />
            <Text style={[styles.kindText, form.kind === k.id && {color: '#FFFFFF'}]}>{k.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {field('date', 'Data', {placeholder: 'DD/MM/AAAA', keyboardType: 'numbers-and-punctuation', maxLength: 10})}
      {form.kind !== 'PESO' ? field('title', isVet && form.kind === 'CONSULTA' ? 'Motivo do atendimento' : 'Título', {placeholder: TITLE_HINT[form.kind], maxLength: 100}) : null}
      {field('weight', form.kind === 'PESO' ? 'Peso (kg)' : 'Peso (kg, opcional)', {placeholder: 'Ex.: 12,5', keyboardType: 'decimal-pad', maxLength: 6})}
      {form.kind !== 'PESO'
        ? field('details', isVet ? 'Avaliação / diagnóstico' : 'Detalhes', {
            placeholder: isVet ? 'O que foi visto no exame clínico' : 'Resultado, como o pet ficou, o que o veterinário disse…',
            multiline: true,
            maxLength: 2000,
          })
        : null}
      {form.kind !== 'PESO' && (isVet || form.kind === 'CONSULTA' || form.kind === 'MEDICACAO')
        ? field('guidance', 'Orientações / tratamento', {placeholder: 'Ex.: 1 comprimido a cada 12 h por 7 dias', multiline: true, maxLength: 2000})
        : null}
      {form.kind !== 'PESO' ? field('returnDate', 'Retorno (opcional)', {placeholder: 'DD/MM/AAAA', keyboardType: 'numbers-and-punctuation', maxLength: 10}) : null}
      {!isVet && form.kind !== 'PESO' ? field('clinicName', 'Clínica ou laboratório (opcional)', {maxLength: 100}) : null}

      {form.kind !== 'PESO' ? (
        <View style={{marginTop: 12}}>
          <Text style={styles.label}>Foto (resultado de exame, receita…)</Text>
          {form.photoUri || (form.hadPhoto && form.photo === undefined) ? (
            <View style={styles.photoRow}>
              {form.photoUri ? <Image source={{uri: form.photoUri}} style={styles.photo} /> : <Ionicons name="image" size={36} color="#9CA3AF" />}
              <Text style={{flex: 1, color: '#374151'}}>{form.photoUri ? 'Foto nova anexada' : 'Já tem foto'}</Text>
              <Pressable onPress={() => set({photo: form.hadPhoto ? null : undefined, photoUri: null, hadPhoto: false})} accessibilityLabel="Remover foto">
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </Pressable>
            </View>
          ) : (
            <View style={{flexDirection: 'row', gap: 8}}>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pick('camera')}>
                <Ionicons name="camera" size={16} color="#6B7280" />
                <Text style={styles.kindText}>Câmera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pick('library')}>
                <Ionicons name="image" size={16} color="#6B7280" />
                <Text style={styles.kindText}>Galeria</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      <TouchableOpacity style={[styles.save, {backgroundColor: color}, saving && {opacity: 0.6}]} onPress={submit} disabled={saving} testID="salvar-registro">
        <Text style={styles.saveText}>{saving ? 'Salvando…' : submitLabel || 'Salvar'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {fontSize: 13, ...F.bold, color: '#374151', marginBottom: 6},
  kinds: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  kind: {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB'},
  kindText: {fontSize: 13, ...F.semibold, color: '#4B5563'},
  input: {
    ...F.regular, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1F2937'},
  photoRow: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10},
  photo: {width: 56, height: 56, borderRadius: 8},
  photoBtn: {flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB'},
  save: {height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20},
  saveText: {color: '#FFFFFF', ...F.heavy, fontSize: 16},
});
