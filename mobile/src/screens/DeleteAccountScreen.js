/**
 * Excluir minha conta (exigência da Play Store e direito na LGPD).
 * Explica o que é apagado e o que fica guardado sem identificação, pede a senha
 * e uma confirmação final. Depois de excluir, sai da conta.
 */
import React, {useMemo, useState} from 'react';
import {Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import {memberApi} from '../utils/quotes';
import {F} from '../theme/home';

const GONE = [
  'Nome, e-mail, telefone, CPF e foto',
  'Seus pets, vacinas e histórico de saúde',
  'Avisos de achados e perdidos, avistamentos e comentários',
  'Notificações e preferências',
  'A carteirinha de membro (os descontos deixam de valer)',
];
const KEPT = ['Registros de pagamentos e doações, sem identificar você (prestação de contas da Liga)', 'As estrelas das avaliações de parceiros, sem texto e sem seu nome'];

export default function DeleteAccountScreen({navigation, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const {logout} = useAuth();
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);

  const doDelete = async () => {
    setSending(true);
    try {
      await api('POST', '/user/account/delete', {password});
      Alert.alert('Conta excluída', 'Seus dados foram apagados. Obrigado por ter feito parte da Liga do Bem. 💜');
      logout?.();
    } catch (e) {
      Alert.alert('Não foi possível excluir', e.message);
    } finally {
      setSending(false);
    }
  };

  const confirm = () => {
    if (!password) {
      Alert.alert('Falta a senha', 'Digite a sua senha para confirmar que é você.');
      return;
    }
    Alert.alert('Excluir de vez?', 'Essa ação não pode ser desfeita.', [
      {text: 'Cancelar', style: 'cancel'},
      {text: 'Excluir', style: 'destructive', onPress: doDelete},
    ]);
  };

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#F6F5FB'}} contentContainerStyle={{padding: 16, paddingBottom: 40}} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>O que é apagado</Text>
        {GONE.map(t => (
          <View key={t} style={styles.item}>
            <Ionicons name="trash-outline" size={18} color="#B91C1C" />
            <Text style={styles.itemText}>{t}</Text>
          </View>
        ))}
        <Text style={[styles.title, {marginTop: 14}]}>O que fica guardado</Text>
        {KEPT.map(t => (
          <View key={t} style={styles.item}>
            <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
            <Text style={styles.itemText}>{t}</Text>
          </View>
        ))}
        <Text style={styles.note}>A exclusão é imediata e definitiva. Mensalidades já pagas não são reembolsadas automaticamente. Se quiser voltar depois, é só criar uma conta nova.</Text>
      </View>

      <Text style={styles.label}>Sua senha</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Para confirmar que é você"
        placeholderTextColor="#9CA3AF"
        testID="senha-excluir"
      />

      <TouchableOpacity style={[styles.danger, sending && {opacity: 0.6}]} onPress={confirm} disabled={sending} testID="confirmar-excluir">
        <Text style={styles.dangerText}>{sending ? 'Excluindo…' : 'Excluir minha conta'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancel} onPress={() => navigation?.goBack?.()} testID="cancelar-excluir">
        <Text style={styles.cancelText}>Voltar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16},
  title: {fontSize: 16, ...F.heavy, color: '#1F2937', marginBottom: 8},
  item: {flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8},
  itemText: {flex: 1, fontSize: 14, ...F.regular, color: '#4B5563', lineHeight: 20},
  note: {fontSize: 13, ...F.regular, color: '#6B7280', marginTop: 10, lineHeight: 19},
  label: {fontSize: 13, ...F.bold, color: '#374151', marginTop: 20, marginBottom: 6},
  input: {...F.regular, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#1F2937'},
  danger: {height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, backgroundColor: '#B91C1C'},
  dangerText: {color: '#FFFFFF', ...F.heavy, fontSize: 16},
  cancel: {height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8},
  cancelText: {color: '#5B21B6', ...F.bold, fontSize: 15},
});
