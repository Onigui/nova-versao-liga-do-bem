/**
 * App Parceiros → Dados da empresa.
 * Edição guiada (logo por foto, categoria em chips, CEP automático, grade de horários)
 * com prévia ao vivo de como a empresa aparece para os membros no app Liga do Bem.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, usePartner} from '../PartnerContext';
import {Button, Field, styles as ui} from '../ui';
import PartnerListCard from '../../components/PartnerListCard';
import PartnerDetailScreen from '../../screens/PartnerDetailScreen';
import {toMemberPartner} from '../../utils/partnerView';
import {
  DAYS,
  PRESETS,
  emptyWeek,
  maskTime,
  normalizeTime,
  parseWeek,
  presetWeek,
  serializeWeek,
  validateWeek,
} from '../../utils/hoursGrid';

function getImagePicker() {
  try {
    return require('react-native-image-picker').launchImageLibrary || null;
  } catch {
    return null;
  }
}

export const CATEGORIES = [
  'Pet shop',
  'Clínica veterinária',
  'Farmácia veterinária',
  'Banho e tosa',
  'Hotel e creche',
  'Adestramento',
  'Ração e alimentação',
  'Outros serviços',
];

const FIELDS = [
  'name',
  'category',
  'description',
  'phone',
  'email',
  'website',
  'zipCode',
  'address',
  'city',
  'state',
  'hours',
];

const DESCRIPTION_MAX = 2000;
const LOGO_MAX_BYTES = 400 * 1024;

/** Só envia o que mudou; valida o básico antes de chamar a API. */
export function buildCompanyPatch(original, form) {
  const patch = {};
  for (const k of FIELDS) {
    const v = String(form[k] ?? '').trim();
    if (v !== String(original?.[k] ?? '').trim()) patch[k] = v || null;
  }
  for (const req of ['name', 'category', 'address', 'city', 'state', 'zipCode']) {
    if (req in patch && !patch[req])
      return {
        error: 'Nome, categoria, endereço, cidade, UF e CEP são obrigatórios.',
      };
  }
  if (patch.state && !/^[A-Za-z]{2}$/.test(patch.state))
    return {error: 'UF deve ter 2 letras.'};
  if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email))
    return {error: 'E-mail inválido.'};
  return {patch};
}

/** Junta rua, número, complemento e bairro no texto único que o app dos membros mostra. */
export function composeAddress({street, number, complement, district}) {
  let out = String(street || '').trim();
  if (!out) return '';
  if (String(number || '').trim()) out += `, ${String(number).trim()}`;
  if (String(complement || '').trim()) out += ` - ${String(complement).trim()}`;
  if (String(district || '').trim()) out += ` - ${String(district).trim()}`;
  return out;
}

/** (14) 3811-1234 / (14) 99812-3456 */
export function maskPhone(text) {
  const d = String(text || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = rest.length === 9 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

export function maskCep(text) {
  const d = String(text || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Promoções que o membro vê agora (ativas e dentro da validade). */
export function currentDiscounts(list, now = Date.now()) {
  return (Array.isArray(list) ? list : []).filter(
    d =>
      d.isActive !== false &&
      (!d.validFrom || Date.parse(d.validFrom) <= now) &&
      (!d.validUntil || Date.parse(d.validUntil) >= now),
  );
}

/** Formulário inicial a partir da empresa salva. */
export function initialForm(p) {
  return {
    name: p?.name || '',
    category: p?.category || '',
    description: p?.description || '',
    phone: p?.phone || '',
    email: p?.email || '',
    website: p?.website || '',
    zipCode: p?.zipCode || '',
    // O endereço salvo é um texto único; ele fica na "rua" até o parceiro mudar algo.
    street: p?.address || '',
    number: '',
    complement: '',
    district: '',
    city: p?.city || '',
    state: p?.state || '',
  };
}

/** Erros por campo para mostrar embaixo de cada um. */
export function fieldErrors(form) {
  const e = {};
  if (!form.name.trim()) e.name = 'Informe o nome da empresa.';
  if (!form.category.trim()) e.category = 'Escolha uma categoria.';
  if (form.zipCode.replace(/\D/g, '').length !== 8) e.zipCode = 'CEP com 8 números.';
  if (!form.street.trim()) e.street = 'Informe a rua.';
  if (!form.city.trim()) e.city = 'Informe a cidade.';
  if (!/^[A-Za-z]{2}$/.test(form.state.trim())) e.state = 'UF com 2 letras.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    e.email = 'E-mail inválido.';
  return e;
}

async function geocode(address, city, state) {
  const q = `${address}, ${city} - ${state}, Brasil`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), 6000);
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
      {
        headers: {'Accept-Language': 'pt-BR', 'User-Agent': 'LigaDoBemParceiros/1.0'},
        signal: ctrl?.signal,
      },
    );
    const j = await r.json();
    if (Array.isArray(j) && j[0]) {
      const lat = Number(j[0].lat);
      const lng = Number(j[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return {latitude: lat, longitude: lng};
    }
  } catch {
    /* sem coordenadas novas: o app usa o endereço no mapa */
  } finally {
    clearTimeout(timer);
  }
  return null;
}

/* ---------- peças visuais ---------- */

function Section({icon, title, subtitle, children, right}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={s.sectionIcon}>
          <Icon name={icon} size={18} color={COLORS.primary} />
        </View>
        <View style={{flex: 1}}>
          <Text style={s.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function Chip({label, active, onPress, testID}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[s.chip, active && s.chipActive]}
      accessibilityRole="button"
      accessibilityState={{selected: !!active}}>
      {active ? <Icon name="checkmark" size={14} color="#FFFFFF" /> : null}
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Tabs({tab, onChange}) {
  return (
    <View style={s.tabs}>
      {[
        {id: 'edit', label: 'Editar', icon: 'create-outline'},
        {id: 'preview', label: 'Como os membros veem', icon: 'eye-outline'},
      ].map(t => (
        <Pressable
          key={t.id}
          testID={`aba-${t.id}`}
          onPress={() => onChange(t.id)}
          style={[s.tab, tab === t.id && s.tabActive]}>
          <Icon name={t.icon} size={16} color={tab === t.id ? COLORS.primary : COLORS.muted} />
          <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function DayRow({day, value, error, onChange}) {
  return (
    <View style={s.dayRow}>
      <View style={s.dayHead}>
        <Text style={[s.dayLabel, !value.open && {color: COLORS.muted}]}>{day.label}</Text>
        {value.open ? (
          <View style={s.timeWrap}>
            <TextInput
              testID={`hora-${day.key}-de`}
              value={value.from}
              onChangeText={t => onChange({from: maskTime(t)})}
              onBlur={() => onChange({from: normalizeTime(value.from) || value.from})}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="08:00"
              placeholderTextColor="#94A3B8"
              style={[s.timeInput, error && s.inputError]}
            />
            <Text style={s.timeSep}>às</Text>
            <TextInput
              testID={`hora-${day.key}-ate`}
              value={value.to}
              onChangeText={t => onChange({to: maskTime(t)})}
              onBlur={() => onChange({to: normalizeTime(value.to) || value.to})}
              keyboardType="number-pad"
              maxLength={5}
              placeholder="18:00"
              placeholderTextColor="#94A3B8"
              style={[s.timeInput, error && s.inputError]}
            />
          </View>
        ) : (
          <Text style={s.closed}>Fechado</Text>
        )}
        <Switch
          testID={`dia-${day.key}`}
          value={!!value.open}
          onValueChange={open => onChange({open})}
          trackColor={{false: '#CBD5E1', true: '#5EEAD4'}}
          thumbColor={value.open ? COLORS.primary : '#F8FAFC'}
        />
      </View>
      {error ? <Text style={ui.error}>{error}</Text> : null}
    </View>
  );
}

/* ---------- tela ---------- */

export default function CompanyEditScreen({navigation}) {
  const {api, partner, setPartner} = usePartner();
  const [tab, setTab] = useState('edit');
  const [form, setForm] = useState(() => initialForm(partner));
  const parsedHours = useMemo(() => parseWeek(partner?.hours), [partner?.hours]);
  const [week, setWeek] = useState(() => parsedHours || emptyWeek());
  const [hoursTouched, setHoursTouched] = useState(false);
  const freeTextHours = !!String(partner?.hours || '').trim() && !parsedHours;
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cepState, setCepState] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const savedRef = useRef(false);

  const set = patch => setForm(f => ({...f, ...patch}));
  const setDay = (key, patch) => {
    setHoursTouched(true);
    setWeek(w => ({...w, [key]: {...w[key], ...patch}}));
  };
  const applyPreset = id => {
    setHoursTouched(true);
    setWeek(presetWeek(id));
  };
  const copyMonday = () => {
    setHoursTouched(true);
    setWeek(w => {
      const next = {...w};
      [2, 3, 4, 5].forEach(k => (next[k] = {...w[1]}));
      return next;
    });
  };

  useEffect(() => {
    let alive = true;
    api('GET', '/partner/discounts')
      .then(r => alive && setDiscounts(currentDiscounts(r?.discounts)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [api]);

  // Empresa como ficará depois de salvar (alimenta a prévia e o diff).
  const draft = useMemo(() => {
    const address =
      form.street.trim() === String(partner?.address || '').trim() &&
      !form.number.trim() &&
      !form.complement.trim() &&
      !form.district.trim()
        ? String(partner?.address || '')
        : composeAddress(form);
    return {
      ...partner,
      name: form.name,
      category: form.category,
      description: form.description,
      phone: form.phone,
      email: form.email,
      website: form.website,
      zipCode: form.zipCode,
      address,
      city: form.city,
      state: form.state.toUpperCase(),
      hours: hoursTouched ? serializeWeek(week) : partner?.hours || '',
    };
  }, [form, week, hoursTouched, partner]);

  const diff = useMemo(() => buildCompanyPatch(partner, draft), [partner, draft]);
  const dirty = !!diff.error || Object.keys(diff.patch || {}).length > 0;
  const weekErrors = hoursTouched ? validateWeek(week) : {};
  const errors = showErrors ? fieldErrors(form) : {};
  const preview = useMemo(() => toMemberPartner(draft, discounts), [draft, discounts]);

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    return navigation.addListener('beforeRemove', e => {
      if (!dirtyRef.current || savedRef.current) return;
      e.preventDefault();
      Alert.alert('Descartar alterações?', 'Você mudou dados da empresa e ainda não salvou.', [
        {text: 'Continuar editando', style: 'cancel'},
        {text: 'Descartar', style: 'destructive', onPress: () => navigation.dispatch(e.data.action)},
      ]);
    });
  }, [navigation]);

  const onCep = async text => {
    const masked = maskCep(text);
    set({zipCode: masked});
    const d = masked.replace(/\D/g, '');
    if (d.length !== 8) {
      setCepState('');
      return;
    }
    setCepState('loading');
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j.erro) {
        setCepState('notfound');
        return;
      }
      setForm(f => ({
        ...f,
        street: j.logradouro || f.street,
        district: j.bairro || f.district,
        city: j.localidade || f.city,
        state: (j.uf || f.state || '').toUpperCase(),
      }));
      setCepState('ok');
    } catch {
      setCepState('offline');
    }
  };

  const uploadLogo = async asset => {
    if (!asset?.base64) {
      Alert.alert('Foto', 'Não foi possível ler a imagem. Tente outra.');
      return;
    }
    if (asset.base64.length * 0.75 > LOGO_MAX_BYTES) {
      Alert.alert('Imagem muito grande', 'Escolha uma imagem menor (até 400 KB).');
      return;
    }
    setLogoBusy(true);
    try {
      const type = /png|webp/.test(asset.type || '') ? asset.type : 'image/jpeg';
      const r = await api('PUT', '/partner/logo', {imageBase64: `data:${type};base64,${asset.base64}`});
      if (r?.partner) setPartner(r.partner);
    } catch (e) {
      Alert.alert('Não foi possível trocar o logo', e.message);
    } finally {
      setLogoBusy(false);
    }
  };

  const pickLogo = async () => {
    const launchImageLibrary = getImagePicker();
    if (!launchImageLibrary) {
      Alert.alert('Foto', 'A galeria não está disponível neste aparelho.');
      return;
    }
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.8,
        includeBase64: true,
        selectionLimit: 1,
      });
      if (res?.didCancel) return;
      if (res?.errorMessage) {
        Alert.alert('Foto', 'Não foi possível abrir a galeria.');
        return;
      }
      await uploadLogo(res?.assets?.[0]);
    } catch {
      Alert.alert('Foto', 'Não foi possível abrir a galeria.');
    }
  };

  const removeLogo = () =>
    Alert.alert('Remover logo?', 'Os membros vão ver a inicial do nome no lugar.', [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setLogoBusy(true);
          try {
            const r = await api('DELETE', '/partner/logo');
            if (r?.partner) setPartner(r.partner);
          } catch (e) {
            Alert.alert('Não foi possível remover', e.message);
          } finally {
            setLogoBusy(false);
          }
        },
      },
    ]);

  const save = useCallback(async () => {
    setShowErrors(true);
    const fe = fieldErrors(form);
    if (Object.keys(fe).length) {
      setTab('edit');
      setError('Confira os campos destacados.');
      return;
    }
    if (Object.keys(weekErrors).length) {
      setTab('edit');
      setError('Confira os horários de funcionamento.');
      return;
    }
    if (diff.error) {
      setError(diff.error);
      return;
    }
    const patch = {...diff.patch};
    if (!Object.keys(patch).length) return;
    setError('');
    setSaving(true);
    try {
      if ('address' in patch || 'city' in patch || 'state' in patch) {
        const coords = await geocode(draft.address, draft.city, draft.state);
        if (coords) Object.assign(patch, coords);
      }
      const r = await api('PUT', '/partner/me', patch);
      savedRef.current = true;
      setPartner(r.partner);
      Alert.alert('Pronto!', 'Os dados da empresa já estão atualizados no app Liga do Bem.');
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [form, weekErrors, diff, draft, api, setPartner, navigation]);

  const categories = useMemo(() => {
    const cur = String(partner?.category || '').trim();
    return cur && !CATEGORIES.some(c => c.toLowerCase() === cur.toLowerCase())
      ? [cur, ...CATEGORIES]
      : CATEGORIES;
  }, [partner?.category]);

  const initial = (form.name || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={ui.screen}>
      <Tabs tab={tab} onChange={setTab} />

      {tab === 'preview' ? (
        <View style={{flex: 1}} testID="previa">
          <View style={s.previewHead}>
            <Text style={s.previewLabel}>NA LISTA DE PARCEIROS</Text>
            <View style={{marginHorizontal: -16, marginTop: -8}}>
              <PartnerListCard partner={preview} disabled />
            </View>
            <Text style={[s.previewLabel, {marginTop: 14}]}>AO TOCAR, A PÁGINA DA EMPRESA</Text>
          </View>
          <View style={s.phoneFrame}>
            <PartnerDetailScreen partner={preview} preview />
          </View>
        </View>
      ) : (
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={[ui.content, {paddingBottom: 120}]}
          keyboardShouldPersistTaps="handled">
          {/* Prévia rápida */}
          <View style={s.livePreview}>
            <View style={s.livePreviewHead}>
              <Text style={s.previewLabel}>PRÉVIA AO VIVO</Text>
              <Pressable onPress={() => setTab('preview')} hitSlop={8}>
                <Text style={s.link}>Ver página completa</Text>
              </Pressable>
            </View>
            <View style={{marginHorizontal: -16, marginTop: -8, marginBottom: -4}}>
              <PartnerListCard partner={preview} disabled />
            </View>
          </View>

          {/* Logo */}
          <Section icon="image-outline" title="Logo" subtitle="Aparece na lista e no topo da página da empresa.">
            <View style={s.logoRow}>
              <View style={s.logoBox}>
                {partner?.logo ? (
                  <Image source={{uri: partner.logo}} style={s.logoImg} testID="logo-atual" />
                ) : (
                  <Text style={s.logoInitial}>{initial}</Text>
                )}
                {logoBusy ? (
                  <View style={s.logoBusy}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <View style={{flex: 1, gap: 8}}>
                <Button
                  title={partner?.logo ? 'Trocar foto' : 'Escolher foto'}
                  variant="secondary"
                  onPress={pickLogo}
                  disabled={logoBusy}
                  icon={<Icon name="camera-outline" size={18} color={COLORS.primary} />}
                  style={{minHeight: 44}}
                  testID="trocar-logo"
                />
                {partner?.logo ? (
                  <Button
                    title="Remover"
                    variant="ghost"
                    onPress={removeLogo}
                    disabled={logoBusy}
                    style={{minHeight: 36}}
                    testID="remover-logo"
                  />
                ) : null}
              </View>
            </View>
            <Text style={ui.hint}>Use uma imagem quadrada. A foto é salva na hora.</Text>
          </Section>

          {/* Sobre */}
          <Section icon="storefront-outline" title="Sobre a empresa">
            <Field
              label="Nome da empresa"
              value={form.name}
              onChangeText={v => set({name: v})}
              maxLength={120}
              error={errors.name}
              testID="campo-nome"
            />
            <Text style={ui.label}>Categoria</Text>
            <View style={s.chips}>
              {categories.map(c => (
                <Chip
                  key={c}
                  label={c}
                  active={form.category.toLowerCase() === c.toLowerCase()}
                  onPress={() => set({category: c})}
                  testID={`categoria-${c}`}
                />
              ))}
            </View>
            {errors.category ? <Text style={[ui.error, {marginTop: -4, marginBottom: 8}]}>{errors.category}</Text> : null}
            <Field
              label="Descrição e benefício"
              value={form.description}
              onChangeText={v => set({description: v})}
              multiline
              maxLength={DESCRIPTION_MAX}
              placeholder="O que a empresa oferece e qual o benefício para quem é membro da Liga."
              hint={`${form.description.length}/${DESCRIPTION_MAX} · aparece em "Benefício" na página da empresa`}
              style={{marginBottom: 0}}
            />
          </Section>

          {/* Contato */}
          <Section icon="call-outline" title="Contato" subtitle="O membro liga ou chama no WhatsApp com um toque.">
            <Field
              label="Telefone / WhatsApp"
              value={form.phone}
              onChangeText={v => set({phone: maskPhone(v)})}
              keyboardType="phone-pad"
              placeholder="(14) 99999-9999"
              maxLength={16}
            />
            <Field
              label="E-mail de contato"
              value={form.email}
              onChangeText={v => set({email: v})}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={160}
              error={errors.email}
            />
            <Field
              label="Site ou Instagram"
              value={form.website}
              onChangeText={v => set({website: v})}
              autoCapitalize="none"
              placeholder="instagram.com/suaempresa"
              maxLength={300}
              style={{marginBottom: 0}}
            />
          </Section>

          {/* Endereço */}
          <Section icon="location-outline" title="Endereço" subtitle="Usado no botão de rota e na distância até o membro.">
            <Field
              label="CEP"
              value={form.zipCode}
              onChangeText={onCep}
              keyboardType="number-pad"
              maxLength={9}
              placeholder="18600-000"
              error={errors.zipCode}
              hint={
                cepState === 'loading'
                  ? 'Buscando endereço…'
                  : cepState === 'ok'
                    ? 'Endereço preenchido. Confira o número.'
                    : cepState === 'notfound'
                      ? 'CEP não encontrado. Preencha à mão.'
                      : cepState === 'offline'
                        ? 'Sem conexão para buscar o CEP. Preencha à mão.'
                        : 'Digite o CEP para preencher a rua, o bairro e a cidade.'
              }
            />
            <Field
              label="Rua"
              value={form.street}
              onChangeText={v => set({street: v})}
              maxLength={200}
              error={errors.street}
            />
            <View style={s.row2}>
              <View style={{flex: 1}}>
                <Field
                  label="Número"
                  value={form.number}
                  onChangeText={v => set({number: v})}
                  maxLength={10}
                  testID="campo-numero"
                />
              </View>
              <View style={{flex: 2}}>
                <Field
                  label="Complemento"
                  value={form.complement}
                  onChangeText={v => set({complement: v})}
                  placeholder="Opcional"
                  maxLength={60}
                />
              </View>
            </View>
            <Field label="Bairro" value={form.district} onChangeText={v => set({district: v})} maxLength={80} />
            <View style={s.row2}>
              <View style={{flex: 3}}>
                <Field
                  label="Cidade"
                  value={form.city}
                  onChangeText={v => set({city: v})}
                  maxLength={100}
                  error={errors.city}
                  style={{marginBottom: 0}}
                />
              </View>
              <View style={{flex: 1}}>
                <Field
                  label="UF"
                  value={form.state}
                  onChangeText={v => set({state: v.replace(/[^A-Za-z]/g, '').toUpperCase()})}
                  maxLength={2}
                  autoCapitalize="characters"
                  error={errors.state}
                  style={{marginBottom: 0}}
                />
              </View>
            </View>
          </Section>

          {/* Horário */}
          <Section icon="time-outline" title="Horário de funcionamento" subtitle="O app mostra se está aberto agora.">
            {freeTextHours && !hoursTouched ? (
              <View style={s.notice}>
                <Text style={s.noticeText}>
                  Horário atual: “{partner.hours}”. Monte pela grade abaixo para o app mostrar o horário de cada dia.
                </Text>
              </View>
            ) : null}
            <Text style={[ui.label, {marginBottom: 8}]}>Atalhos</Text>
            <View style={s.chips}>
              {PRESETS.map(p => (
                <Chip key={p.id} label={p.label} onPress={() => applyPreset(p.id)} testID={`atalho-${p.id}`} />
              ))}
            </View>
            <View style={s.days}>
              {DAYS.map(d => (
                <DayRow
                  key={d.key}
                  day={d}
                  value={week[d.key]}
                  error={weekErrors[d.key]}
                  onChange={patch => setDay(d.key, patch)}
                />
              ))}
            </View>
            {week[1]?.open ? (
              <Pressable onPress={copyMonday} style={s.copyBtn} testID="copiar-segunda">
                <Icon name="copy-outline" size={16} color={COLORS.primary} />
                <Text style={s.link}>Repetir o horário de segunda de terça a sexta</Text>
              </Pressable>
            ) : null}
            {hoursTouched ? (
              <Text style={[ui.hint, {marginTop: 8}]} testID="horario-texto">
                Vai aparecer assim: {serializeWeek(week) || 'sem horário informado'}
              </Text>
            ) : null}
          </Section>
        </ScrollView>
      )}

      {/* Barra de salvar */}
      <View style={s.saveBar}>
        <View style={{flex: 1}}>
          {error ? (
            <Text style={[ui.error, {fontSize: 13, marginTop: 0}]} numberOfLines={2}>
              {error}
            </Text>
          ) : (
            <Text style={[ui.muted, {fontSize: 13}]}>
              {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
            </Text>
          )}
        </View>
        <Button
          title="Salvar alterações"
          onPress={save}
          loading={saving}
          disabled={!dirty}
          style={{minHeight: 46}}
          testID="salvar-empresa"
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: {borderBottomColor: COLORS.primary},
  tabText: {fontSize: 14, fontWeight: '600', color: COLORS.muted},
  tabTextActive: {color: COLORS.primary},
  livePreview: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 16,
    paddingBottom: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  livePreviewHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  previewHead: {paddingHorizontal: 16, paddingTop: 14, backgroundColor: '#F1F5F9'},
  previewLabel: {fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: COLORS.muted, marginBottom: 8},
  phoneFrame: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 76,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  link: {color: COLORS.primary, fontWeight: '700', fontSize: 13},
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  sectionHead: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14},
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {fontSize: 16, fontWeight: '800', color: COLORS.text},
  sectionSub: {fontSize: 12, color: COLORS.muted, marginTop: 1},
  logoRow: {flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8},
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoImg: {width: '100%', height: '100%'},
  logoInitial: {fontSize: 36, fontWeight: '900', color: '#7C3AED'},
  logoBusy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  chipText: {fontSize: 13, fontWeight: '600', color: '#334155'},
  chipTextActive: {color: '#FFFFFF'},
  row2: {flexDirection: 'row', gap: 10},
  days: {borderTopWidth: 1, borderTopColor: COLORS.border},
  dayRow: {paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9'},
  dayHead: {flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44},
  dayLabel: {width: 72, fontSize: 14, fontWeight: '700', color: COLORS.text},
  timeWrap: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6},
  timeInput: {
    width: 64,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
  },
  inputError: {borderColor: COLORS.bad},
  timeSep: {color: COLORS.muted, fontSize: 13},
  closed: {flex: 1, color: COLORS.muted, fontSize: 14},
  copyBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12},
  notice: {
    backgroundColor: COLORS.warnSoft,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noticeText: {color: COLORS.warn, fontSize: 13},
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: -2},
  },
});
