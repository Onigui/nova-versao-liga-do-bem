import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, Switch, Text, View} from 'react-native';
import {
  COLORS,
  formatDateBR,
  maskDate,
  parseDateBR,
  usePartner,
} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';

/** Valida o formulário e monta o corpo da API. Retorna {error} ou {body}. */
export function buildDiscountPayload(form) {
  const name = form.name.trim();
  if (!name) return {error: 'Dê um nome para a promoção.'};
  const value = Number(String(form.value).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0)
    return {error: 'Informe o valor do desconto.'};
  if (form.type === 'percent' && value > 100)
    return {error: 'O percentual vai até 100%.'};
  const validFrom = parseDateBR(form.validFrom);
  const validUntil = parseDateBR(form.validUntil, true);
  if (validFrom === undefined)
    return {error: 'Data de início inválida (use dd/mm/aaaa).'};
  if (validUntil === undefined)
    return {error: 'Data de fim inválida (use dd/mm/aaaa).'};
  if (validFrom && validUntil && new Date(validUntil) < new Date(validFrom)) {
    return {error: 'A data de fim é antes do início.'};
  }
  const body = {
    name,
    description: form.description.trim() || null,
    isActive: form.isActive,
    validUntil,
    ...(validFrom ? {validFrom} : {}),
  };
  if (form.type === 'percent') body.percentage = value;
  else body.fixedAmount = value;
  return {body};
}

export default function DiscountFormScreen({route, navigation}) {
  const {api} = usePartner();
  const existing = route?.params?.discount;
  const [form, setForm] = useState({
    name: existing?.name || '',
    description: existing?.description || '',
    type: existing?.fixedAmount != null ? 'fixed' : 'percent',
    value:
      existing?.percentage != null
        ? String(existing.percentage)
        : existing?.fixedAmount != null
        ? String(existing.fixedAmount).replace('.', ',')
        : '',
    validFrom: existing ? formatDateBR(existing.validFrom) : '',
    validUntil: existing?.validUntil ? formatDateBR(existing.validUntil) : '',
    isActive: existing ? !!existing.isActive : true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = patch => setForm(f => ({...f, ...patch}));

  const save = async () => {
    const {error: err, body} = buildDiscountPayload(form);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (existing) await api('PUT', `/partner/discounts/${existing.id}`, body);
      else await api('POST', '/partner/discounts', body);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert(
      'Remover promoção?',
      'Ela sai do app dos membros. O histórico de uso continua guardado.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api('DELETE', `/partner/discounts/${existing.id}`);
              navigation.goBack();
            } catch (e) {
              setError(e.message);
            }
          },
        },
      ],
    );

  const typeBtn = (key, label) => (
    <Pressable
      onPress={() => set({type: key})}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
        borderColor: form.type === key ? COLORS.primary : COLORS.border,
        backgroundColor: form.type === key ? COLORS.primarySoft : '#FFFFFF',
      }}>
      <Text
        style={{
          fontWeight: '700',
          color: form.type === key ? COLORS.primaryDark : COLORS.muted,
        }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled">
      <Card>
        <Field
          label="Nome da promoção"
          placeholder="Ex.: Banho e tosa para membros"
          value={form.name}
          onChangeText={v => set({name: v})}
          maxLength={120}
          testID="nome"
        />
        <Field
          label="Descrição (opcional)"
          placeholder="Regras, dias da semana, produtos…"
          value={form.description}
          onChangeText={v => set({description: v})}
          multiline
          maxLength={1000}
        />
        <Text style={ui.label}>Tipo de desconto</Text>
        <View style={{flexDirection: 'row', gap: 8, marginBottom: 12}}>
          {typeBtn('percent', 'Percentual (%)')}
          {typeBtn('fixed', 'Valor (R$)')}
        </View>
        <Field
          label={
            form.type === 'percent' ? 'Percentual' : 'Valor do desconto (R$)'
          }
          placeholder={form.type === 'percent' ? '10' : '15,00'}
          keyboardType="decimal-pad"
          value={form.value}
          onChangeText={v => set({value: v.replace(/[^\d,]/g, '')})}
          testID="valor"
        />
        <View style={{flexDirection: 'row', gap: 10}}>
          <Field
            style={{flex: 1}}
            label="Início"
            placeholder="hoje"
            keyboardType="number-pad"
            value={form.validFrom}
            onChangeText={v => set({validFrom: maskDate(v)})}
          />
          <Field
            style={{flex: 1}}
            label="Fim (opcional)"
            placeholder="dd/mm/aaaa"
            keyboardType="number-pad"
            value={form.validUntil}
            onChangeText={v => set({validUntil: maskDate(v)})}
          />
        </View>
        <View
          style={[ui.row, {justifyContent: 'space-between', marginBottom: 8}]}>
          <View style={{flex: 1}}>
            <Text style={{fontWeight: '700', color: COLORS.text}}>
              Promoção ativa
            </Text>
            <Text style={ui.muted}>Desligue para pausar sem apagar.</Text>
          </View>
          <Switch
            value={form.isActive}
            onValueChange={v => set({isActive: v})}
            trackColor={{true: COLORS.primary}}
          />
        </View>
        {error ? (
          <Text style={[ui.error, {marginBottom: 10, fontSize: 14}]}>
            {error}
          </Text>
        ) : null}
        <Button
          title={existing ? 'Salvar alterações' : 'Publicar promoção'}
          onPress={save}
          loading={saving}
          testID="salvar"
        />
        {existing ? (
          <Button
            title="Remover promoção"
            variant="danger"
            onPress={remove}
            style={{marginTop: 10}}
          />
        ) : null}
      </Card>
    </ScrollView>
  );
}
