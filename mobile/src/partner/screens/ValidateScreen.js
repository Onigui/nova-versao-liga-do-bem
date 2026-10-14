import React, {useCallback, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {ScrollView, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, usePartner} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';

export default function ValidateScreen({navigation}) {
  const {partner, stats, api} = usePartner();
  const [canStamp, setCanStamp] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api?.('GET', '/partner/vet')
        .then(r => alive && setCanStamp(!!r?.canStamp))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [api]),
  );
  const [typed, setTyped] = useState('');
  const [shortCode, setShortCode] = useState('');
  const memberOk = /^MEM\d{4,20}$/.test(typed.trim());
  const codeOk = /^\d{6}$/.test(shortCode);

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled">
      <Text style={ui.title}>{partner?.name || 'Validar carteirinha'}</Text>
      <Text style={[ui.muted, {marginBottom: 16}]}>
        {stats
          ? `${stats.today} validação(ões) hoje · ${stats.last30} nos últimos 30 dias`
          : ' '}
      </Text>

      <Card style={{alignItems: 'center', paddingVertical: 28}}>
        <Icon name="qr-code-outline" size={72} color={COLORS.primary} />
        <Text
          style={{
            fontSize: 17,
            fontWeight: '700',
            color: COLORS.text,
            marginTop: 10,
            textAlign: 'center',
          }}>
          Peça para o membro abrir a carteirinha no app Liga do Bem
        </Text>
        <Text
          style={[
            ui.muted,
            {textAlign: 'center', marginTop: 6, marginBottom: 18},
          ]}>
          O QR muda sozinho a cada poucos minutos. Print ou foto antiga não
          vale.
        </Text>
        <Button
          title="Escanear carteirinha"
          icon={<Icon name="scan" size={22} color="#FFFFFF" />}
          onPress={() => navigation.navigate('Scanner')}
          style={{alignSelf: 'stretch'}}
          testID="escanear"
        />
      </Card>

      {canStamp ? (
        <Card style={{borderColor: '#99F6E4'}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10}}>
            <Icon name="ribbon" size={28} color={COLORS.primary} />
            <View style={{flex: 1}}>
              <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text}}>Carimbar carteira de vacinação</Text>
              <Text style={ui.muted}>Leia o QR do pet no app do tutor (Meus Pets → Mostrar ao veterinário).</Text>
            </View>
          </View>
          <Button
            title="Ler QR do pet"
            variant="secondary"
            icon={<Icon name="paw" size={20} color={COLORS.primary} />}
            onPress={() => navigation.navigate('Scanner', {mode: 'pet'})}
            testID="carimbar-pet"
          />
        </Card>
      ) : null}

      <Card>
        <Text style={{fontWeight: '700', color: COLORS.text, marginBottom: 8}}>
          Sem câmera ou QR não lê?
        </Text>
        <Text style={[ui.muted, {marginBottom: 10}]}>
          Digite o número da carteirinha (ID) e o código de 6 números que aparece embaixo do QR, no
          celular do membro. O código muda a cada 10 minutos.
        </Text>
        <Field
          label="Número da carteirinha"
          placeholder="MEM12345678"
          value={typed}
          onChangeText={t => setTyped(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          autoCapitalize="characters"
          maxLength={23}
          testID="numero"
        />
        <Field
          label="Código de 6 números"
          placeholder="000 000"
          value={shortCode}
          onChangeText={t => setShortCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          hint="Confira também o nome com um documento com foto."
          testID="codigo"
        />
        <Button
          title="Consultar"
          variant="secondary"
          disabled={!memberOk || !codeOk}
          onPress={() => {
            navigation.navigate('ValidationResult', {code: `${typed.trim()} ${shortCode}`});
            setTyped('');
            setShortCode('');
          }}
          testID="consultar"
        />
      </Card>
      <View style={{height: 8}} />
    </ScrollView>
  );
}
