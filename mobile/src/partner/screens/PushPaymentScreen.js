/**
 * Pagamento da notificação paga: PIX (QR + copia e cola) ou cartão (criptografado no aparelho).
 * Faz polling até o PagBank confirmar; aí a notificação vai para a análise da Liga.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import PagBankCardEncryptor, {
  describeEncryptError,
} from '../../components/PagBankCardEncryptor';
import {COLORS, formatMoney, usePartner} from '../PartnerContext';
import {PUSH_STATUS} from './PushCampaignsScreen';
import {Badge, Button, Card, Field, styles as ui} from '../ui';

const TAX_KEY = 'partner_tax_id_v1';
const onlyDigits = v => String(v || '').replace(/\D/g, '');

export function formatTaxId(v) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function PushPaymentScreen({route, navigation}) {
  const {api} = usePartner();
  const campaignId = route?.params?.campaignId;
  const encryptorRef = useRef(null);
  const [campaign, setCampaign] = useState(null);
  const [payment, setPayment] = useState(null);
  const [method, setMethod] = useState('PIX');
  const [taxId, setTaxId] = useState('');
  const [card, setCard] = useState({
    number: '',
    holderName: '',
    expMonth: '',
    expYear: '',
    securityCode: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const refresh = useCallback(async () => {
    try {
      const r = await api('GET', `/partner/push-campaigns/${campaignId}`);
      setCampaign(r.campaign);
      setPayment(r.payment);
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [api, campaignId]);

  useEffect(() => {
    refresh();
    AsyncStorage.getItem(TAX_KEY)
      .then(v => v && setTaxId(formatTaxId(v)))
      .catch(() => {});
  }, [refresh]);

  // Polling enquanto o PIX não é pago
  const waiting =
    campaign?.status === 'AWAITING_PAYMENT' && payment?.status === 'PENDING';
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [waiting, refresh]);

  const pay = async () => {
    setError('');
    setInfo('');
    const tax = onlyDigits(taxId);
    if (tax.length !== 11 && tax.length !== 14) {
      setError('Informe o CPF ou CNPJ de quem paga.');
      return;
    }
    setBusy(true);
    try {
      const body = {method, taxId: tax};
      if (method === 'CREDIT_CARD') {
        const key = await api('GET', '/partner/card-public-key');
        let encrypted;
        try {
          encrypted = await encryptorRef.current.encrypt({
            publicKey: key.publicKey,
            holder: card.holderName.trim(),
            number: onlyDigits(card.number),
            expMonth: onlyDigits(card.expMonth).padStart(2, '0'),
            expYear:
              onlyDigits(card.expYear).length === 2
                ? `20${onlyDigits(card.expYear)}`
                : onlyDigits(card.expYear),
            securityCode: onlyDigits(card.securityCode),
          });
        } catch (encErr) {
          setError(describeEncryptError(encErr));
          return;
        }
        body.card = {encrypted, holderName: card.holderName.trim()};
        setCard(c => ({...c, securityCode: ''}));
      }
      const r = await api(
        'POST',
        `/partner/push-campaigns/${campaignId}/checkout`,
        body,
      );
      AsyncStorage.setItem(TAX_KEY, tax).catch(() => {});
      setCampaign(r.campaign);
      setPayment(r.payment);
      if (r.message) setInfo(r.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () =>
    Alert.alert(
      'Cancelar notificação?',
      'Ela ainda não foi paga, nada será cobrado.',
      [
        {text: 'Voltar', style: 'cancel'},
        {
          text: 'Cancelar notificação',
          style: 'destructive',
          onPress: async () => {
            try {
              await api('POST', `/partner/push-campaigns/${campaignId}/cancel`);
              navigation.goBack();
            } catch (e) {
              setError(e.message);
            }
          },
        },
      ],
    );

  if (!campaign) {
    return (
      <View style={[ui.screen, ui.content]}>
        <Text style={ui.muted}>{error || 'Carregando…'}</Text>
      </View>
    );
  }

  const st = PUSH_STATUS[campaign.status] || {
    text: campaign.status,
    tone: 'muted',
  };
  const paid = campaign.status !== 'AWAITING_PAYMENT';
  const methodBtn = (key, label) => (
    <Pressable
      key={key}
      onPress={() => setMethod(key)}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
        borderColor: method === key ? COLORS.primary : COLORS.border,
        backgroundColor: method === key ? COLORS.primarySoft : '#FFFFFF',
      }}>
      <Text
        style={{
          fontWeight: '700',
          color: method === key ? COLORS.primaryDark : COLORS.muted,
        }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled">
      <PagBankCardEncryptor ref={encryptorRef} />
      <Card>
        <View style={[ui.row, {justifyContent: 'space-between'}]}>
          <Text
            style={{fontSize: 22, fontWeight: '900', color: COLORS.primary}}>
            {formatMoney(campaign.price)}
          </Text>
          <Badge text={st.text} tone={st.tone} />
        </View>
        <Text style={{fontWeight: '700', color: COLORS.text, marginTop: 8}}>
          {campaign.title}
        </Text>
        <Text style={ui.muted}>{campaign.body}</Text>
      </Card>

      {paid ? (
        <Card style={{backgroundColor: COLORS.okSoft, borderColor: '#86EFAC'}}>
          <Text style={{color: COLORS.ok, fontWeight: '800', fontSize: 16}}>
            Pagamento confirmado ✅
          </Text>
          <Text style={{color: COLORS.ok, marginTop: 4}}>
            A Liga do Bem vai revisar e enviar sua notificação. Você recebe um
            aviso aqui no app.
          </Text>
          <Button
            title="Voltar"
            onPress={() => navigation.goBack()}
            style={{marginTop: 12}}
          />
        </Card>
      ) : payment?.status === 'PENDING' &&
        payment.method === 'PIX' &&
        payment.pixCopyPaste ? (
        <Card style={{alignItems: 'center'}}>
          <Text
            style={{fontWeight: '800', color: COLORS.text, marginBottom: 10}}>
            Pague com PIX
          </Text>
          <QRCode value={payment.pixCopyPaste} size={200} />
          <Button
            title="Copiar código PIX"
            variant="secondary"
            onPress={() => {
              Clipboard.setString(payment.pixCopyPaste);
              setInfo('Código copiado. Cole no app do seu banco.');
            }}
            style={{alignSelf: 'stretch', marginTop: 14}}
          />
          <Text style={[ui.muted, {textAlign: 'center', marginTop: 10}]}>
            A confirmação é automática. Pode deixar esta tela aberta.
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={ui.label}>Forma de pagamento</Text>
          <View style={{flexDirection: 'row', gap: 8, marginBottom: 12}}>
            {methodBtn('PIX', 'PIX')}
            {methodBtn('CREDIT_CARD', 'Cartão de crédito')}
          </View>
          <Field
            label="CPF ou CNPJ de quem paga"
            value={taxId}
            onChangeText={v => setTaxId(formatTaxId(v))}
            keyboardType="number-pad"
            maxLength={18}
            testID="taxid"
          />
          {method === 'CREDIT_CARD' ? (
            <>
              <Field
                label="Número do cartão"
                value={card.number}
                onChangeText={v => setCard(c => ({...c, number: v}))}
                keyboardType="number-pad"
                maxLength={23}
              />
              <Field
                label="Nome impresso no cartão"
                value={card.holderName}
                onChangeText={v =>
                  setCard(c => ({...c, holderName: v.toUpperCase()}))
                }
                autoCapitalize="characters"
              />
              <View style={{flexDirection: 'row', gap: 10}}>
                <Field
                  style={{flex: 1}}
                  label="Mês"
                  placeholder="MM"
                  value={card.expMonth}
                  onChangeText={v => setCard(c => ({...c, expMonth: v}))}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Field
                  style={{flex: 1}}
                  label="Ano"
                  placeholder="AAAA"
                  value={card.expYear}
                  onChangeText={v => setCard(c => ({...c, expYear: v}))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Field
                  style={{flex: 1}}
                  label="CVV"
                  value={card.securityCode}
                  onChangeText={v => setCard(c => ({...c, securityCode: v}))}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
              <Text style={[ui.muted, {fontSize: 12, marginBottom: 10}]}>
                Os dados do cartão são criptografados no celular pelo PagBank e
                não passam pela Liga.
              </Text>
            </>
          ) : null}
          {error ? (
            <Text style={[ui.error, {marginBottom: 10, fontSize: 14}]}>
              {error}
            </Text>
          ) : null}
          <Button
            title={
              method === 'PIX'
                ? 'Gerar PIX'
                : `Pagar ${formatMoney(campaign.price)}`
            }
            onPress={pay}
            loading={busy}
            testID="gerar-pagamento"
          />
          <Button
            title="Cancelar notificação"
            variant="ghost"
            onPress={cancel}
            style={{marginTop: 8}}
          />
        </Card>
      )}
      {info ? (
        <Text
          style={{
            color: COLORS.primaryDark,
            textAlign: 'center',
            marginTop: 4,
          }}>
          {info}
        </Text>
      ) : null}
      {error && (paid || payment?.method === 'PIX') ? (
        <Text style={[ui.error, {textAlign: 'center'}]}>{error}</Text>
      ) : null}
    </ScrollView>
  );
}
