/**
 * Nova promoção / editar promoção. O parceiro escolhe o TIPO (cada um aparece de um jeito
 * para o membro, sem confusão entre "desconto" e "preço final") e vê a prévia na hora.
 */
import React, {useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, Switch, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  COLORS,
  formatDateBR,
  maskDate,
  parseDateBR,
  usePartner,
} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';
import PromoCard from '../../components/PromoCard';
import PartnerListCard from '../../components/PartnerListCard';
import {BENEFIT_TEXT_MAX, PROMO_KINDS, describePromo, promoKind} from '../../utils/promo';

const ALIASES = {percent: 'PERCENT', fixed: 'AMOUNT_OFF'};
const toNumber = v => Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
const fromNumber = v => (v == null ? '' : String(v).replace('.', ','));

/** Valida o formulário e monta o corpo da API. Retorna {error} ou {body}. */
export function buildDiscountPayload(form) {
  const name = form.name.trim();
  if (!name) return {error: 'Dê um nome para a promoção.'};
  const kind = ALIASES[form.type] || form.type || 'PERCENT';
  const body = {name, description: form.description.trim() || null, isActive: form.isActive, kind};

  if (kind === 'OTHER') {
    const text = String(form.benefitText || '').trim();
    if (!text) return {error: 'Descreva o benefício (ex.: Leve 3, pague 2).'};
    if (text.length > BENEFIT_TEXT_MAX) return {error: `O benefício tem no máximo ${BENEFIT_TEXT_MAX} letras.`};
    body.benefitText = text;
  } else {
    const value = toNumber(form.value);
    if (!Number.isFinite(value) || value <= 0)
      return {
        error:
          kind === 'PERCENT'
            ? 'Informe o percentual de desconto.'
            : kind === 'AMOUNT_OFF'
              ? 'Informe quanto será descontado (R$).'
              : 'Informe o preço promocional.',
      };
    if (kind === 'PERCENT' && value > 100) return {error: 'O percentual vai até 100%.'};
    if (kind === 'PERCENT') body.percentage = value;
    if (kind === 'AMOUNT_OFF') body.fixedAmount = value;
    if (kind === 'FINAL_PRICE') {
      body.promoPrice = value;
      const orig = String(form.originalPrice || '').trim() ? toNumber(form.originalPrice) : null;
      if (orig != null && (!Number.isFinite(orig) || orig <= value))
        return {error: 'O preço normal precisa ser maior que o preço promocional.'};
      body.originalPrice = orig;
    }
  }

  const validFrom = parseDateBR(form.validFrom);
  const validUntil = parseDateBR(form.validUntil, true);
  if (validFrom === undefined) return {error: 'Data de início inválida (use dd/mm/aaaa).'};
  if (validUntil === undefined) return {error: 'Data de fim inválida (use dd/mm/aaaa).'};
  if (validFrom && validUntil && new Date(validUntil) < new Date(validFrom)) {
    return {error: 'A data de fim é antes do início.'};
  }
  body.validUntil = validUntil;
  if (validFrom) body.validFrom = validFrom;
  return {body};
}

/** Promoção como ficará, para a prévia (mesmos campos que a API devolve). */
export function previewDiscount(form) {
  const kind = ALIASES[form.type] || form.type;
  const value = toNumber(form.value);
  const ok = Number.isFinite(value) && value > 0;
  const orig = String(form.originalPrice || '').trim() ? toNumber(form.originalPrice) : null;
  return {
    id: 'preview',
    name: form.name.trim() || 'Nome da promoção',
    description: form.description.trim() || null,
    kind,
    percentage: kind === 'PERCENT' && ok ? value : null,
    fixedAmount: kind === 'AMOUNT_OFF' && ok ? value : null,
    promoPrice: kind === 'FINAL_PRICE' && ok ? value : null,
    originalPrice: kind === 'FINAL_PRICE' && Number.isFinite(orig) ? orig : null,
    benefitText: kind === 'OTHER' ? form.benefitText : null,
    validUntil: parseDateBR(form.validUntil, true) || null,
  };
}

function KindCard({k, active, onPress}) {
  return (
    <Pressable
      testID={`tipo-${k.id}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{selected: active}}
      style={{
        width: '48.5%',
        borderRadius: 12,
        borderWidth: 1.5,
        padding: 10,
        borderColor: active ? COLORS.primary : COLORS.border,
        backgroundColor: active ? COLORS.primarySoft : '#FFFFFF',
      }}>
      <View style={[ui.row, {gap: 6}]}>
        <Icon name={k.icon} size={18} color={active ? COLORS.primaryDark : COLORS.muted} />
        <Text style={{fontWeight: '800', color: active ? COLORS.primaryDark : COLORS.text, flex: 1}}>
          {k.title}
        </Text>
      </View>
      <Text style={{fontSize: 12, color: COLORS.muted, marginTop: 4}}>{k.help}</Text>
      <Text style={{fontSize: 12, fontWeight: '700', color: active ? COLORS.primary : '#94A3B8', marginTop: 4}}>
        Aparece: {k.example}
      </Text>
    </Pressable>
  );
}

export default function DiscountFormScreen({route, navigation}) {
  const {api, partner} = usePartner();
  const existing = route?.params?.discount;
  const existingKind = existing ? promoKind(existing) : 'PERCENT';
  const [form, setForm] = useState({
    name: existing?.name || '',
    description: existing?.description || '',
    type: existingKind,
    value:
      existingKind === 'PERCENT'
        ? fromNumber(existing?.percentage)
        : existingKind === 'AMOUNT_OFF'
          ? fromNumber(existing?.fixedAmount)
          : existingKind === 'FINAL_PRICE'
            ? fromNumber(existing?.promoPrice)
            : '',
    originalPrice: fromNumber(existing?.originalPrice),
    benefitText: existing?.benefitText || '',
    validFrom: existing ? formatDateBR(existing.validFrom) : '',
    validUntil: existing?.validUntil ? formatDateBR(existing.validUntil) : '',
    isActive: existing ? !!existing.isActive : true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = patch => setForm(f => ({...f, ...patch}));
  const setType = type => setForm(f => ({...f, type, value: f.type === type ? f.value : ''}));

  const preview = useMemo(() => previewDiscount(form), [form]);
  const described = describePromo(preview);
  const listPreview = {
    id: 'p',
    name: partner?.name || 'Sua empresa',
    category: partner?.category || '',
    address: partner?.address || '',
    logo: partner?.logo || null,
    badge: described.badge,
  };

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
    Alert.alert('Remover promoção?', 'Ela sai do app dos membros. O histórico de uso continua guardado.', [
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
    ]);

  const kind = form.type;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={[ui.label, {fontSize: 15, marginBottom: 10}]}>Que tipo de promoção?</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14}}>
          {PROMO_KINDS.map(k => (
            <KindCard key={k.id} k={k} active={kind === k.id} onPress={() => setType(k.id)} />
          ))}
        </View>

        <Field
          label={kind === 'FINAL_PRICE' ? 'Produto ou serviço' : 'Nome da promoção'}
          placeholder={kind === 'FINAL_PRICE' ? 'Ex.: Ração Gold Premium 20 kg' : 'Ex.: Banho e tosa para membros'}
          value={form.name}
          onChangeText={v => set({name: v})}
          maxLength={120}
          testID="nome"
        />

        {kind === 'PERCENT' ? (
          <Field
            label="Percentual de desconto (%)"
            placeholder="10"
            keyboardType="decimal-pad"
            value={form.value}
            onChangeText={v => set({value: v.replace(/[^\d,]/g, '')})}
            testID="valor"
          />
        ) : null}
        {kind === 'AMOUNT_OFF' ? (
          <Field
            label="Quanto sai do preço (R$)"
            placeholder="15,00"
            keyboardType="decimal-pad"
            value={form.value}
            onChangeText={v => set({value: v.replace(/[^\d,]/g, '')})}
            hint="O membro vê: R$ 15 OFF (desconto sobre o preço)."
            testID="valor"
          />
        ) : null}
        {kind === 'FINAL_PRICE' ? (
          <View style={{flexDirection: 'row', gap: 10}}>
            <Field
              style={{flex: 1}}
              label="Preço normal (opcional)"
              placeholder="89,90"
              keyboardType="decimal-pad"
              value={form.originalPrice}
              onChangeText={v => set({originalPrice: v.replace(/[^\d,]/g, '')})}
              testID="preco-normal"
            />
            <Field
              style={{flex: 1}}
              label="Preço para membros"
              placeholder="69,90"
              keyboardType="decimal-pad"
              value={form.value}
              onChangeText={v => set({value: v.replace(/[^\d,]/g, '')})}
              testID="valor"
            />
          </View>
        ) : null}
        {kind === 'FINAL_PRICE' ? (
          <Text style={[ui.hint, {marginTop: -6, marginBottom: 12}]}>
            É o valor que o membro paga. Com o preço normal, o app mostra "De R$ 89,90 por R$ 69,90".
          </Text>
        ) : null}
        {kind === 'OTHER' ? (
          <Field
            label="Benefício"
            placeholder="Ex.: Leve 3, pague 2 · Brinde · Frete grátis"
            value={form.benefitText}
            onChangeText={v => set({benefitText: v})}
            maxLength={BENEFIT_TEXT_MAX}
            hint={`${form.benefitText.length}/${BENEFIT_TEXT_MAX} · aparece no selo da sua empresa`}
            testID="beneficio"
          />
        ) : null}

        <Field
          label="Detalhes (opcional)"
          placeholder="Regras, dias da semana, produtos…"
          value={form.description}
          onChangeText={v => set({description: v})}
          multiline
          maxLength={1000}
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
        <View style={[ui.row, {justifyContent: 'space-between', marginBottom: 4}]}>
          <View style={{flex: 1}}>
            <Text style={{fontWeight: '700', color: COLORS.text}}>Promoção ativa</Text>
            <Text style={ui.muted}>Desligue para pausar sem apagar.</Text>
          </View>
          <Switch value={form.isActive} onValueChange={v => set({isActive: v})} trackColor={{true: COLORS.primary}} />
        </View>
      </Card>

      {/* Prévia */}
      <Card style={{backgroundColor: '#F1F5F9'}}>
        <Text style={{fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: COLORS.muted}}>
          COMO O MEMBRO VÊ
        </Text>
        <View style={{marginHorizontal: -16, marginTop: -2}}>
          <PartnerListCard partner={listPreview} disabled />
        </View>
        <View style={{marginTop: 12}} testID="previa-promocao">
          <PromoCard discount={preview} />
        </View>
      </Card>

      {error ? <Text style={[ui.error, {marginBottom: 10, fontSize: 14}]}>{error}</Text> : null}
      <Button
        title={existing ? 'Salvar alterações' : 'Publicar promoção'}
        onPress={save}
        loading={saving}
        testID="salvar"
      />
      {existing ? (
        <Button title="Remover promoção" variant="danger" onPress={remove} style={{marginTop: 10}} />
      ) : null}
    </ScrollView>
  );
}
