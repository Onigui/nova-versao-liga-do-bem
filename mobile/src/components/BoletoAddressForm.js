/**
 * Endereço do pagador — exigido pelo PagBank para registrar boleto.
 * O CEP preenche rua/bairro/cidade/UF automaticamente (ViaCEP) e o endereço fica
 * salvo no aparelho para as próximas vezes.
 */
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'billing_address_v1';

export const EMPTY_ADDRESS = {
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  locality: '',
  city: '',
  regionCode: '',
};

const onlyDigits = v => String(v || '').replace(/\D/g, '');

export function formatCep(v) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Retorna a mensagem do primeiro problema ou null se o endereço estiver completo. */
export function validateAddress(a) {
  if (onlyDigits(a?.postalCode).length !== 8) {
    return 'Informe um CEP válido.';
  }
  if (!/^[A-Za-z]{2}$/.test(String(a?.regionCode || '').trim())) {
    return 'Informe o estado (UF).';
  }
  if (
    !a?.street?.trim() ||
    !a?.number?.trim() ||
    !a?.locality?.trim() ||
    !a?.city?.trim()
  ) {
    return 'Preencha rua, número, bairro e cidade.';
  }
  return null;
}

/** Converte a resposta do ViaCEP no formato do formulário (null se o CEP não existe). */
export function fromViaCep(data) {
  if (!data || data.erro) {
    return null;
  }
  return {
    street: data.logradouro || '',
    locality: data.bairro || '',
    city: data.localidade || '',
    regionCode: (data.uf || '').toUpperCase(),
  };
}

export async function loadSavedAddress() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? {...EMPTY_ADDRESS, ...JSON.parse(raw)} : null;
  } catch {
    return null;
  }
}

export async function saveAddress(address) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(address));
  } catch {
    // não crítico
  }
}

function Input({label, style, ...props}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#94A3B8"
        {...props}
      />
    </View>
  );
}

export default function BoletoAddressForm({value, onChange}) {
  const [lookingUp, setLookingUp] = useState(false);
  const [cepError, setCepError] = useState('');
  const set = patch => onChange({...value, ...patch});

  // Preenche com o endereço salvo na primeira vez
  useEffect(() => {
    let alive = true;
    if (!value?.postalCode) {
      loadSavedAddress().then(saved => {
        if (alive && saved) {
          onChange(saved);
        }
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCepChange = async text => {
    const cep = formatCep(text);
    set({postalCode: cep});
    setCepError('');
    if (onlyDigits(cep).length !== 8) {
      return;
    }
    setLookingUp(true);
    try {
      const res = await fetch(
        `https://viacep.com.br/ws/${onlyDigits(cep)}/json/`,
      );
      const found = fromViaCep(await res.json());
      if (found) {
        onChange({...value, postalCode: cep, ...found});
      } else {
        setCepError('CEP não encontrado. Preencha o endereço manualmente.');
      }
    } catch {
      setCepError('Não foi possível buscar o CEP. Preencha manualmente.');
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Endereço do pagador</Text>
      <Text style={styles.hint}>
        Exigido pelo banco para registrar o boleto.
      </Text>
      <View style={styles.row}>
        <Input
          label="CEP"
          style={styles.flex1}
          placeholder="00000-000"
          keyboardType="number-pad"
          value={value.postalCode}
          onChangeText={onCepChange}
          maxLength={9}
        />
        {lookingUp ? (
          <ActivityIndicator style={styles.spinner} color="#0284C7" />
        ) : null}
      </View>
      {cepError ? <Text style={styles.error}>{cepError}</Text> : null}
      <Input
        label="Rua"
        value={value.street}
        onChangeText={v => set({street: v})}
        placeholder="Rua / Avenida"
      />
      <View style={styles.row}>
        <Input
          label="Número"
          style={styles.flex1}
          value={value.number}
          onChangeText={v => set({number: v})}
          placeholder="123"
        />
        <Input
          label="Complemento"
          style={styles.flex2}
          value={value.complement}
          onChangeText={v => set({complement: v})}
          placeholder="Opcional"
        />
      </View>
      <Input
        label="Bairro"
        value={value.locality}
        onChangeText={v => set({locality: v})}
      />
      <View style={styles.row}>
        <Input
          label="Cidade"
          style={styles.flex2}
          value={value.city}
          onChangeText={v => set({city: v})}
        />
        <Input
          label="UF"
          style={styles.flex1}
          value={value.regionCode}
          onChangeText={v =>
            set({regionCode: v.replace(/[^A-Za-z]/g, '').toUpperCase()})
          }
          maxLength={2}
          autoCapitalize="characters"
          placeholder="SP"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {fontSize: 15, fontWeight: '700', color: '#0F172A'},
  hint: {fontSize: 12, color: '#64748B', marginBottom: 8},
  field: {marginTop: 8},
  label: {fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4},
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  row: {flexDirection: 'row', gap: 10, alignItems: 'flex-end'},
  flex1: {flex: 1},
  flex2: {flex: 2},
  spinner: {marginBottom: 12},
  error: {color: '#B91C1C', fontSize: 12, marginTop: 4},
});
