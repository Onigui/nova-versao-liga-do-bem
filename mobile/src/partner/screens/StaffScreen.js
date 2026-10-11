import React, {useCallback, useEffect, useState} from 'react';
import {Alert, ScrollView, Text, View} from 'react-native';
import {COLORS, usePartner} from '../PartnerContext';
import {Badge, Button, Card, Field, styles as ui} from '../ui';

export default function StaffScreen() {
  const {api, account} = usePartner();
  const [list, setList] = useState([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState({text: '', tone: 'muted'});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api('GET', '/partner/staff');
      setList(r.accounts);
    } catch (e) {
      setMsg({text: e.message, tone: 'bad'});
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setSaving(true);
    setMsg({text: '', tone: 'muted'});
    try {
      const r = await api('POST', '/partner/staff', {
        email: email.trim(),
        name: name.trim(),
      });
      setMsg({
        text: r.emailSent
          ? `Pronto! Enviamos um e-mail para ${r.email} com as instruções de acesso.`
          : `Acesso criado. Peça para ${r.email} tocar em "Primeiro acesso" no app para criar a senha.`,
        tone: 'ok',
      });
      setEmail('');
      setName('');
      load();
    } catch (e) {
      setMsg({text: e.message, tone: 'bad'});
    } finally {
      setSaving(false);
    }
  };

  const remove = a =>
    Alert.alert(
      'Remover acesso?',
      `${a.name || a.email} não vai mais conseguir entrar.`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api('DELETE', `/partner/staff/${a.id}`);
              load();
            } catch (e) {
              setMsg({text: e.message, tone: 'bad'});
            }
          },
        },
      ],
    );

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled">
      <Card>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            color: COLORS.text,
            marginBottom: 8,
          }}>
          Adicionar funcionário
        </Text>
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Nome"
          value={name}
          onChangeText={setName}
          placeholder="Opcional"
        />
        {msg.text ? (
          <Text
            style={{
              color: msg.tone === 'ok' ? COLORS.ok : COLORS.bad,
              marginBottom: 10,
            }}>
            {msg.text}
          </Text>
        ) : null}
        <Button
          title="Dar acesso"
          onPress={add}
          loading={saving}
          disabled={!email.includes('@')}
        />
        <Text style={[ui.muted, {fontSize: 12, marginTop: 8}]}>
          Funcionários só validam carteirinhas. Não editam a empresa nem as
          promoções.
        </Text>
      </Card>
      {list.map(a => (
        <Card key={a.id} style={{paddingVertical: 12}}>
          <View style={[ui.row, {justifyContent: 'space-between'}]}>
            <View style={{flex: 1}}>
              <Text style={{fontWeight: '700', color: COLORS.text}}>
                {a.name || a.email}
              </Text>
              <Text style={ui.muted}>{a.email}</Text>
            </View>
            {a.role === 'OWNER' ? (
              <Badge text="Responsável" />
            ) : a.id === account?.id ? null : (
              <Button
                title="Remover"
                variant="danger"
                onPress={() => remove(a)}
                style={{minHeight: 38, paddingHorizontal: 12}}
              />
            )}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
