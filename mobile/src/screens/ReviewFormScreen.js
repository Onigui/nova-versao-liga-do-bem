/**
 * Avaliar uma empresa parceira. Só quem foi atendido (carteirinha, reserva ou veterinário)
 * consegue avaliar; dá para editar depois.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {Stars} from '../components/Reviews';
import {RATING_WORDS} from '../utils/health';
import {memberApi} from '../utils/quotes';
import {F} from '../theme/home';

const PURPLE = '#7C3AED';

export default function ReviewFormScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const {partnerId, partnerName} = route?.params || {};
  const [info, setInfo] = useState(null);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation?.setOptions?.({title: partnerName ? `Avaliar ${partnerName}` : 'Avaliar'});
    api('GET', `/partners/${partnerId}/reviews?limit=1`)
      .then(d => {
        setInfo(d);
        const mine = d.me?.review;
        if (mine) {
          setRating(mine.rating);
          setTags(mine.tags || []);
          setComment(mine.comment || '');
        }
      })
      .catch(e => setError(e.message));
  }, [api, partnerId, partnerName, navigation]);

  const toggle = id => setTags(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]));
  const needsText = rating > 0 && rating <= 2 && comment.trim().length < 10;

  const save = async () => {
    setSaving(true);
    try {
      await api('POST', `/partners/${partnerId}/reviews`, {rating, tags, comment: comment.trim() || undefined});
      Alert.alert('Obrigado!', 'Sua avaliação ajuda outros tutores.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível enviar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Apagar sua avaliação?', '', [
      {text: 'Voltar', style: 'cancel'},
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', `/reviews/${info.me.review.id}`);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erro', e.message);
          }
        },
      },
    ]);

  if (!info) return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{marginTop: 40}} color={PURPLE} />;

  if (info.me && !info.me.canReview) {
    return (
      <View style={{padding: 24}}>
        <Text style={styles.title}>Ainda não dá para avaliar</Text>
        <Text style={styles.text} testID="sem-visita">
          {info.me.reason === 'OWN_COMPANY'
            ? 'Você faz parte desta empresa, então não pode avaliá-la.'
            : 'Só quem foi atendido pode avaliar: mostre a carteirinha no caixa, conclua uma reserva de orçamento ou leve o pet para o veterinário ler o QR. Assim as notas são de clientes de verdade.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#F9FAFB'}} contentContainerStyle={{padding: 20, paddingBottom: 40}} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Como foi na {partnerName || 'empresa'}?</Text>
      {info.me?.review?.hidden ? (
        <Text style={[styles.text, {color: '#B45309'}]}>Sua avaliação está escondida pela Liga após análise. Você pode editá-la.</Text>
      ) : null}
      <View style={{alignItems: 'center', marginVertical: 20}}>
        <Stars rating={rating} size={40} onChange={setRating} />
        <Text style={styles.word}>{RATING_WORDS[rating] || 'Toque nas estrelas'}</Text>
      </View>
      <Text style={styles.label}>O que se destacou?</Text>
      <View style={styles.tags}>
        {(info.tags || []).map(t => (
          <TouchableOpacity key={t.id} style={[styles.tag, tags.includes(t.id) && styles.tagOn]} onPress={() => toggle(t.id)} testID={`tag-${t.id}`}>
            <Text style={[styles.tagText, tags.includes(t.id) && {color: '#FFFFFF'}]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.label, {marginTop: 16}]}>{rating && rating <= 2 ? 'Conte o que aconteceu' : 'Comentário (opcional)'}</Text>
      <TextInput
        style={styles.input}
        multiline
        maxLength={600}
        value={comment}
        onChangeText={setComment}
        placeholder="Atendimento, preço, cuidado com o pet…"
        placeholderTextColor="#9CA3AF"
        testID="comentario"
      />
      <Text style={styles.hint}>Aparece com seu primeiro nome e a inicial do sobrenome. A empresa pode responder.</Text>
      <TouchableOpacity
        style={[styles.save, (!rating || needsText || saving) && {opacity: 0.5}]}
        disabled={!rating || needsText || saving}
        onPress={save}
        testID="enviar-avaliacao">
        <Text style={styles.saveText}>{saving ? 'Enviando…' : info.me?.review ? 'Salvar alterações' : 'Enviar avaliação'}</Text>
      </TouchableOpacity>
      {info.me?.review ? (
        <TouchableOpacity onPress={remove} style={{alignSelf: 'center', marginTop: 16}}>
          <Text style={{color: '#B91C1C', fontWeight: '600'}}>Apagar minha avaliação</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: {color: '#B91C1C', margin: 24},
  title: {fontSize: 22, ...F.heavy, color: '#1F2937', textAlign: 'center'},
  text: {
    ...F.regular, fontSize: 14, color: '#4B5563', marginTop: 10, lineHeight: 20, textAlign: 'center'},
  word: {fontSize: 15, ...F.bold, color: '#92400E', marginTop: 8},
  label: {fontSize: 14, ...F.bold, color: '#374151', marginBottom: 8},
  tags: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  tag: {paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB'},
  tagOn: {backgroundColor: '#F59E0B', borderColor: '#F59E0B'},
  tagText: {fontSize: 13, ...F.semibold, color: '#4B5563'},
  input: {backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, minHeight: 100, textAlignVertical: 'top', color: '#1F2937'},
  hint: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginTop: 6},
  save: {height: 52, borderRadius: 14, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', marginTop: 20},
  saveText: {color: '#FFFFFF', ...F.heavy, fontSize: 16},
});
