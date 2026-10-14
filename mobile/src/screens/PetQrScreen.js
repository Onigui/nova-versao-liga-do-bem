/**
 * "Mostrar ao veterinário": QR do pet que o veterinário parceiro lê para carimbar a carteira.
 * Muda a cada poucos minutos (print não vale) e é a autorização do tutor para o carimbo.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import {API_BASE_PATH} from '../config/apiConfig';

const RENEW_BEFORE_MS = 90 * 1000;

export default function PetQrScreen({route, navigation, fetchImpl = fetch}) {
  const {petId, petName} = route?.params || {};
  const [state, setState] = useState({code: null, expiresAt: null, error: null});
  const timer = useRef(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const r = await fetchImpl(`${API_BASE_PATH}/user/pets/${petId}/stamp-token`, {
        headers: {Authorization: `Bearer ${token}`},
        cache: 'no-store',
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.code) throw new Error(data.error || 'Não foi possível gerar o QR.');
      if (!alive.current) return;
      setState({code: data.code, expiresAt: data.expiresAt, error: null});
      const wait = Math.max(5000, new Date(data.expiresAt).getTime() - Date.now() - RENEW_BEFORE_MS);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => load(), Math.min(wait, 4 * 60 * 1000));
    } catch (e) {
      if (!alive.current) return;
      setState({code: null, expiresAt: null, error: /network|fetch/i.test(String(e.message)) ? 'Sem internet. O QR precisa de conexão.' : e.message});
      clearTimeout(timer.current);
      timer.current = setTimeout(() => load(), 30 * 1000);
    }
  }, [fetchImpl, petId]);

  useEffect(() => {
    alive.current = true;
    load();
    const sub = AppState.addEventListener('change', s => s === 'active' && load());
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      sub?.remove?.();
    };
  }, [load]);

  return (
    <LinearGradient colors={['#7C3AED', '#0D9488']} style={styles.container}>
      <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()} accessibilityLabel="Fechar">
        <Ionicons name="close" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.title}>Carteira de {petName || 'seu pet'}</Text>
      <Text style={styles.subtitle}>Mostre ao veterinário parceiro para ele carimbar a vacina</Text>
      <View style={styles.qrBox}>
        {state.code ? (
          <QRCode value={state.code} size={230} backgroundColor="#FFFFFF" color="#111827" />
        ) : state.error ? (
          <View style={{alignItems: 'center', padding: 20}}>
            <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
            <Text style={styles.err} testID="qr-erro">
              {state.error}
            </Text>
          </View>
        ) : (
          <ActivityIndicator size="large" color="#7C3AED" />
        )}
      </View>
      <View style={styles.tips}>
        {[
          ['shield-checkmark', 'Só veterinários com CRMV conferido pela Liga conseguem carimbar.'],
          ['refresh', 'O QR muda sozinho a cada poucos minutos: print não funciona.'],
          ['notifications', 'Você recebe um aviso assim que a vacina entrar na carteira.'],
        ].map(([icon, text]) => (
          <View key={icon} style={styles.tip}>
            <Ionicons name={icon} size={18} color="#FFFFFF" />
            <Text style={styles.tipText}>{text}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 24},
  close: {position: 'absolute', top: 44, right: 16, padding: 8},
  title: {color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center'},
  subtitle: {color: '#EDE9FE', fontSize: 15, textAlign: 'center', marginTop: 6, marginBottom: 24},
  qrBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    minWidth: 270,
    minHeight: 270,
    alignItems: 'center',
    justifyContent: 'center',
  },
  err: {color: '#4B5563', textAlign: 'center', marginTop: 10},
  tips: {marginTop: 28, gap: 12, alignSelf: 'stretch'},
  tip: {flexDirection: 'row', gap: 10, alignItems: 'center'},
  tipText: {color: '#FFFFFF', flex: 1, fontSize: 14},
});
