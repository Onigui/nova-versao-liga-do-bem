/**
 * Cadastro do veterinário (CRMV). Só depois da aprovação da Liga o app libera o carimbo.
 */
import React, {useCallback, useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, usePartner} from '../PartnerContext';
import {Badge, Button, Card, Field, styles as ui} from '../ui';

export const UFS = 'SP MG RJ PR SC RS MS MT GO DF BA PE CE ES PA AM MA PB RN AL SE PI TO RO AC AP RR'.split(' ');

export const VET_STATUS = {
  PENDING: {text: 'Em análise pela Liga', tone: 'warn'},
  APPROVED: {text: 'Aprovado · pode carimbar', tone: 'ok'},
  REJECTED: {text: 'Não aprovado', tone: 'bad'},
};

export default function VetProfileScreen({navigation}) {
  const {api} = usePartner();
  const [vet, setVet] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({fullName: '', crmv: '', crmvUf: 'SP'});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api('GET', '/partner/vet');
      setVet(r.vet);
      if (r.vet) setForm({fullName: r.vet.fullName, crmv: r.vet.crmv, crmvUf: r.vet.crmvUf});
      setEditing(!r.vet);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const r = await api('POST', '/partner/vet', form);
      setVet(r.vet);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const st = vet ? VET_STATUS[vet.status] : null;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Card style={{backgroundColor: COLORS.primarySoft, borderColor: '#99F6E4'}}>
        <View style={[ui.row, {gap: 10}]}>
          <Icon name="ribbon" size={26} color={COLORS.primaryDark} />
          <Text style={{flex: 1, color: COLORS.primaryDark, fontWeight: '800', fontSize: 16}}>
            Carimbo digital de vacinas
          </Text>
        </View>
        <Text style={{color: COLORS.primaryDark, marginTop: 6}}>
          Veterinários com CRMV aprovado pela Liga registram vacinas, vermífugos e antipulgas direto na carteira do pet,
          com nome e CRMV. O tutor não consegue alterar esses registros.
        </Text>
      </Card>

      {loaded && vet && !editing ? (
        <Card>
          <View style={[ui.row, {justifyContent: 'space-between'}]}>
            <Text style={{fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1}}>{vet.fullName}</Text>
            <Badge text={st.text} tone={st.tone} />
          </View>
          <Text style={[ui.muted, {marginTop: 4}]} testID="crmv-label">
            {vet.crmvLabel}
          </Text>
          {vet.status === 'PENDING' ? (
            <Text style={[ui.muted, {marginTop: 10}]}>
              A Liga confere seu CRMV no conselho e avisa por notificação. Normalmente leva até 1 dia útil.
            </Text>
          ) : null}
          {vet.status === 'REJECTED' && vet.reviewNote ? (
            <Text style={{color: COLORS.bad, marginTop: 10}}>Motivo: {vet.reviewNote}</Text>
          ) : null}
          {vet.status === 'APPROVED' ? (
            <Button
              title="Carimbar uma carteira agora"
              icon={<Icon name="scan" size={20} color="#FFFFFF" />}
              onPress={() => navigation.navigate('Scanner', {mode: 'pet'})}
              style={{marginTop: 14}}
              testID="ir-carimbar"
            />
          ) : null}
          <Button
            title={vet.status === 'REJECTED' ? 'Corrigir dados' : 'Alterar dados'}
            variant="ghost"
            onPress={() => setEditing(true)}
            style={{marginTop: 6}}
          />
        </Card>
      ) : null}

      {loaded && editing ? (
        <Card>
          <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 10}}>Seus dados de veterinário</Text>
          <Field
            label="Nome completo (como no CRMV)"
            value={form.fullName}
            onChangeText={v => setForm(f => ({...f, fullName: v}))}
            maxLength={120}
            testID="vet-nome"
          />
          <Field
            label="Número do CRMV"
            value={form.crmv}
            onChangeText={v => setForm(f => ({...f, crmv: v.replace(/\D/g, '').slice(0, 7)}))}
            keyboardType="number-pad"
            placeholder="12345"
            testID="vet-crmv"
          />
          <Text style={ui.label}>Estado do CRMV</Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12}}>
            {UFS.map(uf => (
              <Pressable
                key={uf}
                testID={`uf-${uf}`}
                onPress={() => setForm(f => ({...f, crmvUf: uf}))}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: form.crmvUf === uf ? COLORS.primary : COLORS.border,
                  backgroundColor: form.crmvUf === uf ? COLORS.primary : '#FFFFFF',
                }}>
                <Text style={{fontWeight: '700', color: form.crmvUf === uf ? '#FFFFFF' : COLORS.text}}>{uf}</Text>
              </Pressable>
            ))}
          </View>
          {vet?.status === 'APPROVED' ? (
            <Text style={[ui.muted, {marginBottom: 10}]}>
              Se mudar o nome ou o CRMV, o cadastro volta para análise.
            </Text>
          ) : null}
          {error ? <Text style={[ui.error, {marginBottom: 10, fontSize: 14}]}>{error}</Text> : null}
          <Button title="Enviar para análise" onPress={save} loading={saving} testID="vet-salvar" />
          {vet ? <Button title="Cancelar" variant="ghost" onPress={() => setEditing(false)} style={{marginTop: 6}} /> : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}
