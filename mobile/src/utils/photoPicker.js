/**
 * Tirar foto / escolher da galeria com o react-native-image-picker.
 * No Android, o app declara a permissão CAMERA no manifesto; nesse caso o sistema só deixa
 * abrir a câmera depois que o usuário concede a permissão — por isso pedimos antes.
 */
import {Alert, Linking, PermissionsAndroid, Platform} from 'react-native';

function picker() {
  try {
    return require('react-native-image-picker');
  } catch {
    return null;
  }
}

export async function ensureCameraPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const perm = PermissionsAndroid.PERMISSIONS.CAMERA;
    if (await PermissionsAndroid.check(perm)) return true;
    const res = await PermissionsAndroid.request(perm, {
      title: 'Usar a câmera',
      message: 'A Liga do Bem precisa da câmera para tirar a foto.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Agora não',
    });
    if (res === PermissionsAndroid.RESULTS.GRANTED) return true;
    if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      Alert.alert('Câmera bloqueada', 'A permissão da câmera foi negada. Libere em Configurações > Apps > Liga do Bem > Permissões.', [
        {text: 'Agora não', style: 'cancel'},
        {text: 'Abrir configurações', onPress: () => Linking.openSettings().catch(() => {})},
      ]);
    }
    return false;
  } catch {
    return false;
  }
}

const ERRORS = {
  camera_unavailable: 'Câmera indisponível neste aparelho.',
  permission: 'Sem permissão para usar a câmera ou a galeria.',
};

/** kind: 'camera' | 'library'. Devolve a resposta do image-picker (ou null se não deu). */
export async function launchPicker(kind, options) {
  const m = picker();
  const launch = m && (kind === 'camera' ? m.launchCamera : m.launchImageLibrary);
  if (!launch) {
    Alert.alert('Foto', 'Não foi possível abrir a câmera/galeria neste aparelho.');
    return null;
  }
  if (kind === 'camera' && !(await ensureCameraPermission())) return null;
  const res = await launch({saveToPhotos: false, ...options});
  if (res?.errorCode) {
    Alert.alert('Foto', ERRORS[res.errorCode] || res.errorMessage || 'Não foi possível pegar a foto.');
    return null;
  }
  return res;
}

/** Igual ao require('react-native-image-picker').launchX, mas já pedindo a permissão. */
export const getPicker = kind => opts => launchPicker(kind, opts);
