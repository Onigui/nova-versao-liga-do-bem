/**
 * Responder um pedido de orçamento. Vem preenchido com o seu preço de tabela; ajuste o que quiser.
 * Às cegas: você não vê as propostas das outras lojas, e elas não veem a sua.
 * Depois de enviada, a proposta não pode ser alterada (só retirada, se o membro ainda não reservou).
 */
import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../../config/apiConfig';
import {COLORS, usePartner} from '../PartnerContext';
import {Badge, Button, Card, Field, styles as ui} from '../ui';
import {brl} from '../../utils/priceCompare';
import {RESPONSE_VALID_HOURS, buildResponseBody, moneyInput, responseTotal, timeLeft, validLabel} from '../../utils/quotes';

function Chip({label, active, onPress, testID}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityState={{selected: !!active}}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? COLORS.primary : '#CBD5E1',
        backgroundColor: active ? COLORS.primary : '#FFFFFF',
      }}>
      <Text style={{fontWeight: '700', fontSize: 13, color: active ? '#FFFFFF' : '#334155'}}>{label}</Text>
    </Pressable>
  );
}

export default function QuoteRespondScreen({route, navigation}) {
  const {api, token} = usePartner();
  const requestId = route?.params?.requestId;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});
  const [validHours, setValidHours] = useState(48);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [showRx, setShowRx] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api('GET', `/partner/quotes/${requestId}`);
      setData(d);
      setForm(f => {
        if (Object.keys(f).length) return f;
        const init = {};
        for (const it of d.items) init[it.id] = {price: moneyInput(it.myTablePrice), unavailable: false, note: ''};
        return init;
      });
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [api, requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const setLine = (id, patch) => setForm(f => ({...f, [id]: {...f[id], ...patch}}));

  const submit = () => {
    const built = buildResponseBody(data.items, form, {validHours, note});
    if (built.error) {
      Alert.alert('Confira a proposta', built.error);
      return;
    }
    const {total, count} = responseTotal(data.items, form);
    Alert.alert(
      'Enviar proposta?',
      `${count} ${count === 1 ? 'item' : 'itens'} · total ${brl(total)} · válida por ${validHours} h.\n\nDepois de enviada, a proposta NÃO pode ser alterada. Se o membro reservar, o preço precisa ser honrado.`,
      [
        {text: 'Revisar', style: 'cancel'},
        {
          text: 'Enviar',
          onPress: async () => {
            setSending(true);
            try {
              await api('POST', `/partner/quotes/${requestId}/response`, built.body);
              await load();
            } catch (e) {
              Alert.alert('Não foi possível enviar', e.message);
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  const withdraw = () =>
    Alert.alert('Retirar proposta?', 'O membro deixa de ver a sua proposta (seu preço de tabela continua aparecendo). Você pode mandar outra enquanto o pedido estiver aberto.', [
      {text: 'Voltar', style: 'cancel'},
      {
        text: 'Retirar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', `/partner/quotes/${requestId}/response`);
            setForm({});
            await load();
          } catch (e) {
            Alert.alert('Não foi possível retirar', e.message);
          }
        },
      },
    ]);

  if (!data) {
    return (
      <View style={[ui.screen, {alignItems: 'center', justifyContent: 'center', padding: 24}]}>
        {error ? <Text style={{color: COLORS.bad, textAlign: 'center'}}>{error}</Text> : <ActivityIndicator size="large" color={COLORS.primary} />}
      </View>
    );
  }

  const {request, items, myResponse, reservation} = data;
  const sent = myResponse?.status === 'SUBMITTED';
  const canAnswer = request.open && !sent;
  const {total, count} = responseTotal(items, form);
  const lineOf = id => myResponse?.lines?.find(l => l.requestItemId === id);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Card>
        <View style={[ui.row, {justifyContent: 'space-between'}]}>
          <Badge text={request.open ? timeLeft(request.expiresAt) : 'Pedido encerrado'} tone={request.open ? 'warn' : 'muted'} />
          {request.fromUs ? <Badge text="Lista feita aqui" tone="ok" /> : null}
        </View>
        <Text style={[ui.title, {fontSize: 20, marginTop: 8}]}>
          {items.length} {items.length === 1 ? 'item' : 'itens'}
          {request.species ? ` · ${request.species}` : ''}
          {request.petWeight ? ` ${request.petWeight} kg` : ''}
        </Text>
        <Text style={ui.muted}>
          {[request.district, request.city].filter(Boolean).join(', ') || 'Membro da Liga do Bem'} · o nome do cliente não aparece
        </Text>
        {request.notes ? <Text style={{marginTop: 8, color: COLORS.text}}>“{request.notes}”</Text> : null}
        {request.hasPrescription ? (
          <View style={{marginTop: 10}}>
            <Button title={showRx ? 'Esconder receita' : 'Ver receita'} variant="secondary" onPress={() => setShowRx(v => !v)} testID="ver-receita" />
            {showRx ? (
              <Image
                source={{uri: `${API_BASE_PATH}/partner/quotes/${requestId}/prescription`, headers: {Authorization: `Bearer ${token}`}}}
                style={{width: '100%', height: 360, marginTop: 10, borderRadius: 10, backgroundColor: '#F1F5F9'}}
                resizeMode="contain"
              />
            ) : null}
          </View>
        ) : null}
      </Card>

      {reservation && reservation.status !== 'CANCELLED' ? (
        <Card style={{borderColor: '#86EFAC', backgroundColor: COLORS.okSoft}}>
          <Text style={{fontWeight: '800', color: COLORS.ok}}>
            {reservation.status === 'DONE' ? 'Venda concluída' : `O membro reservou com você · código ${reservation.code}`}
          </Text>
          <Text style={{color: COLORS.ok, marginTop: 2}}>Total {brl(reservation.total)}. Confira o código no caixa em "Reservas".</Text>
        </Card>
      ) : null}

      {sent ? (
        <Card style={{borderColor: '#99F6E4'}}>
          <View style={[ui.row, {gap: 8, marginBottom: 6}]}>
            <Icon name="lock-closed" size={18} color={COLORS.primary} />
            <Text style={{fontWeight: '800', color: COLORS.text, flex: 1}}>Proposta enviada · {validLabel(myResponse.validUntil)}</Text>
          </View>
          {items.map(it => {
            const l = lineOf(it.id);
            return (
              <View key={it.id} style={[ui.row, {justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.border}]}>
                <Text style={{flex: 1, color: COLORS.text}}>
                  {it.quantity > 1 ? `${it.quantity}× ` : ''}
                  {it.label}
                </Text>
                <Text style={{fontWeight: '700', color: l?.available ? COLORS.text : COLORS.muted}}>
                  {l?.available && l.unitPrice != null ? brl(l.unitPrice * it.quantity) : 'não tenho'}
                </Text>
              </View>
            );
          })}
          {myResponse.note ? <Text style={[ui.muted, {marginTop: 6}]}>“{myResponse.note}”</Text> : null}
          {!reservation || reservation.status === 'CANCELLED' ? (
            <Button title="Retirar proposta" variant="danger" onPress={withdraw} style={{marginTop: 12}} testID="retirar" />
          ) : null}
        </Card>
      ) : canAnswer ? (
        <>
          <Text style={[ui.sectionTitle, {marginBottom: 8}]}>Sua proposta (preço por unidade)</Text>
          {items.map(it => {
            const f = form[it.id] || {};
            return (
              <Card key={it.id} style={{paddingVertical: 12}}>
                <Text style={{fontWeight: '700', color: COLORS.text}}>
                  {it.quantity > 1 ? `${it.quantity}× ` : ''}
                  {it.label}
                </Text>
                <Text style={[ui.muted, {fontSize: 12}]}>
                  {it.note ? `${it.note} · ` : ''}
                  {it.myTablePrice != null ? `sua tabela: ${brl(it.myTablePrice)}` : it.itemId ? 'sem preço na sua tabela' : 'item escrito pelo membro'}
                </Text>
                <View style={[ui.row, {gap: 10, marginTop: 8}]}>
                  <TextInput
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      fontSize: 16,
                      color: COLORS.text,
                      backgroundColor: f.unavailable ? '#F1F5F9' : '#FFFFFF',
                    }}
                    placeholder="R$ 0,00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                    editable={!f.unavailable}
                    value={f.unavailable ? '' : f.price}
                    onChangeText={t => setLine(it.id, {price: t})}
                    testID={`preco-${it.id}`}
                  />
                  <Pressable
                    onPress={() => setLine(it.id, {unavailable: !f.unavailable})}
                    style={[ui.row, {gap: 4}]}
                    accessibilityState={{checked: !!f.unavailable}}
                    testID={`naotenho-${it.id}`}>
                    <Icon name={f.unavailable ? 'checkbox' : 'square-outline'} size={22} color={f.unavailable ? COLORS.bad : COLORS.muted} />
                    <Text style={{color: COLORS.muted}}>Não tenho</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
          <Text style={[ui.sectionTitle, {marginTop: 4, marginBottom: 8}]}>Validade da proposta</Text>
          <View style={[ui.row, {gap: 8, marginBottom: 12}]}>
            {RESPONSE_VALID_HOURS.map(h => (
              <Chip key={h} label={`${h} h`} active={validHours === h} onPress={() => setValidHours(h)} testID={`validade-${h}`} />
            ))}
          </View>
          <Field label="Recado para o membro (opcional)" value={note} onChangeText={setNote} placeholder="Ex.: entregamos no bairro; parcelamos em 3x" maxLength={300} multiline />
          <Card style={{alignItems: 'center', backgroundColor: COLORS.primarySoft, borderColor: '#99F6E4'}}>
            <Text style={{color: COLORS.primaryDark}}>
              {count} de {items.length} {items.length === 1 ? 'item' : 'itens'}
            </Text>
            <Text style={{fontSize: 26, fontWeight: '900', color: COLORS.primaryDark}} testID="total-proposta">
              {brl(total)}
            </Text>
          </Card>
          <Button
            title="Enviar proposta"
            icon={<Icon name="paper-plane" size={20} color="#FFFFFF" />}
            onPress={submit}
            loading={sending}
            testID="enviar-proposta"
          />
          <Text style={[ui.muted, {textAlign: 'center', marginTop: 10, fontSize: 12}]}>
            Às cegas: você não vê as outras propostas e ninguém vê a sua. Mande o seu melhor preço: não dá para alterar depois.
          </Text>
        </>
      ) : (
        <Card>
          <Text style={ui.muted}>Este pedido encerrou sem proposta sua.</Text>
        </Card>
      )}
    </ScrollView>
  );
}
