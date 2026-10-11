import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../../services/AuthService';
import {COLORS} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';

export default function PartnerLoginScreen({navigation}) {
  const {login} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }
    setLoading(true);
    const r = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!r?.success) setError(r?.error || 'Não foi possível entrar.');
  };

  return (
    <KeyboardAvoidingView
      style={{flex: 1, backgroundColor: COLORS.primary}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 20,
        }}
        keyboardShouldPersistTaps="handled">
        <View style={{alignItems: 'center', marginBottom: 24}}>
          <View
            style={{
              backgroundColor: '#FFFFFF22',
              borderRadius: 999,
              padding: 18,
              marginBottom: 12,
            }}>
            <Icon name="storefront" size={44} color="#FFFFFF" />
          </View>
          <Text style={{color: '#FFFFFF', fontSize: 26, fontWeight: '800'}}>
            Liga do Bem Parceiros
          </Text>
          <Text
            style={{
              color: '#CCFBF1',
              fontSize: 15,
              marginTop: 4,
              textAlign: 'center',
            }}>
            Valide carteirinhas e gerencie as promoções da sua empresa
          </Text>
        </View>
        <Card>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="voce@empresa.com"
            testID="email"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Sua senha"
            onSubmitEditing={submit}
            testID="password"
          />
          {error ? (
            <Text style={[ui.error, {marginBottom: 10, fontSize: 14}]}>
              {error}
            </Text>
          ) : null}
          <Button
            title="Entrar"
            onPress={submit}
            loading={loading}
            testID="entrar"
          />
          <Button
            title="Primeiro acesso / Esqueci a senha"
            variant="ghost"
            style={{marginTop: 8}}
            onPress={() =>
              navigation.navigate('ForgotPassword', {firstAccess: true})
            }
          />
        </Card>
        <Text
          style={{
            color: '#CCFBF1',
            textAlign: 'center',
            fontSize: 13,
            marginTop: 8,
          }}>
          O acesso é criado pela Liga do Bem. Ainda não tem? Fale com a
          administração.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
