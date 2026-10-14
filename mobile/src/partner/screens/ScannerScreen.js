import React, {useEffect, useRef, useState} from 'react';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import {useIsFocused} from '@react-navigation/native';
import {COLORS} from '../PartnerContext';
import {Button} from '../ui';

export default function ScannerScreen({navigation, route}) {
  const petMode = route?.params?.mode === 'pet';
  const device = useCameraDevice('back');
  const {hasPermission, requestPermission} = useCameraPermission();
  const [asked, setAsked] = useState(false);
  const [torch, setTorch] = useState(false);
  const handled = useRef(false);
  const focused = useIsFocused();

  useEffect(() => {
    if (!hasPermission && !asked) {
      setAsked(true);
      requestPermission();
    }
  }, [hasPermission, asked, requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      const value = codes?.find(c => c?.value)?.value;
      if (!value || handled.current) return;
      handled.current = true;
      // QR do pet (LDBP.…) vai para o carimbo; o da carteirinha, para a validação
      if (petMode || String(value).startsWith('LDBP.')) navigation.replace('PetVisit', {code: value});
      else navigation.replace('ValidationResult', {code: value});
    },
  });

  if (!hasPermission) {
    return (
      <View style={s.center}>
        <Icon name="camera-outline" size={56} color={COLORS.primary} />
        <Text style={s.msg}>
          {petMode
            ? 'Precisamos da câmera para ler o QR do pet.'
            : 'Precisamos da câmera para ler o QR da carteirinha.'}
        </Text>
        <Button
          title="Permitir câmera"
          onPress={requestPermission}
          style={{alignSelf: 'stretch'}}
        />
        <Button
          title="Abrir configurações"
          variant="ghost"
          onPress={() => Linking.openSettings()}
          style={{marginTop: 8}}
        />
      </View>
    );
  }
  if (!device) {
    return (
      <View style={s.center}>
        <Text style={s.msg}>
          Câmera não encontrada neste aparelho. Use a consulta pelo número.
        </Text>
        <Button
          title="Voltar"
          onPress={() => navigation.goBack()}
          style={{alignSelf: 'stretch'}}
        />
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: '#000'}}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={focused}
        codeScanner={codeScanner}
        torch={torch ? 'on' : 'off'}
      />
      <View style={s.overlay} pointerEvents="none">
        <View style={s.frame} />
        <Text style={s.overlayText}>
          {petMode ? 'Aponte para o QR do pet (no app do tutor)' : 'Aponte para o QR da carteirinha'}
        </Text>
      </View>
      <View style={s.bottom}>
        <Pressable
          style={s.round}
          onPress={() => setTorch(t => !t)}
          accessibilityLabel="Lanterna">
          <Icon
            name={torch ? 'flash' : 'flash-off'}
            size={26}
            color="#FFFFFF"
          />
        </Pressable>
        <Pressable
          style={s.round}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Fechar">
          <Icon name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.bg,
  },
  msg: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 250,
    height: 250,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#5EEAD4',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    textShadowColor: '#000',
    textShadowRadius: 6,
  },
  bottom: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  round: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
