/**
 * "Quero ser parceiro": a empresa escolhe a ONG e manda os dados. O pedido vai para a equipe do
 * SóciONG, que entra em contato e libera o acesso. A empresa fica parceira só daquela ONG.
 */
import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../../config/apiConfig';
import {COLORS} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';

const EMPTY = {company: '', cnpj: '', contactName: '', email: '', phone: '', city: '', state: '', category: '', message: ''};

export default function PartnerSignupScreen({navigation, fetchImpl = fetch}) {
  const [orgs, setOrgs] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [orgId, setOrgId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchImpl(`${API_BASE_PATH}/orgs`);
        const d = await r.json();
        if (!alive) return;
        const list = d.orgs || [];
        setOrgs(list);
        if (list.length === 1) setOrgId(list[0].id);
      } catch {
        if (alive) setLoadError('Sem conexão. Tente de novo.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchImpl]);

  const set = key => value => {
    setForm(f => ({...f, [key]: value}));
    setErrors(e => ({...e, [key]: undefined}));
  };

  const submit = async () => {
    const e = {};
    if (!orgId) e.orgId = 'Escolha a ONG.';
    if (form.company.trim().length < 2) e.company = 'Informe o nome da empresa.';
    if (form.contactName.trim().length < 2) e.contactName = 'Informe o seu nome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'E-mail inválido.';
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Telefone com DDD.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSending(true);
    try {
      const r = await fetchImpl(`${API_BASE_PATH}/public/partner-requests`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...form, email: form.email.trim().toLowerCase(), orgId}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrors(d.field ? {[d.field]: d.error} : {form: d.error || 'Não foi possível enviar.'});
      } else {
        setDone(d.message || 'Pedido enviado!');
      }
    } catch {
      setErrors({form: 'Sem conexão. Tente de novo.'});
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <View style={[ui.screen, {justifyContent: 'center', padding: 20}]}>
        <Card style={{alignItems: 'center'}}>
          <Icon name="checkmark-circle" size={56} color={COLORS.ok} />
          <Text style={[ui.title, {textAlign: 'center', marginTop: 8}]} testID="signup-done">
            {done}
          </Text>
          <Text style={[ui.muted, {textAlign: 'center', marginTop: 6}]}>
            Quando o acesso for liberado, você entra com o e-mail informado em "Primeiro acesso".
          </Text>
          <Button title="Voltar para o login" style={{marginTop: 16, alignSelf: 'stretch'}} onPress={() => navigation.goBack()} />
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Text style={ui.title}>Quero ser parceiro</Text>
        <Text style={[ui.muted, {marginBottom: 12}]}>
          Sua empresa dá desconto aos sócios de uma ONG e aparece no app para eles. Escolha a ONG e mande seus dados: nossa equipe entra em contato.
        </Text>

        <Card>
          <Text style={ui.label}>De qual ONG você quer ser parceiro?</Text>
          {orgs === null && !loadError ? <ActivityIndicator color={COLORS.primary} style={{marginVertical: 12}} /> : null}
          {loadError ? <Text style={{color: COLORS.bad}}>{loadError}</Text> : null}
          {(orgs || []).map(o => {
            const selected = o.id === orgId;
            return (
              <Pressable
                key={o.id}
                testID={`org-${o.slug || o.id}`}
                accessibilityRole="radio"
                accessibilityState={{selected}}
                onPress={() => {
                  setOrgId(o.id);
                  setErrors(e => ({...e, orgId: undefined}));
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  marginTop: 8,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: selected ? COLORS.primary : COLORS.border,
                  backgroundColor: selected ? COLORS.primarySoft : '#FFFFFF',
                  minHeight: 56,
                }}>
                <View style={{width: 14, height: 14, borderRadius: 7, backgroundColor: o.branding?.primary || COLORS.primary}} />
                <View style={{flex: 1}}>
                  <Text style={{fontWeight: '800', color: COLORS.text}}>{o.name}</Text>
                  {o.city ? <Text style={ui.muted}>{o.city}{o.state ? `/${o.state}` : ''}</Text> : null}
                </View>
                <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? COLORS.primary : COLORS.muted} />
              </Pressable>
            );
          })}
          {errors.orgId ? <Text style={{color: COLORS.bad, marginTop: 6}}>{errors.orgId}</Text> : null}
        </Card>

        <Card>
          <Field label="Nome da empresa" value={form.company} onChangeText={set('company')} error={errors.company} testID="f-company" />
          <Field label="CNPJ (opcional)" value={form.cnpj} onChangeText={set('cnpj')} keyboardType="number-pad" error={errors.cnpj} />
          <Field label="Seu nome" value={form.contactName} onChangeText={set('contactName')} error={errors.contactName} testID="f-contact" />
          <Field label="E-mail" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" error={errors.email} testID="f-email" />
          <Field label="Telefone / WhatsApp" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} testID="f-phone" />
          <View style={{flexDirection: 'row', gap: 10}}>
            <Field label="Cidade" value={form.city} onChangeText={set('city')} style={{flex: 1}} />
            <Field label="UF" value={form.state} onChangeText={v => set('state')(v.toUpperCase().slice(0, 2))} style={{width: 72}} autoCapitalize="characters" />
          </View>
          <Field label="Ramo (pet shop, clínica, banho e tosa…)" value={form.category} onChangeText={set('category')} />
          <Field label="Mensagem (opcional)" value={form.message} onChangeText={set('message')} multiline />
          {errors.form ? <Text style={{color: COLORS.bad, marginBottom: 8}}>{errors.form}</Text> : null}
          <Button title="Enviar pedido" onPress={submit} loading={sending} testID="signup-submit" />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
