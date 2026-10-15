/**
 * Entrar (app dos membros): e-mail e senha, ou digital/Face ID quando habilitado.
 * Mesmo visual do novo Início.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Platform, Text, View} from 'react-native';
import {useAuth} from '../services/AuthService';
import BiometricService from '../services/BiometricService';
import {F} from '../theme/home';
import {A, AuthLayout, Divider, Field, LinkText, PrimaryButton, SecondaryButton} from '../components/auth/AuthUI';

export default function LoginScreen({navigation}) {
  const {login, isAuthenticated} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometryType, setBiometryType] = useState('digital');

  const checkBiometric = useCallback(async () => {
    try {
      const {available, biometryType: type} = await BiometricService.isAvailable();
      setBiometricAvailable(!!available);
      if (type === 'FaceID') setBiometryType('Face ID');
      else if (type === 'TouchID') setBiometryType('Touch ID');
      else setBiometryType(Platform.OS === 'ios' ? 'Face ID' : 'digital');
      setBiometricEnabled(!!(await BiometricService.isEnabled()));
    } catch {
      setBiometricAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkBiometric();
    const unsub = navigation.addListener?.('focus', checkBiometric);
    return unsub;
  }, [navigation, checkBiometric]);

  const handleBiometricLogin = useCallback(async () => {
    setLoading(true);
    try {
      const result = await BiometricService.authenticate();
      if (result.success) {
        const r = await login(result.email, result.password);
        if (!r.success) Alert.alert('Não foi possível entrar', r.error || 'Entre com e-mail e senha.');
      } else if (result.invalidated) {
        setBiometricEnabled(false);
        Alert.alert('Login por digital desativado', 'A biometria deste aparelho mudou. Entre com e-mail e senha e ative de novo, se quiser.');
      } else if (result.error && !String(result.error).includes('cancel')) {
        Alert.alert('Não foi possível', result.error);
      }
    } catch (e) {
      if (e?.message && !e.message.includes('cancel')) Alert.alert('Não foi possível', 'Tente com e-mail e senha.');
    } finally {
      setLoading(false);
    }
  }, [login]);

  // Pede a digital sozinho UMA vez ao abrir a tela
  const autoTried = useRef(false);
  useEffect(() => {
    if (biometricAvailable && biometricEnabled && !isAuthenticated && !autoTried.current) {
      autoTried.current = true;
      const t = setTimeout(handleBiometricLogin, 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [biometricAvailable, biometricEnabled, isAuthenticated, handleBiometricLogin]);

  const offerBiometric = () => {
    if (!biometricAvailable || biometricEnabled) return;
    setTimeout(() => {
      Alert.alert('Entrar mais rápido', `Quer usar a ${biometryType} para entrar da próxima vez?`, [
        {text: 'Agora não', style: 'cancel'},
        {
          text: 'Usar',
          onPress: async () => {
            const r = await BiometricService.enableBiometric(email.trim(), password);
            if (r.success) setBiometricEnabled(true);
            else Alert.alert('Não foi possível', r.error || 'Tente de novo no perfil.');
          },
        },
      ]);
    }, 500);
  };

  const handleLogin = async () => {
    const e = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Digite um e-mail válido';
    if (!password) e.password = 'Digite a sua senha';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const r = await login(email.trim(), password);
      if (!r.success) setErrors({password: r.error || 'E-mail ou senha incorretos'});
      else offerBiometric();
    } catch {
      Alert.alert('Sem conexão', 'Não foi possível entrar. Verifique a internet e tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Que bom ver você!"
      subtitle="Entre para ver sua carteirinha, seus pets e os descontos perto de você."
      footer={
        <View style={{alignItems: 'center', gap: 6}}>
          <Text style={[{color: '#6B6880', fontSize: 14}, F.regular]}>Ainda não tem conta?</Text>
          <SecondaryButton title="Criar minha conta" icon="person-add-outline" onPress={() => navigation.navigate('Register')} testID="criar-conta" style={{alignSelf: 'stretch'}} />
        </View>
      }>
      {biometricAvailable && biometricEnabled ? (
        <>
          <PrimaryButton title={`Entrar com ${biometryType}`} icon="finger-print" onPress={handleBiometricLogin} loading={loading} testID="entrar-biometria" />
          <Divider text="ou use e-mail e senha" />
        </>
      ) : null}
      <Field
        label="E-mail"
        icon="mail-outline"
        value={email}
        onChangeText={t => {
          setEmail(t);
          if (errors.email) setErrors(x => ({...x, email: null}));
        }}
        placeholder="voce@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={errors.email}
        testID="email"
      />
      <Field
        label="Senha"
        icon="lock-closed-outline"
        value={password}
        onChangeText={t => {
          setPassword(t);
          if (errors.password) setErrors(x => ({...x, password: null}));
        }}
        placeholder="Sua senha"
        secure
        autoCapitalize="none"
        error={errors.password}
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        testID="senha"
      />
      <View style={{alignItems: 'flex-end', marginTop: -4, marginBottom: 16}}>
        <LinkText onPress={() => navigation.navigate('ForgotPassword')} testID="esqueci">
          Esqueci minha senha
        </LinkText>
      </View>
      <PrimaryButton title="Entrar" onPress={handleLogin} loading={loading && !(biometricAvailable && biometricEnabled)} testID="entrar" />
      <Text style={[{color: '#6B6880', fontSize: 12, textAlign: 'center', marginTop: 14}, F.regular]}>
        Primeira vez aqui com um cadastro feito pela Liga?{' '}
        <Text style={[{color: A.primary}, F.bold]} onPress={() => navigation.navigate('ForgotPassword', {firstAccess: true})}>
          Criar minha senha
        </Text>
      </Text>
    </AuthLayout>
  );
}
