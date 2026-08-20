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
  {id: 'CREDIT_CARD', label: 'Crédito', icon: 'card-outline', hint: 'Cartão de crédito com parcelamento'},
  {id: 'DEBIT_CARD', label: 'Débito', icon: 'card-outline', hint: 'Cartão de débito à vista'},
];

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function Field({label, hint, children}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export default function MembershipCheckoutScreen({navigation, route}) {
  const initialPlan = route?.params?.planCode || 'MONTHLY';
  const [plans, setPlans] = useState([]);
  const [planCode, setPlanCode] = useState(initialPlan);
  const [method, setMethod] = useState('PIX');
  const [cpf, setCpf] = useState(route?.params?.cpf || '');
  const [installments, setInstallments] = useState(1);
  const [installmentNote, setInstallmentNote] = useState('');
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

  const installmentOptions = useMemo(() => {
    if (!selectedPlan?.installmentOptions?.length) return [];
    return selectedPlan.installmentOptions;
  }, [selectedPlan]);

  const selectedInstallment = useMemo(
    () =>
      installmentOptions.find(o => o.installments === installments) ||
      installmentOptions[0],
    [installmentOptions, installments],
  );

  const payLabel = useMemo(() => {
    if (!selectedPlan) return 'Pagar';
    if (method === 'CREDIT_CARD' && selectedInstallment) {
      if (selectedInstallment.installments === 1) {
        return `Pagar ${formatMoney(selectedInstallment.totalCents / 100)} à vista`;
      }
      return `Pagar ${selectedInstallment.installments}x de ${formatMoney(
        selectedInstallment.installmentCents / 100,
      )}`;
    }
    return `Pagar ${formatMoney(selectedPlan.amount)}`;
  }, [selectedPlan, method, selectedInstallment]);

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
      setInstallmentNote(data.installmentNote || '');
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

  useEffect(() => {
    setInstallments(1);
  }, [planCode, method]);

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
        installments: method === 'CREDIT_CARD' ? installments : 1,
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
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#0284C7" />
          <Text style={styles.infoBannerText}>
            Só a assinatura de um plano ativa o cartão de membro e o QR Code.
            Doações são apoio separado e não liberam a associação.
          </Text>
        </View>

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

        <Field
          label="CPF do pagador"
          hint="Necessário para emitir o pagamento no PagBank">
          <TextInput
            style={styles.input}
            placeholder="000.000.000-00"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            value={cpf}
            onChangeText={setCpf}
            maxLength={14}
          />
        </Field>

        {(method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (
          <View style={styles.cardBox}>
            <Text style={styles.sectionTitle}>Dados do cartão</Text>

            <Field label="Nome impresso no cartão">
              <TextInput
                style={styles.input}
                placeholder="Como aparece no cartão"
                placeholderTextColor="#94A3B8"
                value={card.holderName}
                onChangeText={v => setCard(prev => ({...prev, holderName: v}))}
                autoCapitalize="characters"
              />
            </Field>

            <Field label="Número do cartão" hint="Somente números, sem espaços">
              <TextInput
                style={styles.input}
                placeholder="ACCT-000003"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={card.number}
                onChangeText={v => setCard(prev => ({...prev, number: v}))}
                maxLength={19}
              />
            </Field>

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Field label="Mês" hint="MM">
                  <TextInput
                    style={styles.input}
                    placeholder="08"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    value={card.expMonth}
                    onChangeText={v => setCard(prev => ({...prev, expMonth: v}))}
                    maxLength={2}
                  />
                </Field>
              </View>
              <View style={styles.rowItem}>
                <Field label="Ano" hint="AAAA">
                  <TextInput
                    style={styles.input}
                    placeholder="2028"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    value={card.expYear}
                    onChangeText={v => setCard(prev => ({...prev, expYear: v}))}
                    maxLength={4}
                  />
                </Field>
              </View>
              <View style={styles.rowItem}>
                <Field label="CVV" hint="Código de segurança">
                  <TextInput
                    style={styles.input}
                    placeholder="123"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    value={card.securityCode}
                    onChangeText={v => setCard(prev => ({...prev, securityCode: v}))}
                    maxLength={4}
                    secureTextEntry
                  />
                </Field>
              </View>
            </View>

            {method === 'CREDIT_CARD' ? (
              <View style={styles.installmentsBox}>
                <Text style={styles.fieldLabel}>Parcelamento</Text>
                <Text style={styles.fieldHint}>
                  {installmentNote ||
                    'A partir de 2x há juros de 2,99% a.m. repassados ao pagador.'}
                </Text>
                {installmentOptions.map(option => {
                  const active = option.installments === installments;
                  return (
                    <TouchableOpacity
                      key={option.installments}
                      style={[
                        styles.installmentOption,
                        active && styles.installmentOptionActive,
                      ]}
                      onPress={() => setInstallments(option.installments)}>
                      <View style={styles.installmentRadio}>
                        {active ? <View style={styles.installmentRadioDot} /> : null}
                      </View>
                      <Text
                        style={[
                          styles.installmentText,
                          active && styles.installmentTextActive,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.secureHint}>
                Débito é cobrado à vista, sem parcelamento.
              </Text>
            )}

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
              <Text style={styles.payButtonText}>{payLabel}</Text>
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
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {flex: 1, color: '#0C4A6E', fontSize: 13, lineHeight: 18},
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  planCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planCardActive: {borderColor: '#0EA5E9', backgroundColor: '#F0F9FF'},
  planName: {fontSize: 16, fontWeight: '700', color: '#0F172A'},
  planDesc: {fontSize: 12, color: '#64748B', marginTop: 2},
  planPrice: {fontSize: 16, fontWeight: '800', color: '#0284C7'},
  methodsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  methodChipActive: {borderColor: '#0EA5E9', backgroundColor: '#E0F2FE'},
  methodLabel: {fontSize: 13, color: '#64748B', fontWeight: '600'},
  methodLabelActive: {color: '#0284C7'},
  hint: {marginTop: 8, marginBottom: 8, fontSize: 12, color: '#64748B'},
  fieldBlock: {marginBottom: 12},
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  fieldHint: {fontSize: 11, color: '#64748B', marginBottom: 6},
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  cardBox: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: {flexDirection: 'row', gap: 8},
  rowItem: {flex: 1},
  installmentsBox: {marginTop: 4, marginBottom: 8},
  installmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  installmentOptionActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#E0F2FE',
  },
  installmentRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  installmentRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  installmentText: {flex: 1, fontSize: 13, color: '#334155', lineHeight: 18},
  installmentTextActive: {color: '#0C4A6E', fontWeight: '600'},
  secureHint: {marginTop: 8, fontSize: 12, color: '#64748B', lineHeight: 18},
  payButton: {
    marginTop: 18,
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payButtonText: {color: '#FFF', fontSize: 16, fontWeight: '700'},
  resultBox: {
    marginTop: 18,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultTitle: {fontSize: 16, fontWeight: '700', color: '#0F172A'},
  resultSub: {marginTop: 4, color: '#64748B'},
  qrImage: {width: 180, height: 180, alignSelf: 'center', marginVertical: 12},
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
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
