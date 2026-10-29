import React from 'react';
import {Alert, Image, ScrollView, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DeviceInfo from 'react-native-device-info';
import {COLORS, usePartner} from '../PartnerContext';
import {Badge, Button, Card, styles as ui} from '../ui';
import {resetTours} from '../../components/Tour';

function Line({icon, text}) {
  if (!text) return null;
  return (
    <View style={[ui.row, {gap: 10, marginTop: 8}]}>
      <Icon name={icon} size={18} color={COLORS.muted} />
      <Text style={{color: COLORS.text, fontSize: 15, flex: 1}}>{text}</Text>
    </View>
  );
}

export default function CompanyScreen({navigation}) {
  const {partner: p, isOwner, logout} = usePartner();
  let version = '';
  try {
    version = DeviceInfo.getVersion();
  } catch {
    version = '';
  }

  const confirmLogout = () =>
    Alert.alert('Sair da conta?', '', [
      {text: 'Cancelar', style: 'cancel'},
      {text: 'Sair', style: 'destructive', onPress: () => logout()},
    ]);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Card>
        <View style={[ui.row, {gap: 12}]}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
              backgroundColor: '#F5F3FF',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: COLORS.border,
            }}>
            {p?.logo ? (
              <Image source={{uri: p.logo}} style={{width: '100%', height: '100%'}} />
            ) : (
              <Text style={{fontSize: 24, fontWeight: '900', color: '#7C3AED'}}>
                {(p?.name || '?').trim().charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{flex: 1}}>
            <Text style={[ui.title, {fontSize: 20}]} numberOfLines={2}>
              {p?.name}
            </Text>
            {p?.category ? <Text style={ui.muted}>{p.category}</Text> : null}
          </View>
          <Badge
            text={isOwner ? 'Responsável' : 'Funcionário'}
            tone={isOwner ? 'ok' : 'muted'}
          />
        </View>
        {p?.description ? (
          <Text style={{color: COLORS.text, marginTop: 8}}>
            {p.description}
          </Text>
        ) : null}
        <Line
          icon="location-outline"
          text={[p?.address, p?.city && `${p.city}/${p.state}`, p?.zipCode]
            .filter(Boolean)
            .join(' · ')}
        />
        <Line icon="time-outline" text={p?.hours} />
        <Line icon="call-outline" text={p?.phone} />
        <Line icon="mail-outline" text={p?.email} />
        <Line icon="globe-outline" text={p?.website} />
        {isOwner ? (
          <Button
            title="Editar empresa e ver prévia"
            variant="secondary"
            onPress={() => navigation.navigate('CompanyEdit')}
            icon={<Icon name="create-outline" size={18} color={COLORS.primary} />}
            style={{marginTop: 16}}
            testID="editar-empresa"
          />
        ) : (
          <Text style={[ui.muted, {marginTop: 14, fontSize: 13}]}>
            Só o responsável pela empresa pode alterar estes dados.
          </Text>
        )}
      </Card>

      {isOwner ? (
        <Card>
          <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text}}>
            Funcionários
          </Text>
          <Text style={[ui.muted, {marginVertical: 6}]}>
            Dê acesso para quem atende no caixa validar as carteirinhas.
          </Text>
          <Button
            title="Gerenciar funcionários"
            variant="secondary"
            onPress={() => navigation.navigate('Staff')}
          />
        </Card>
      ) : null}

      <Card>
        <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text}}>
          Veterinário: carimbo de vacinas
        </Text>
        <Text style={[ui.muted, {marginVertical: 6}]}>
          Com o CRMV aprovado pela Liga, você registra vacinas direto na carteira digital do pet.
        </Text>
        <Button
          title="Meu CRMV"
          variant="secondary"
          onPress={() => navigation.navigate('VetProfile')}
          testID="meu-crmv"
        />
      </Card>

      <Card>
        <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text}}>
          Notificação para todos os membros
        </Text>
        <Text style={[ui.muted, {marginVertical: 6}]}>
          Divulgue suas promoções com um aviso no celular de todo mundo que tem
          o app Liga do Bem.
        </Text>
        <Button
          title="Notificar membros"
          variant="secondary"
          onPress={() => navigation.navigate('PushCampaigns')}
          testID="notificar-membros"
        />
      </Card>

      <Button
        title="Rever as dicas do app"
        variant="secondary"
        onPress={async () => {
          await resetTours();
          Alert.alert('Pronto!', 'As dicas vão aparecer de novo quando você abrir cada tela.');
        }}
        style={{marginTop: 4}}
        testID="rever-dicas"
      />
      <Button
        title="Sair da conta"
        variant="danger"
        onPress={confirmLogout}
        style={{marginTop: 4}}
      />
      <Text
        style={[ui.muted, {textAlign: 'center', marginTop: 16, fontSize: 12}]}>
        Liga do Bem Parceiros {version ? `v${version}` : ''}
      </Text>
    </ScrollView>
  );
}
