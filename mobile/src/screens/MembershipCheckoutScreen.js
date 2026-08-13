import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Clipboard,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_PATH} from '../config/apiConfig';

const METHODS = [
  {id: 'PIX', label: 'PIX', icon: 'qr-code-outline', hint: 'Aprovação rápida'},
  {id: 'BOLETO', label: 'Boleto', icon: 'barcode-outline', hint: 'Compensa em 1–3 dias'},
  {id: 'CREDIT_CARD', label: 'Crédito', icon: 'card-outline', hint: 'Cartão de crédito'},
  {id: 'DEBIT_CARD', label: 'Débito', icon: 'card-outline', hint: 'Cartão de débito'},
];

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

export default function MembershipCheckoutScreen({navigation, route}) {
  const initialPlan = route?.params?.planCode || 'MONTHLY';
  const [plans, setPlans] = useState([]);
  const [planCode, setPlanCode] = useState(initialPlan);
  const [method, setMethod] = useState('PIX');
  const [cpf, setCpf] = useState(route?.params?.cpf || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState(null);
  const [card, setCard] = useState({
    number: '',
    expMonth: '',
    expYear: '',
    securityCode: '',
    holderName: '',
  });
  const pollRef = useRef(null);

  const selectedPlan = useMemo(
    () => plans.find(p => p.code === planCode) || null,
    [plans, planCode],
  );

  const loadPlans = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_PATH}/membership/plans`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? {Authorization: `Bearer ${token}`} : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      const list = data.plans || [];
      setPlans(list);
      if (!list.find(p => p.code === planCode) && list[0]) {
        setPlanCode(list[0].code);
      }
      if (!data.paymentsEnabled) {
        Alert.alert(
          'Pagamentos',
          'O PagBank ainda não está configurado no servidor. Peça para adicionar PAGBANK_TOKEN na Vercel.',
        );
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar os planos');
    } finally {
      setLoading(false);
    }
  }, [planCode]);

  useEffect(() => {
    loadPlans();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadPlans]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = paymentId => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const response = await fetch(
          `${API_BASE_PATH}/membership/payments/${paymentId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const data = await response.json().catch(() => ({}));
        if (data?.payment) {
          setPayment(prev => ({...prev, ...data.payment}));
          if (data.payment.status === 'APPROVED') {
            stopPolling();
            Alert.alert(
              'Assinatura ativa!',
              'Seu pagamento foi confirmado e o cartão de membro está ativo.',
              [{text: 'OK', onPress: () => navigation.goBack()}],
            );
          } else if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(data.payment.status)) {
            stopPolling();
          }
        }
      } catch {
        // ignore poll errors
      }
    }, 4000);
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    const taxId = onlyDigits(cpf);
    if (taxId.length !== 11) {
      Alert.alert('CPF', 'Informe um CPF válido para gerar o pagamento.');
      return;
    }

    if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
      if (
        onlyDigits(card.number).length < 13 ||
        !card.expMonth ||
        !card.expYear ||
        !card.securityCode ||
        !card.holderName
      ) {
        Alert.alert('Cartão', 'Preencha todos os dados do cartão.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const payload = {
        planCode,
        method,
        cpf: taxId,
      };
      if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
        payload.card = {
          number: onlyDigits(card.number),
          expMonth: onlyDigits(card.expMonth).padStart(2, '0'),
          expYear: onlyDigits(card.expYear).length === 2
            ? `20${onlyDigits(card.expYear)}`
            : onlyDigits(card.expYear),
          securityCode: onlyDigits(card.securityCode),
          holderName: card.holderName.trim(),
        };
      }

      const response = await fetch(`${API_BASE_PATH}/membership/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert('Pagamento', data.error || 'Não foi possível iniciar o pagamento');
        return;
      }

      setPayment(data.payment);
      if (data.payment?.status === 'APPROVED') {
        Alert.alert(
          'Assinatura ativa!',
          data.message || 'Pagamento aprovado.',
          [{text: 'OK', onPress: () => navigation.goBack()}],
        );
      } else if (data.payment?.id) {
        startPolling(data.payment.id);
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha de conexão ao iniciar o pagamento');
    } finally {
      setSubmitting(false);
    }
  };

  const copyPix = () => {
    if (!payment?.pixCopyPaste) return;
    Clipboard.setString(payment.pixCopyPaste);
    Alert.alert('Copiado', 'Código PIX copiado.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assinar / Renovar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Escolha o plano</Text>
        {plans.map(plan => {
          const active = plan.code === planCode;
          return (
            <TouchableOpacity
              key={plan.code}
              style={[styles.planCard, active && styles.planCardActive]}
              onPress={() => setPlanCode(plan.code)}
              activeOpacity={0.85}>
              <View style={{flex: 1}}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDesc}>
                  {plan.months} {plan.months === 1 ? 'mês' : 'meses'} · {plan.description}
                </Text>
              </View>
              <Text style={styles.planPrice}>{formatMoney(plan.amount)}</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionTitle, {marginTop: 18}]}>Forma de pagamento</Text>
        <View style={styles.methodsRow}>
          {METHODS.map(item => {
            const active = method === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.methodChip, active && styles.methodChipActive]}
                onPress={() => setMethod(item.id)}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? '#0284C7' : '#64748B'}
                />
                <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>
          {METHODS.find(m => m.id === method)?.hint}
        </Text>

        <Text style={[styles.sectionTitle, {marginTop: 18}]}>CPF do pagador</Text>
        <TextInput
          style={styles.input}
          placeholder="000.000.000-00"
          keyboardType="number-pad"
          value={cpf}
          onChangeText={setCpf}
          maxLength={14}
        />

        {(method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (
          <View style={styles.cardBox}>
            <Text style={styles.sectionTitle}>Dados do cartão</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome impresso no cartão"
              value={card.holderName}
              onChangeText={v => setCard(prev => ({...prev, holderName: v}))}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Número do cartão"
              keyboardType="number-pad"
              value={card.number}
              onChangeText={v => setCard(prev => ({...prev, number: v}))}
              maxLength={19}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.rowItem]}
                placeholder="Mês"
                keyboardType="number-pad"
                value={card.expMonth}
                onChangeText={v => setCard(prev => ({...prev, expMonth: v}))}
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.rowItem]}
                placeholder="Ano"
                keyboardType="number-pad"
                value={card.expYear}
                onChangeText={v => setCard(prev => ({...prev, expYear: v}))}
                maxLength={4}
              />
              <TextInput
                style={[styles.input, styles.rowItem]}
                placeholder="CVV"
                keyboardType="number-pad"
                value={card.securityCode}
                onChangeText={v => setCard(prev => ({...prev, securityCode: v}))}
                maxLength={4}
                secureTextEntry
              />
            </View>
            <Text style={styles.secureHint}>
              Pagamento processado pela API PagBank. Não armazenamos o cartão no app.
            </Text>
          </View>
        )}

        {!payment ? (
          <TouchableOpacity
            style={[styles.payButton, submitting && {opacity: 0.7}]}
            disabled={submitting}
            onPress={handleCheckout}>
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.payButtonText}>
                Pagar {selectedPlan ? formatMoney(selectedPlan.amount) : ''}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>
              {payment.status === 'APPROVED' ? 'Pagamento aprovado' : 'Aguardando pagamento'}
            </Text>
            <Text style={styles.resultSub}>
              Status: {payment.status} · {payment.method}
            </Text>

            {payment.method === 'PIX' && (
              <>
                {payment.pixQrImage ? (
                  <Image
                    source={{uri: payment.pixQrImage}}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : null}
                {payment.pixCopyPaste ? (
                  <TouchableOpacity style={styles.secondaryBtn} onPress={copyPix}>
                    <Ionicons name="copy-outline" size={18} color="#0284C7" />
                    <Text style={styles.secondaryBtnText}>Copiar código PIX</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}

            {payment.method === 'BOLETO' && (
              <>
                {payment.boletoBarcode ? (
                  <Text selectable style={styles.barcode}>
                    {payment.boletoBarcode}
                  </Text>
                ) : null}
                {payment.boletoUrl ? (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => Linking.openURL(payment.boletoUrl)}>
                    <Ionicons name="open-outline" size={18} color="#0284C7" />
                    <Text style={styles.secondaryBtnText}>Abrir boleto</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}

            <Text style={styles.pollHint}>
              Assim que o PagBank confirmar, sua assinatura fica ativa automaticamente.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F3F7FB'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {padding: 4},
  headerTitle: {fontSize: 18, fontWeight: '700', color: '#0F172A'},
  content: {padding: 16, paddingBottom: 40},
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  planCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planCardActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#F0F9FF',
  },
  planName: {fontSize: 16, fontWeight: '700', color: '#0F172A'},
  planDesc: {fontSize: 12, color: '#64748B', marginTop: 2},
  planPrice: {fontSize: 16, fontWeight: '800', color: '#0284C7'},
  methodsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  methodChipActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#E0F2FE',
  },
  methodLabel: {fontSize: 13, color: '#64748B', fontWeight: '600'},
  methodLabelActive: {color: '#0284C7'},
  hint: {marginTop: 8, fontSize: 12, color: '#64748B'},
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  cardBox: {marginTop: 4},
  row: {flexDirection: 'row', gap: 8},
  rowItem: {flex: 1},
  secureHint: {fontSize: 11, color: '#64748B', marginBottom: 8},
  payButton: {
    marginTop: 10,
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payButtonText: {color: '#FFF', fontSize: 16, fontWeight: '700'},
  resultBox: {
    marginTop: 12,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  resultTitle: {fontSize: 17, fontWeight: '700', color: '#0F172A'},
  resultSub: {marginTop: 4, color: '#64748B', marginBottom: 12},
  qrImage: {width: 220, height: 220, alignSelf: 'center', marginVertical: 8},
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  secondaryBtnText: {color: '#0284C7', fontWeight: '700'},
  barcode: {
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  pollHint: {marginTop: 12, fontSize: 12, color: '#64748B', lineHeight: 18},
});
