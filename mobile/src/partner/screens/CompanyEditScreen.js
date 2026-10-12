import React, {useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {COLORS, usePartner} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';

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

/** Só envia o que mudou; valida o básico antes de chamar a API. */
export function buildCompanyPatch(original, form) {
  const patch = {};
  for (const k of FIELDS) {
    const v = String(form[k] ?? '').trim();
    if (v !== String(original?.[k] ?? '').trim()) patch[k] = v || null;
  }
  for (const req of [
    'name',
    'category',
    'address',
    'city',
    'state',
    'zipCode',
  ]) {
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

export default function CompanyEditScreen({navigation}) {
  const {api, partner, setPartner} = usePartner();
  const [form, setForm] = useState(() =>
    Object.fromEntries(FIELDS.map(k => [k, partner?.[k] ?? ''])),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const set = patch => setForm(f => ({...f, ...patch}));

  const onCep = async text => {
    const d = text.replace(/\D/g, '').slice(0, 8);
    set({zipCode: d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d});
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro) {
        setForm(f => ({
          ...f,
          address: j.logradouro
            ? `${j.logradouro}, ${j.bairro || ''}`.replace(/, $/, '')
            : f.address,
          city: j.localidade || f.city,
          state: (j.uf || f.state || '').toUpperCase(),
        }));
      }
    } catch {
      /* preenche à mão */
    } finally {
      setCepLoading(false);
    }
  };

  const save = async () => {
    const {error: err, patch} = buildCompanyPatch(partner, form);
    if (err) {
      setError(err);
      return;
    }
    if (!Object.keys(patch).length) {
      navigation.goBack();
      return;
    }
    setError('');
    setSaving(true);
    try {
      const r = await api('PUT', '/partner/me', patch);
      setPartner(r.partner);
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const f = (key, label, props = {}) => (
    <Field
      label={label}
      value={form[key] ?? ''}
      onChangeText={v => set({[key]: v})}
      {...props}
    />
  );

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled">
      <Text style={[ui.muted, {marginBottom: 12}]}>
        Estes dados aparecem para os membros no app Liga do Bem. As alterações
        entram no ar na hora.
      </Text>
      <Card>
        {f('name', 'Nome da empresa', {maxLength: 120})}
        {f('category', 'Categoria', {
          placeholder: 'Pet shop, Veterinário, Farmácia…',
          maxLength: 60,
        })}
        {f('description', 'Sobre a empresa', {
          multiline: true,
          maxLength: 2000,
        })}
        {f('hours', 'Horário de funcionamento', {
          placeholder: 'Seg-Sex 8h-18h · Sáb 8h-12h',
          maxLength: 300,
        })}
      </Card>
      <Card>
        {f('phone', 'Telefone / WhatsApp', {
          keyboardType: 'phone-pad',
          maxLength: 40,
        })}
        {f('email', 'E-mail de contato', {
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          maxLength: 160,
        })}
        {f('website', 'Site ou Instagram', {
          autoCapitalize: 'none',
          placeholder: 'https://…',
          maxLength: 300,
        })}
      </Card>
      <Card>
        <Field
          label="CEP"
          value={form.zipCode ?? ''}
          onChangeText={onCep}
          keyboardType="number-pad"
          maxLength={9}
          hint={
            cepLoading
              ? 'Buscando endereço…'
              : 'Preenche rua, cidade e UF automaticamente.'
          }
        />
        {f('address', 'Endereço (rua, número, bairro)', {maxLength: 300})}
        <View style={{flexDirection: 'row', gap: 10}}>
          <View style={{flex: 3}}>{f('city', 'Cidade', {maxLength: 100})}</View>
          <View style={{flex: 1}}>
            {f('state', 'UF', {maxLength: 2, autoCapitalize: 'characters'})}
          </View>
        </View>
      </Card>
      {error ? (
        <Text
          style={[
            ui.error,
            {marginBottom: 10, fontSize: 14, color: COLORS.bad},
          ]}>
          {error}
        </Text>
      ) : null}
      <Button
        title="Salvar"
        onPress={save}
        loading={saving}
        testID="salvar-empresa"
      />
    </ScrollView>
  );
}
