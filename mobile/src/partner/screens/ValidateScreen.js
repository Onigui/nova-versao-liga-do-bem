import React, {useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, usePartner} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';

export default function ValidateScreen({navigation}) {
  const {partner, stats} = usePartner();
  const [typed, setTyped] = useState('');

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

      <Card>
        <Text style={{fontWeight: '700', color: COLORS.text, marginBottom: 8}}>
          Sem câmera ou QR não lê?
        </Text>
        <Field
          placeholder="Número da carteirinha (MEM...)"
          value={typed}
          onChangeText={t => setTyped(t.toUpperCase())}
          autoCapitalize="characters"
          hint="Confira o nome com um documento com foto."
          testID="numero"
        />
        <Button
          title="Consultar número"
          variant="secondary"
          disabled={typed.trim().length < 5}
          onPress={() => {
            navigation.navigate('ValidationResult', {code: typed.trim()});
            setTyped('');
          }}
          testID="consultar"
        />
      </Card>
      <View style={{height: 8}} />
    </ScrollView>
  );
}
