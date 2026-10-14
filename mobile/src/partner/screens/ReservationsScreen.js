/**
 * Reservas feitas pelos membros a partir de um orçamento. No caixa: o membro mostra o código,
 * você confere aqui e marca como concluída.
 */
import React, {useCallback, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {ActivityIndicator, Alert, FlatList, Text, View} from 'react-native';
import {COLORS, formatDateBR, usePartner} from '../PartnerContext';
import {Badge, Button, Card, Empty, Field, styles as ui} from '../ui';
import {brl} from '../../utils/priceCompare';
import {validLabel} from '../../utils/quotes';

const STATUS = {RESERVED: ['Aguardando', 'warn'], DONE: ['Concluída', 'ok'], CANCELLED: ['Cancelada', 'muted']};

export default function ReservationsScreen() {
  const {api} = usePartner();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api('GET', '/partner/reservations');
      setList(d.reservations || []);
      setError('');
    } catch (e) {
      setList([]);
      setError(e.message);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const act = (r, action) => {
    const run = async () => {
      setBusy(r.id);
      try {
        await api('POST', `/partner/reservations/${r.id}/${action}`);
        await load();
      } catch (e) {
        Alert.alert('Erro', e.message);
      } finally {
        setBusy(null);
      }
    };
    if (action === 'cancel') {
      Alert.alert('Cancelar reserva?', 'Use só se o membro desistiu ou não veio.', [
        {text: 'Voltar', style: 'cancel'},
        {text: 'Cancelar reserva', style: 'destructive', onPress: run},
      ]);
    } else {
      run();
    }
  };

  if (!list) {
    return (
      <View style={[ui.screen, {alignItems: 'center', justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const typed = code.trim().toUpperCase();
  const shown = typed ? list.filter(r => r.code.startsWith(typed)) : list;

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={shown}
      keyExtractor={r => r.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <Field
            label="Código que o membro mostrou"
            value={code}
            onChangeText={t => setCode(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
            autoCapitalize="characters"
            placeholder="Ex.: K7PX2M"
            testID="busca-codigo"
          />
          {error ? <Text style={{color: COLORS.bad, marginBottom: 10}}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={<Empty text={typed ? 'Nenhuma reserva com esse código.' : 'Nenhuma reserva ainda.'} />}
      renderItem={({item: r}) => {
        const [label, tone] = STATUS[r.status] || STATUS.CANCELLED;
        return (
          <Card testID={`reserva-${r.code}`}>
            <View style={[ui.row, {justifyContent: 'space-between'}]}>
              <Text style={{fontSize: 24, fontWeight: '900', letterSpacing: 4, color: COLORS.text}}>{r.code}</Text>
              <Badge text={label} tone={tone} />
            </View>
            <Text style={[ui.muted, {marginTop: 2}]}>
              {r.memberFirstName || 'Membro'} · {r.memberActive ? 'membro ativo' : 'não é membro pagante'} · {formatDateBR(r.createdAt)}
            </Text>
            <View style={{marginTop: 8}}>
              {(r.lines || []).map(l => (
                <View key={l.requestItemId} style={[ui.row, {justifyContent: 'space-between', paddingVertical: 4}]}>
                  <Text style={{flex: 1, color: COLORS.text}}>
                    {l.quantity > 1 ? `${l.quantity}× ` : ''}
                    {l.label}
                  </Text>
                  <Text style={{fontWeight: '700', color: COLORS.text}}>{brl(l.total)}</Text>
                </View>
              ))}
            </View>
            <View style={[ui.row, {justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginTop: 4}]}>
              <Text style={ui.muted}>{r.status === 'RESERVED' ? validLabel(r.validUntil) : ''}</Text>
              <Text style={{fontSize: 18, fontWeight: '900', color: COLORS.primaryDark}}>{brl(r.total)}</Text>
            </View>
            {r.status === 'RESERVED' ? (
              <View style={[ui.row, {gap: 8, marginTop: 10}]}>
                <Button title="Cancelar" variant="danger" onPress={() => act(r, 'cancel')} style={{flex: 1}} disabled={busy === r.id} />
                <Button title="Concluir venda" onPress={() => act(r, 'done')} style={{flex: 2}} loading={busy === r.id} testID={`concluir-${r.code}`} />
              </View>
            ) : null}
          </Card>
        );
      }}
    />
  );
}
