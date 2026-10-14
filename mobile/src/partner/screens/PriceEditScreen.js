/**
 * Preço de um item (ou criação de um item próprio que não está no catálogo da Liga).
 */
import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, Switch, Text, View} from 'react-native';
import {COLORS, formatMoney, usePartner} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';

const CATEGORIES = [
  ['CONSULTAS', 'Consultas'],
  ['VACINAS', 'Vacinas'],
  ['PROCEDIMENTOS', 'Cirurgias e procedimentos'],
  ['EXAMES', 'Exames'],
  ['INTERNACAO', 'Internação'],
  ['ESTETICA', 'Banho e tosa'],
  ['HOSPEDAGEM', 'Hotel e creche'],
  ['ANTIPULGAS', 'Antipulgas e vermífugos'],
  ['MEDICAMENTOS', 'Medicamentos'],
  ['RACAO', 'Ração e petiscos'],
  ['ACESSORIOS', 'Acessórios e higiene'],
];
const SPECIES = [
  ['ALL', 'Cães e gatos'],
  ['DOG', 'Cães'],
  ['CAT', 'Gatos'],
];

export const parseMoney = t => {
  const s = String(t || '').trim();
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : NaN;
};
const toInput = v => (v == null ? '' : Number(v).toFixed(2).replace('.', ','));

/** Valida e monta o corpo. {error} | {body} */
export function buildPriceBody(form) {
  const price = parseMoney(form.price);
  const memberPrice = parseMoney(form.memberPrice);
  if (memberPrice == null) return {error: 'Informe o preço para membros.'};
  if (Number.isNaN(memberPrice)) return {error: 'Preço para membros inválido.'};
  if (Number.isNaN(price)) return {error: 'Preço normal inválido.'};
  if (price != null && memberPrice > price) return {error: 'O preço para membros não pode ser maior que o preço normal.'};
  return {body: {price, memberPrice, available: form.available, note: form.note.trim() || null}};
}

function Chip({label, active, onPress, testID}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? COLORS.primary : '#CBD5E1',
        backgroundColor: active ? COLORS.primary : '#FFFFFF',
      }}>
      <Text style={{fontSize: 13, fontWeight: '600', color: active ? '#FFFFFF' : '#334155'}}>{label}</Text>
    </Pressable>
  );
}

export default function PriceEditScreen({route, navigation}) {
  const {api} = usePartner();
  const [item, setItem] = useState(route?.params?.item || null);
  const creating = !item && route?.params?.newItem;
  const [newItem, setNewItem] = useState({category: 'PROCEDIMENTOS', name: route?.params?.presetName || '', variant: '', species: 'ALL'});
  const [form, setForm] = useState({
    price: toInput(item?.myPrice?.price),
    memberPrice: toInput(item?.myPrice?.memberPrice),
    available: item?.myPrice ? item.myPrice.available : true,
    note: item?.myPrice?.note || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = p => setForm(f => ({...f, ...p}));

  const price = parseMoney(form.price);
  const member = parseMoney(form.memberPrice);
  const pct = price > 0 && member > 0 && member < price ? Math.round((1 - member / price) * 100) : null;
  const applyPct = p => {
    if (!(price > 0)) {
      setError('Informe o preço normal para calcular o desconto.');
      return;
    }
    setError('');
    set({memberPrice: toInput(Math.round(price * (1 - p / 100) * 100) / 100)});
  };

  const save = async () => {
    const {error: err, body} = buildPriceBody(form);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSaving(true);
    try {
      let target = item;
      if (creating) {
        const r = await api('POST', '/partner/catalog-items', newItem);
        target = r.item;
        setItem(r.item);
      }
      await api('PUT', `/partner/prices/${target.id}`, body);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Tirar da tabela?', 'O item deixa de aparecer para os membros na sua empresa.', [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Tirar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', `/partner/prices/${item.id}`);
            navigation.goBack();
          } catch (e) {
            setError(e.message);
          }
        },
      },
    ]);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      {creating ? (
        <Card>
          <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 6}}>Novo item</Text>
          <Text style={[ui.muted, {marginBottom: 12}]}>
            Ele aparece na sua página. A Liga pode incluí-lo no catálogo padrão para os membros compararem.
          </Text>
          <Text style={ui.label}>Categoria</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12}}>
            {CATEGORIES.map(([id, label]) => (
              <Chip key={id} label={label} active={newItem.category === id} onPress={() => setNewItem(n => ({...n, category: id}))} testID={`nova-cat-${id}`} />
            ))}
          </View>
          <Field label="Nome" value={newItem.name} onChangeText={v => setNewItem(n => ({...n, name: v}))} maxLength={80} placeholder="Ex.: Ecocardiograma" testID="novo-nome" />
          <Field label="Detalhe (opcional)" value={newItem.variant} onChangeText={v => setNewItem(n => ({...n, variant: v}))} maxLength={60} placeholder="Ex.: porte grande, 15 kg, diária" />
          <Text style={ui.label}>Para</Text>
          <View style={{flexDirection: 'row', gap: 8, marginBottom: 4}}>
            {SPECIES.map(([id, label]) => (
              <Chip key={id} label={label} active={newItem.species === id} onPress={() => setNewItem(n => ({...n, species: id}))} />
            ))}
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={{fontSize: 18, fontWeight: '800', color: COLORS.text}}>{item?.label}</Text>
          <Text style={ui.muted}>{item?.categoryLabel}</Text>
        </Card>
      )}

      <Card>
        <View style={{flexDirection: 'row', gap: 10}}>
          <Field
            style={{flex: 1}}
            label="Preço normal (opcional)"
            value={form.price}
            onChangeText={v => set({price: v.replace(/[^\d,.]/g, '')})}
            keyboardType="decimal-pad"
            placeholder="150,00"
            testID="preco-normal"
          />
          <Field
            style={{flex: 1}}
            label="Preço para membros"
            value={form.memberPrice}
            onChangeText={v => set({memberPrice: v.replace(/[^\d,.]/g, '')})}
            keyboardType="decimal-pad"
            placeholder="120,00"
            testID="preco-membro"
          />
        </View>
        <Text style={ui.label}>Calcular pelo desconto</Text>
        <View style={{flexDirection: 'row', gap: 8, marginBottom: 12}}>
          {[5, 10, 15, 20].map(p => (
            <Chip key={p} label={`-${p}%`} active={pct === p} onPress={() => applyPct(p)} testID={`pct-${p}`} />
          ))}
        </View>
        {member > 0 ? (
          <View style={{backgroundColor: COLORS.primarySoft, borderRadius: 10, padding: 10, marginBottom: 12}} testID="previa-preco">
            <Text style={{color: COLORS.primaryDark, fontWeight: '700'}}>
              O membro vê: {formatMoney(member)}
              {pct ? ` (${pct}% abaixo do preço normal de ${formatMoney(price)})` : ''}
            </Text>
          </View>
        ) : null}
        <Field
          label="Observação (opcional)"
          value={form.note}
          onChangeText={v => set({note: v})}
          maxLength={120}
          placeholder="Ex.: inclui anestesia · sob agendamento"
        />
        <View style={[ui.row, {justifyContent: 'space-between'}]}>
          <View style={{flex: 1}}>
            <Text style={{fontWeight: '700', color: COLORS.text}}>Disponível</Text>
            <Text style={ui.muted}>Desligue quando faltar no estoque ou na agenda.</Text>
          </View>
          <Switch value={form.available} onValueChange={v => set({available: v})} trackColor={{true: COLORS.primary}} testID="disponivel" />
        </View>
      </Card>

      {error ? <Text style={[ui.error, {marginBottom: 10, fontSize: 14}]} testID="erro-preco">{error}</Text> : null}
      <Button title="Salvar preço" onPress={save} loading={saving} testID="salvar-preco" />
      {item?.myPrice ? <Button title="Tirar da tabela" variant="danger" onPress={remove} style={{marginTop: 10}} /> : null}
    </ScrollView>
  );
}
