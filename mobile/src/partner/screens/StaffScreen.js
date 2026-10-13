import React, {useCallback, useEffect, useState} from 'react';
import {Alert, ScrollView, Share, Text, View} from 'react-native';
import {COLORS, usePartner} from '../PartnerContext';
import {Badge, Button, Card, Field, styles as ui} from '../ui';

export default function StaffScreen() {
  const {api, account} = usePartner();
  const [list, setList] = useState([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState({text: '', tone: 'muted'});
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState(null); // {email, accessCode, shareMessage, accessCodeExpiresAt}

  const share = async data => {
    try {
      await Share.share({message: data.shareMessage || data.accessCode});
    } catch {
      /* usuário cancelou */
    }
  };

  const newCode = async a => {
    try {
      const r = await api('POST', `/partner/staff/${a.id}/access-code`);
      setIssued(r);
    } catch (e) {
      setMsg({text: e.message, tone: 'bad'});
    }
  };

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
      if (r.accessCode) {
        setIssued(r);
        setMsg({text: '', tone: 'muted'});
      } else {
        setIssued(null);
        setMsg({
          text: `Acesso liberado. ${r.email} já tem conta na Liga do Bem e entra com a senha de sempre.`,
          tone: 'ok',
        });
      }
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
      {issued ? (
        <Card style={{borderColor: '#5EEAD4', backgroundColor: COLORS.primarySoft}}>
          <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.primaryDark}}>
            Código de primeiro acesso
          </Text>
          <Text style={{color: COLORS.primaryDark, marginTop: 4}}>
            Mande para {issued.email}. No app, a pessoa toca em "Primeiro acesso" → "Já tenho um código" e cria a senha.
          </Text>
          <Text
            selectable
            testID="codigo-acesso"
            style={{fontSize: 34, fontWeight: '900', letterSpacing: 6, textAlign: 'center', color: COLORS.primaryDark, marginVertical: 10}}>
            {issued.accessCode}
          </Text>
          <Text style={[ui.muted, {textAlign: 'center', marginBottom: 12}]}>
            Vale por 72 horas e só pode ser usado uma vez.
          </Text>
          <Button title="Compartilhar (WhatsApp)" onPress={() => share(issued)} testID="compartilhar-codigo" />
          <Button title="Fechar" variant="ghost" onPress={() => setIssued(null)} style={{marginTop: 6}} />
        </Card>
      ) : null}
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
              <View style={{gap: 6}}>
                <Button
                  title="Novo código"
                  variant="secondary"
                  onPress={() => newCode(a)}
                  style={{minHeight: 38, paddingHorizontal: 12}}
                />
                <Button
                  title="Remover"
                  variant="danger"
                  onPress={() => remove(a)}
                  style={{minHeight: 38, paddingHorizontal: 12}}
                />
              </View>
            )}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
