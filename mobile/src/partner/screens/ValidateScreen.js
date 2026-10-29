import React, {useCallback, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {ScrollView, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, usePartner} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';
import {useTour} from '../../components/Tour';
import {TOURS} from '../../tours';

export default function ValidateScreen({navigation}) {
  const {partner, stats, api} = usePartner();
  const [canStamp, setCanStamp] = useState(false);
  const [quotes, setQuotes] = useState(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api?.('GET', '/partner/vet')
        .then(r => alive && setCanStamp(!!r?.canStamp))
        .catch(() => {});
      api?.('GET', '/partner/quotes')
        .then(r => alive && setQuotes(r || null))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [api]),
  );
  const [typed, setTyped] = useState('');
  const [shortCode, setShortCode] = useState('');
  const tour = useTour(TOURS.partnerValidate.id, TOURS.partnerValidate.steps);
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
        <View ref={tour.ref('escanear')} collapsable={false}>
          <Button
            title="Escanear carteirinha"
            icon={<Icon name="scan" size={22} color="#FFFFFF" />}
            onPress={() => navigation.navigate('Scanner')}
            style={{alignSelf: 'stretch'}}
            testID="escanear"
          />
        </View>
      </Card>

      <Card style={quotes?.pending ? {borderColor: '#FCD34D', backgroundColor: '#FFFBEB'} : null}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10}}>
          <Icon name="flash" size={28} color={quotes?.pending ? COLORS.warn : COLORS.primary} />
          <View style={{flex: 1}}>
            <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text}} testID="orcamentos-titulo">
              {quotes?.pending
                ? `${quotes.pending} ${quotes.pending === 1 ? 'pedido de orçamento esperando' : 'pedidos de orçamento esperando'}`
                : 'Orçamentos dos membros'}
            </Text>
            <Text style={ui.muted}>Mande sua proposta às cegas: ninguém vê o preço do outro.</Text>
          </View>
        </View>
        <View ref={tour.ref('orcamentos')} collapsable={false}>
          <Button
            title={quotes?.pending ? 'Responder agora' : 'Ver orçamentos e reservas'}
            variant={quotes?.pending ? 'primary' : 'secondary'}
            icon={<Icon name="document-text" size={20} color={quotes?.pending ? '#FFFFFF' : COLORS.primary} />}
            onPress={() => navigation.navigate('QuotesInbox')}
            testID="abrir-orcamentos"
          />
        </View>
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
        <View ref={tour.ref('codigo')} collapsable={false}>
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
        </View>
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
