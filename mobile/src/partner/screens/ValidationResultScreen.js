import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  Vibration,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, formatDateBR, usePartner} from '../PartnerContext';
import {Badge, Button, Card, Field, styles as ui} from '../ui';

export default function ValidationResultScreen({route, navigation}) {
  const {api, refresh} = usePartner();
  const code = route?.params?.code;
  const [state, setState] = useState({loading: true});
  const [discountId, setDiscountId] = useState(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let alive = true;
    api('POST', '/partner/validate', {code})
      .then(r => {
        if (!alive) return;
        setState({loading: false, result: r});
        Vibration.vibrate(r.valid ? 80 : [0, 120, 80, 120]);
        refresh();
      })
      .catch(e => alive && setState({loading: false, error: e.message}));
    return () => {
      alive = false;
    };
  }, [api, code, refresh]);

  const register = async () => {
    setSaveError('');
    setSaving(true);
    try {
      await api('PATCH', `/partner/validations/${state.result.validationId}`, {
        discountId,
        amount: amount ? amount.replace(/\./g, '').replace(',', '.') : 0,
      });
      setSaved(true);
      refresh();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const again = () => navigation.replace('Scanner');
  const done = () => navigation.popToTop();

  if (state.loading) {
    return (
      <View
        style={[ui.screen, {alignItems: 'center', justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[ui.muted, {marginTop: 12}]}>Conferindo carteirinha…</Text>
      </View>
    );
  }
  if (state.error) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Card>
          <Text style={{fontSize: 17, fontWeight: '700', color: COLORS.bad}}>
            Não foi possível validar
          </Text>
          <Text style={[ui.muted, {marginVertical: 10}]}>{state.error}</Text>
          <Button title="Tentar de novo" onPress={again} />
        </Card>
      </View>
    );
  }

  const r = state.result;
  const member = r.member;
  const ok = r.valid === true;
  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled">
      <View
        testID={ok ? 'resultado-ativa' : 'resultado-invalida'}
        style={{
          backgroundColor: ok ? COLORS.ok : COLORS.bad,
          borderRadius: 18,
          padding: 22,
          alignItems: 'center',
          marginBottom: 12,
        }}>
        <Icon
          name={ok ? 'checkmark-circle' : 'close-circle'}
          size={64}
          color="#FFFFFF"
        />
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: '900',
            marginTop: 6,
          }}>
          {ok
            ? 'CARTEIRINHA ATIVA'
            : member
            ? 'CARTEIRINHA VENCIDA'
            : 'NÃO VÁLIDA'}
        </Text>
        <Text
          style={{
            color: '#FFFFFFDD',
            fontSize: 15,
            textAlign: 'center',
            marginTop: 6,
          }}>
          {r.message}
        </Text>
      </View>

      {r.warning ? (
        <Card
          style={{backgroundColor: COLORS.warnSoft, borderColor: '#FCD34D'}}>
          <Text style={{color: COLORS.warn, fontWeight: '700'}}>
            ⚠️ {r.warning}
          </Text>
        </Card>
      ) : null}

      {member ? (
        <Card>
          <View style={[ui.row, {gap: 14}]}>
            {member.avatar ? (
              <Image
                source={{uri: member.avatar}}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#E2E8F0',
                }}
              />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: COLORS.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="person" size={32} color={COLORS.primary} />
              </View>
            )}
            <View style={{flex: 1}}>
              <Text
                style={{fontSize: 19, fontWeight: '800', color: COLORS.text}}>
                {member.name}
              </Text>
              <Text style={ui.muted}>Nº {member.memberId}</Text>
              <Text style={ui.muted}>
                Válida até {formatDateBR(member.endDate) || '—'}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {ok && !saved ? (
        <Card>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: COLORS.text,
              marginBottom: 4,
            }}>
            Registrar o atendimento
          </Text>
          <Text style={[ui.muted, {marginBottom: 12}]}>
            Opcional: ajuda a Liga a mostrar quanto os membros economizam.
          </Text>
          {r.discounts?.length ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12,
              }}>
              {r.discounts.map(d => {
                const sel = discountId === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setDiscountId(sel ? null : d.id)}
                    style={{
                      borderWidth: 1.5,
                      borderColor: sel ? COLORS.primary : COLORS.border,
                      backgroundColor: sel ? COLORS.primarySoft : '#FFFFFF',
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}>
                    <Text style={{fontWeight: '700', color: COLORS.text}}>
                      {d.name}
                    </Text>
                    <Text
                      style={{
                        color: COLORS.primary,
                        fontWeight: '700',
                        fontSize: 13,
                      }}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[ui.muted, {marginBottom: 12}]}>
              Você não tem promoções ativas agora.
            </Text>
          )}
          <Field
            label="Valor da compra (R$)"
            placeholder="0,00"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={t => setAmount(t.replace(/[^\d,]/g, ''))}
          />
          {saveError ? (
            <Text style={[ui.error, {marginBottom: 8}]}>{saveError}</Text>
          ) : null}
          <Button
            title="Registrar"
            onPress={register}
            loading={saving}
            testID="registrar"
          />
        </Card>
      ) : null}

      {saved ? (
        <Card style={{backgroundColor: COLORS.okSoft, borderColor: '#86EFAC'}}>
          <Badge text="Registrado" />
          <Text style={{color: COLORS.ok, marginTop: 6}}>
            Atendimento registrado no histórico.
          </Text>
        </Card>
      ) : null}

      <Button
        title="Validar outra carteirinha"
        onPress={again}
        style={{marginTop: 4}}
      />
      <Button
        title="Concluir"
        variant="ghost"
        onPress={done}
        style={{marginTop: 8}}
      />
    </ScrollView>
  );
}
