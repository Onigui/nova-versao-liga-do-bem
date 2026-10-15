/**
 * Recuperar senha / primeiro acesso (app dos membros e App Parceiros).
 * Código de 6 dígitos por e-mail, ou um código recebido da Liga (ou do responsável da empresa).
 */
import React, {useState} from 'react';
import {Alert, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../config/apiConfig';
import {F} from '../theme/home';
import {A, AuthLayout, Field, LinkText, Note, PrimaryButton, SecondaryButton} from '../components/auth/AuthUI';

export default function ForgotPasswordScreen({navigation, route, fetchImpl = fetch}) {
  const firstAccess = !!route?.params?.firstAccess;
  const [step, setStep] = useState('email'); // email | code | success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSource, setCodeSource] = useState('email'); // email | manual
  const [errors, setErrors] = useState({});

  const cleanEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

  const goToManualCode = () => {
    if (!validEmail) {
      setErrors({email: 'Digite primeiro o seu e-mail'});
      return;
    }
    setCode('');
    setCodeSource('manual');
    setStep('code');
  };

  const requestCode = async () => {
    if (!validEmail) {
      setErrors({email: 'Digite um e-mail válido'});
      return;
    }
    setLoading(true);
    try {
      const r = await fetchImpl(`${API_BASE_PATH}/auth/forgot-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: cleanEmail}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        Alert.alert('Não foi possível enviar o e-mail', data.error || 'Peça um código de acesso à Liga do Bem (ou ao responsável da sua empresa).', [
          {text: 'Fechar', style: 'cancel'},
          {text: 'Já tenho um código', onPress: goToManualCode},
        ]);
        return;
      }
      setCode('');
      setCodeSource('email');
      setStep('code');
    } catch {
      Alert.alert('Sem conexão', 'Não foi possível conectar. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    const e = {};
    if (!/^\d{6}$/.test(code.trim())) e.code = 'Digite o código de 6 dígitos';
    if (newPassword.length < 6) e.password = 'Mínimo de 6 caracteres';
    if (newPassword !== confirmPassword) e.confirm = 'As senhas não são iguais';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const r = await fetchImpl(`${API_BASE_PATH}/auth/reset-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: cleanEmail, code: code.trim(), newPassword}),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrors({code: data.error || 'Não foi possível redefinir a senha'});
        return;
      }
      setStep('success');
    } catch {
      Alert.alert('Sem conexão', 'Não foi possível conectar. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <AuthLayout title={firstAccess ? 'Senha criada!' : 'Senha atualizada!'} subtitle="Agora é só entrar com o seu e-mail e a senha nova.">
        <View style={{alignItems: 'center', paddingVertical: 24}}>
          <Ionicons name="checkmark-circle" size={84} color="#16A34A" />
        </View>
        <PrimaryButton title="Ir para o login" onPress={() => navigation.navigate('Login')} testID="ir-login" />
      </AuthLayout>
    );
  }

  if (step === 'code') {
    return (
      <AuthLayout
        title={firstAccess ? 'Crie sua senha' : 'Nova senha'}
        subtitle={codeSource === 'manual' ? 'Digite o código que você recebeu da Liga do Bem.' : `Enviamos um código de 6 dígitos para ${cleanEmail}.`}
        onBack={() => setStep('email')}
        compactHero>
        <Note icon={codeSource === 'manual' ? 'time-outline' : 'mail-unread-outline'}>
          {codeSource === 'manual'
            ? 'O código vale por 72 horas e só pode ser usado uma vez.'
            : 'O código vale por 15 minutos. Não chegou? Confira a pasta de spam.'}
        </Note>
        <Field
          label="Código"
          icon="keypad-outline"
          value={code}
          onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="one-time-code"
          error={errors.code}
          testID="codigo"
        />
        <Field label={firstAccess ? 'Senha' : 'Nova senha'} icon="lock-closed-outline" value={newPassword} onChangeText={setNewPassword} placeholder="Mínimo de 6 caracteres" secure autoCapitalize="none" error={errors.password} testID="nova-senha" />
        <Field label="Confirme a senha" icon="lock-closed-outline" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repita a senha" secure autoCapitalize="none" error={errors.confirm} testID="confirmar-senha" />
        <PrimaryButton title={firstAccess ? 'Criar senha' : 'Salvar nova senha'} onPress={reset} loading={loading} testID="salvar-senha" />
        {codeSource === 'email' ? (
          <View style={{alignItems: 'center', marginTop: 16}}>
            <LinkText onPress={requestCode} testID="reenviar">
              Enviar o código de novo
            </LinkText>
          </View>
        ) : null}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={firstAccess ? 'Primeiro acesso' : 'Esqueceu a senha?'}
      subtitle={`Digite o e-mail da sua conta. Enviamos um código para você ${firstAccess ? 'criar' : 'redefinir'} a senha.`}
      onBack={() => navigation.goBack()}
      compactHero>
      <Field
        label="E-mail"
        icon="mail-outline"
        value={email}
        onChangeText={t => {
          setEmail(t);
          if (errors.email) setErrors({});
        }}
        placeholder="voce@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={errors.email}
        testID="email"
      />
      <PrimaryButton title="Enviar código por e-mail" icon="mail-outline" onPress={requestCode} loading={loading} testID="enviar-codigo" />
      <SecondaryButton title="Já tenho um código" icon="keypad-outline" onPress={goToManualCode} testID="ja-tenho-codigo" />
      <Text style={[{color: '#6B6880', fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17}, F.regular]}>
        Recebeu um código da Liga do Bem{firstAccess ? ' ou do responsável da empresa' : ''}? Digite o e-mail acima e toque em{' '}
        <Text style={[{color: A.primary}, F.bold]}>Já tenho um código</Text>.
      </Text>
    </AuthLayout>
  );
}
