/**
 * Nota Fiscal Paulista → Liga do Bem: passo a passo da doação automática, "já fiz" e situação
 * (aguardando conferência, confirmado pela lista de doadores da Liga ou não encontrado).
 * O app nunca pede a senha da Nota Fiscal Paulista: o vínculo é feito no site da Sefaz-SP.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Clipboard, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../config/apiConfig';
import {memberApi} from '../utils/quotes';
import {F} from '../theme/home';

const GREEN = '#059669';

export function formatCpfInput(text) {
  const d = String(text || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

function dateBR(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
}

export default function NotaFiscalScreen({navigation, fetchImpl = fetch, clipboard = Clipboard, openUrl = url => Linking.openURL(url)}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const [info, setInfo] = useState(null);
  const [me, setMe] = useState(null);
  const [cpf, setCpf] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const r = await fetchImpl(`${API_BASE_PATH}/nfp`);
          const d = await r.json();
          if (alive) setInfo(d);
        } catch {
          if (alive) setError('Sem conexão. Tente de novo.');
        }
        try {
          const m = await api('GET', '/nfp/me');
          if (alive) setMe(m);
        } catch {
          if (alive) setMe({status: 'NONE', hasCpf: false, guest: true});
        }
      })();
      return () => {
        alive = false;
      };
    }, [api, fetchImpl]),
  );

  const copy = () => {
    clipboard.setString(String(info.cnpj).replace(/\D/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const declare = async () => {
    setSaving(true);
    try {
      setMe(await api('POST', '/nfp/me', me?.hasCpf ? {} : {cpf}));
      Alert.alert('Obrigado!', 'A Liga confere a lista de doadores e confirma a sua doação. Você recebe um aviso aqui no app.');
    } catch (e) {
      Alert.alert('Não foi possível marcar', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!info || !me) {
    return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{marginTop: 40}} color={GREEN} />;
  }
  if (!info.enabled) {
    return (
      <View style={{padding: 24}}>
        <Text style={styles.title}>Em breve</Text>
        <Text style={styles.text}>A doação da Nota Fiscal Paulista para a Liga ainda está sendo configurada.</Text>
      </View>
    );
  }

  const st = me.status;
  const steps = [
    {
      icon: 'log-in',
      title: 'Entre na Nota Fiscal Paulista',
      text: 'Com o seu CPF e a senha da Nota Fiscal Paulista. Ainda não tem cadastro? No site, faça o seu (é gratuito).',
      action: (
        <TouchableOpacity style={styles.stepBtn} onPress={() => openUrl(info.siteUrl)} testID="abrir-nfp">
          <Ionicons name="open-outline" size={16} color={GREEN} />
          <Text style={styles.stepBtnText}>Abrir Nota Fiscal Paulista</Text>
        </TouchableOpacity>
      ),
    },
    {icon: 'menu', title: 'Menu "Entidades"', text: 'No menu de cima, escolha Entidades → Doação de cupons com CPF (automática).'},
    {
      icon: 'search',
      title: `Busque a ${info.entityName}`,
      text: 'Cole o CNPJ da Liga no campo de busca:',
      action: (
        <TouchableOpacity style={styles.cnpj} onPress={copy} testID="copiar-cnpj">
          <Text style={styles.cnpjText}>{info.cnpj}</Text>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={GREEN} />
            <Text style={styles.stepBtnText}>{copied ? 'Copiado!' : 'Copiar'}</Text>
          </View>
        </TouchableOpacity>
      ),
    },
    {icon: 'checkmark-done', title: 'Confirme a doação automática', text: 'Pronto: a partir de agora, toda compra com CPF na nota gera crédito para a Liga, sem você fazer mais nada.'},
    {icon: 'phone-portrait', title: 'Volte aqui e toque em "Já fiz"', text: 'A Liga confere na lista de doadores dela e confirma o seu apoio.'},
  ];

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#F9FAFB'}} contentContainerStyle={{padding: 16, paddingBottom: 40}} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Ionicons name="receipt" size={30} color="#FFFFFF" />
        <Text style={styles.heroTitle}>Sua nota fiscal ajuda os animais</Text>
        <Text style={styles.heroText}>
          Com a doação automática da Nota Fiscal Paulista, os créditos das suas compras com CPF na nota vão para a {info.entityName}. Leva 2 minutos e vale para sempre.
        </Text>
        {info.supporters ? (
          <Text style={styles.heroCount} testID="apoiadores">
            {info.supporters} {info.supporters === 1 ? 'pessoa já apoia' : 'pessoas já apoiam'}
          </Text>
        ) : null}
      </View>

      {st === 'CONFIRMED' ? (
        <View style={[styles.status, {backgroundColor: '#ECFDF5', borderColor: '#6EE7B7'}]} testID="status-confirmado">
          <Ionicons name="ribbon" size={28} color={GREEN} />
          <View style={{flex: 1}}>
            <Text style={[styles.statusTitle, {color: '#065F46'}]}>Apoiador Nota Fiscal</Text>
            <Text style={styles.statusText}>Confirmado pela Liga em {dateBR(me.confirmedAt)}. Obrigado! Continue pedindo CPF na nota.</Text>
          </View>
        </View>
      ) : st === 'DECLARED' ? (
        <View style={[styles.status, {backgroundColor: '#FFFBEB', borderColor: '#FCD34D'}]} testID="status-aguardando">
          <Ionicons name="hourglass" size={26} color="#B45309" />
          <View style={{flex: 1}}>
            <Text style={[styles.statusTitle, {color: '#92400E'}]}>Aguardando conferência</Text>
            <Text style={styles.statusText}>
              {me.waitingDays > 30
                ? 'Ainda não encontramos você na lista de doadores. Confira se a doação automática foi confirmada (passo 4) com o mesmo CPF do seu cadastro.'
                : 'A Liga confere a lista de doadores periodicamente. Você recebe um aviso quando for confirmado.'}
            </Text>
          </View>
        </View>
      ) : st === 'LAPSED' ? (
        <View style={[styles.status, {backgroundColor: '#FEF2F2', borderColor: '#FCA5A5'}]} testID="status-nao-encontrado">
          <Ionicons name="alert-circle" size={26} color="#B91C1C" />
          <View style={{flex: 1}}>
            <Text style={[styles.statusTitle, {color: '#991B1B'}]}>Doação não encontrada</Text>
            <Text style={styles.statusText}>A doação automática não apareceu na última conferência. Refaça o passo a passo e toque em "Já fiz".</Text>
          </View>
        </View>
      ) : null}

      {st !== 'CONFIRMED' ? (
        <>
          <Text style={styles.section}>Passo a passo</Text>
          {steps.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
                {s.action || null}
              </View>
            </View>
          ))}

          {me.guest ? (
            <Text style={styles.text}>Entre na sua conta do app para marcar que fez a doação.</Text>
          ) : (
            <View style={{marginTop: 8}}>
              {!me.hasCpf ? (
                <>
                  <Text style={styles.label}>Seu CPF (o mesmo da Nota Fiscal Paulista)</Text>
                  <TextInput
                    style={styles.input}
                    value={cpf}
                    onChangeText={t => setCpf(formatCpfInput(t))}
                    keyboardType="number-pad"
                    placeholder="000.000.000-00"
                    placeholderTextColor="#9CA3AF"
                    testID="cpf"
                  />
                </>
              ) : (
                <Text style={styles.hint}>A Liga confere pelo CPF do seu cadastro ({me.cpfMasked}).</Text>
              )}
              <TouchableOpacity
                style={[styles.done, (saving || (!me.hasCpf && cpf.replace(/\D/g, '').length !== 11)) && {opacity: 0.5}]}
                disabled={saving || (!me.hasCpf && cpf.replace(/\D/g, '').length !== 11)}
                onPress={declare}
                testID="ja-fiz">
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={styles.doneText}>{st === 'DECLARED' ? 'Já fiz (marcar de novo)' : 'Já fiz a doação automática'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : null}

      <Text style={styles.footer}>
        Vale para compras no estado de São Paulo com CPF na nota. A Liga não tem acesso à sua senha nem às suas compras: só vê
        que você está na lista de doadores da entidade.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  error: {color: '#B91C1C', margin: 24},
  title: {fontSize: 20, ...F.heavy, color: '#1F2937'},
  text: {
    ...F.regular, fontSize: 14, color: '#4B5563', marginTop: 8, lineHeight: 20},
  hero: {backgroundColor: GREEN, borderRadius: 18, padding: 18},
  heroTitle: {color: '#FFFFFF', fontSize: 20, ...F.heavy, marginTop: 8},
  heroText: {
    ...F.regular, color: '#D1FAE5', fontSize: 14, marginTop: 6, lineHeight: 20},
  heroCount: {color: '#FFFFFF', ...F.heavy, marginTop: 10},
  status: {flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 14},
  statusTitle: {fontSize: 16, ...F.heavy, },
  statusText: {
    ...F.regular, fontSize: 13, color: '#374151', marginTop: 2, lineHeight: 18},
  section: {fontSize: 16, ...F.heavy, color: '#1F2937', marginTop: 20, marginBottom: 8},
  step: {flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8},
  num: {width: 28, height: 28, borderRadius: 14, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center'},
  numText: {...F.heavy, color: '#065F46'},
  stepTitle: {fontSize: 15, ...F.bold, color: '#1F2937'},
  stepText: {
    ...F.regular, fontSize: 13, color: '#4B5563', marginTop: 2, lineHeight: 18},
  stepBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8},
  stepBtnText: {color: GREEN, ...F.bold, },
  cnpj: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10},
  cnpjText: {fontSize: 16, ...F.heavy, color: '#065F46', letterSpacing: 0.5},
  label: {fontSize: 13, ...F.bold, color: '#374151', marginBottom: 6},
  input: {
    ...F.regular, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1F2937'},
  hint: {
    ...F.regular, fontSize: 12, color: '#6B7280'},
  done: {flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: GREEN, height: 52, borderRadius: 14, marginTop: 12},
  doneText: {color: '#FFFFFF', ...F.heavy, fontSize: 16},
  footer: {
    ...F.regular, fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 18, lineHeight: 17},
});
