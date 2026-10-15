/**
 * Contas antigas sem CPF (ou com CPF inválido): pede o CPF antes de entrar no app.
 * Uma conta por pessoa — o mesmo CPF não pode estar em duas contas.
 */
import React, {useState} from 'react';
import {Alert} from 'react-native';
import {useAuth} from '../services/AuthService';
import {cpfHint, formatCpf, isValidCpf, onlyDigits} from '../utils/cpf';
import {memberApi} from '../utils/quotes';
import {AuthLayout, Field, LinkText, Note, PrimaryButton} from '../components/auth/AuthUI';

export default function CompleteCpfScreen({fetchImpl = fetch}) {
  const {user, updateUser, logout} = useAuth();
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hint = cpfHint(cpf);

  const save = async () => {
    if (!isValidCpf(cpf)) {
      setError('CPF inválido. Confira os números.');
      return;
    }
    setLoading(true);
    try {
      await memberApi(fetchImpl)('PUT', '/user/profile', {cpf: onlyDigits(cpf)});
      updateUser({...user, cpf: onlyDigits(cpf)});
    } catch (e) {
      if (e.status === 0) Alert.alert('Sem conexão', 'Verifique a internet e tente de novo.');
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Falta só o seu CPF"
      subtitle={`${String(user?.name || '').split(' ')[0] || 'Olá'}, agora o CPF é obrigatório para todas as contas. É rapidinho.`}
      footer={
        <LinkText onPress={logout} testID="sair" style={{textAlign: 'center'}}>
          Sair desta conta
        </LinkText>
      }>
      <Note>O CPF garante uma conta por pessoa e aparece só na sua carteirinha. Ele não pode ser trocado depois.</Note>
      <Field
        label="CPF"
        icon="card-outline"
        value={cpf}
        onChangeText={t => {
          setCpf(formatCpf(t));
          setError('');
        }}
        placeholder="000.000.000-00"
        keyboardType="number-pad"
        maxLength={14}
        ok={hint === 'ok'}
        error={error || (hint && hint !== 'ok' ? hint : null)}
        testID="cpf"
      />
      <PrimaryButton title="Continuar" onPress={save} loading={loading} disabled={!isValidCpf(cpf)} testID="salvar-cpf" />
    </AuthLayout>
  );
}
