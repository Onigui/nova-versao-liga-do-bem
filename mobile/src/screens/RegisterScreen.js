/**
 * Criar conta: CPF obrigatório e conferido (dígitos verificadores) — uma conta por pessoa.
 */
import React, {useState} from 'react';
import {Alert, Pressable, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import {F} from '../theme/home';
import {cpfHint, formatCpf, formatPhoneBR, isValidCpf, onlyDigits} from '../utils/cpf';
import {A, AuthLayout, Field, LinkText, Note, PrimaryButton} from '../components/auth/AuthUI';

export function validateRegister(f) {
  const e = {};
  if (String(f.name || '').trim().split(/\s+/).filter(Boolean).length < 2) e.name = 'Digite nome e sobrenome';
  const cpf = onlyDigits(f.cpf);
  if (!cpf) e.cpf = 'O CPF é obrigatório';
  else if (!isValidCpf(cpf)) e.cpf = 'CPF inválido. Confira os números.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.email || '').trim())) e.email = 'Digite um e-mail válido';
  const phone = onlyDigits(f.phone);
  if (phone.length < 10 || phone.length > 11) e.phone = 'Celular com DDD';
  if (String(f.password || '').length < 6) e.password = 'Mínimo de 6 caracteres';
  if (f.confirm !== f.password) e.confirm = 'As senhas não são iguais';
  if (!f.terms) e.terms = 'Aceite os termos para continuar';
  return e;
}

export default function RegisterScreen({navigation}) {
  const {register} = useAuth();
  const [f, setF] = useState({name: '', cpf: '', email: '', phone: '', password: '', confirm: '', terms: false});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const set = (k, v) => {
    setF(x => ({...x, [k]: v}));
    if (errors[k]) setErrors(x => ({...x, [k]: null}));
  };
  const hint = cpfHint(f.cpf);

  const submit = async () => {
    const e = validateRegister(f);
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const r = await register({
        name: f.name.trim().replace(/\s+/g, ' '),
        email: f.email.trim().toLowerCase(),
        phone: onlyDigits(f.phone),
        cpf: onlyDigits(f.cpf),
        password: f.password,
      });
      if (r?.success) {
        Alert.alert('Conta criada!', 'Agora é só entrar com o seu e-mail e senha.', [{text: 'Entrar', onPress: () => navigation.navigate('Login')}]);
      } else {
        const msg = r?.error || 'Não foi possível criar a conta. Tente de novo.';
        // Erro do servidor no campo certo (CPF já cadastrado, e-mail em uso…)
        if (/cpf/i.test(msg)) setErrors({cpf: msg});
        else if (/e-?mail/i.test(msg)) setErrors({email: msg});
        else Alert.alert('Não foi possível criar a conta', msg);
      }
    } catch (err) {
      Alert.alert('Sem conexão', err?.message || 'Verifique a internet e tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Leva 1 minuto. Com a conta você tem a carteira de vacinação dos pets, achados e perdidos e muito mais."
      onBack={() => navigation.goBack()}
      compactHero
      footer={
        <View style={{flexDirection: 'row', justifyContent: 'center', gap: 6}}>
          <Text style={[{color: '#6B6880', fontSize: 14}, F.regular]}>Já tem conta?</Text>
          <LinkText onPress={() => navigation.navigate('Login')} testID="ja-tenho-conta">
            Entrar
          </LinkText>
        </View>
      }>
      <Field label="Nome completo" icon="person-outline" value={f.name} onChangeText={v => set('name', v)} placeholder="Como está no documento" autoCapitalize="words" error={errors.name} testID="nome" />
      <Field
        label="CPF"
        icon="card-outline"
        value={f.cpf}
        onChangeText={v => set('cpf', formatCpf(v))}
        placeholder="000.000.000-00"
        keyboardType="number-pad"
        maxLength={14}
        ok={hint === 'ok'}
        error={errors.cpf || (hint && hint !== 'ok' ? hint : null)}
        hint="Usado para garantir uma conta por pessoa e na sua carteirinha."
        testID="cpf"
      />
      <Field label="E-mail" icon="mail-outline" value={f.email} onChangeText={v => set('email', v)} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} testID="email" />
      <Field label="Celular (WhatsApp)" icon="call-outline" value={f.phone} onChangeText={v => set('phone', formatPhoneBR(v))} placeholder="(14) 99999-9999" keyboardType="phone-pad" error={errors.phone} testID="celular" />
      <Field label="Senha" icon="lock-closed-outline" value={f.password} onChangeText={v => set('password', v)} placeholder="Mínimo de 6 caracteres" secure autoCapitalize="none" error={errors.password} testID="senha" />
      <Field label="Confirme a senha" icon="lock-closed-outline" value={f.confirm} onChangeText={v => set('confirm', v)} placeholder="Repita a senha" secure autoCapitalize="none" error={errors.confirm} testID="confirmar-senha" />

      <Pressable style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6}} onPress={() => set('terms', !f.terms)} accessibilityRole="checkbox" accessibilityState={{checked: f.terms}} testID="aceito-termos">
        <Ionicons name={f.terms ? 'checkbox' : 'square-outline'} size={24} color={f.terms ? A.primary : '#9CA3AF'} />
        <Text style={[{flex: 1, color: '#1E1B2E', fontSize: 14}, F.regular]}>
          Li e aceito os{' '}
          <Text style={[{color: A.primary}, F.bold]} onPress={() => navigation.navigate('Legal', {section: 'terms'})}>
            termos de uso e a política de privacidade
          </Text>
        </Text>
      </Pressable>
      {errors.terms ? <Text style={[{color: '#B91C1C', fontSize: 12, marginBottom: 6}, F.semibold]}>{errors.terms}</Text> : null}

      <Note>Seus dados ficam protegidos. O CPF não aparece para parceiros nem para outros membros.</Note>
      <PrimaryButton title="Criar minha conta" onPress={submit} loading={loading} testID="criar" />
    </AuthLayout>
  );
}
