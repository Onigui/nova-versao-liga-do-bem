/**
 * Aviso de carteirinha vencendo: ao abrir o app, se faltam poucos dias (a ONG escolhe quantos,
 * padrão 7), aparece um pop-up com "Renovar", "Fechar" e "Não avisar de novo".
 *
 * - "Fechar": some agora e volta na próxima vez que o app for aberto.
 * - "Não avisar de novo": vale só para ESTE vencimento. Depois de renovar, o próximo vencimento
 *   avisa de novo (a chave salva leva a data de vencimento).
 * - Uma vez por abertura do app: voltar para o Início não abre o aviso outra vez.
 */
import React, {useEffect, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {C, F, dateBR} from '../theme/home';

const shownThisSession = new Set();
/** Só para testes. */
export function resetRenewReminderSession() {
  shownThisSession.clear();
}

export const reminderKey = (userId, endDate) => `renew_reminder_off:${userId || 'anon'}:${String(endDate || '').slice(0, 10)}`;

export function reminderText(daysLeft, endDate) {
  const when = dateBR(endDate);
  if (daysLeft <= 0) return `Sua carteirinha vence hoje (${when}).`;
  if (daysLeft === 1) return `Sua carteirinha vence amanhã (${when}).`;
  return `Sua carteirinha vence em ${daysLeft} dias (${when}).`;
}

function storage() {
  const m = require('@react-native-async-storage/async-storage');
  return m.default || m;
}

export default function RenewReminder({membership: m, userId, onRenew}) {
  const [visible, setVisible] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);
  const key = m?.endDate ? reminderKey(userId, m.endDate) : null;

  useEffect(() => {
    let alive = true;
    if (!m?.active || !m?.renewSoon || !key || shownThisSession.has(key)) return undefined;
    (async () => {
      let off = null;
      try {
        off = await storage().getItem(key);
      } catch {
        off = null;
      }
      if (!alive || off === '1') return;
      shownThisSession.add(key);
      setDontAsk(false);
      setVisible(true);
    })();
    return () => {
      alive = false;
    };
  }, [m?.active, m?.renewSoon, key]);

  if (!visible || !m) return null;

  const close = async renew => {
    setVisible(false);
    if (dontAsk && key) {
      try {
        await storage().setItem(key, '1');
      } catch {
        /* sem armazenamento: só não lembra */
      }
    }
    if (renew) onRenew?.();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="aviso-vencimento">
          <TouchableOpacity style={styles.x} onPress={() => close(false)} accessibilityLabel="Fechar" hitSlop={10}>
            <Ionicons name="close" size={22} color={C.muted} />
          </TouchableOpacity>
          <View style={styles.icon}>
            <Ionicons name="time" size={30} color={C.warn} />
          </View>
          <Text style={[styles.title, F.heavy]}>{reminderText(m.daysLeft, m.endDate)}</Text>
          <Text style={[styles.text, F.regular]}>
            Renove agora para continuar com os descontos nos parceiros. Você não perde nenhum dia: o novo período começa
            quando o atual terminar.
          </Text>

          <Pressable
            style={styles.check}
            onPress={() => setDontAsk(v => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{checked: dontAsk}}
            testID="aviso-nao-avisar">
            <Ionicons name={dontAsk ? 'checkbox' : 'square-outline'} size={22} color={C.primary} />
            <Text style={[styles.checkText, F.semibold]}>Não avisar de novo</Text>
          </Pressable>

          <TouchableOpacity style={styles.primary} onPress={() => close(true)} testID="aviso-renovar">
            <Text style={[styles.primaryText, F.heavy]}>Renovar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => close(false)} testID="aviso-fechar">
            <Text style={[styles.secondaryText, F.bold]}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(15,10,30,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24},
  card: {width: '100%', maxWidth: 380, backgroundColor: C.card, borderRadius: 20, padding: 22, alignItems: 'center'},
  x: {position: 'absolute', top: 12, right: 12},
  icon: {width: 60, height: 60, borderRadius: 30, backgroundColor: C.warnSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12},
  title: {fontSize: 18, color: C.ink, textAlign: 'center'},
  text: {fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 20},
  check: {flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 16, paddingVertical: 6},
  checkText: {fontSize: 14, color: C.ink},
  primary: {alignSelf: 'stretch', height: 50, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginTop: 14},
  primaryText: {color: '#FFFFFF', fontSize: 16},
  secondary: {alignSelf: 'stretch', height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 6},
  secondaryText: {color: C.muted, fontSize: 15},
});
