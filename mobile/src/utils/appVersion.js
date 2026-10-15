/**
 * Versão do app instalado (a mesma do build: versionName e versionCode do Android).
 * Se o módulo nativo não estiver disponível (testes), usa a versão do app.json, que sobe a cada lançamento.
 */
export function appVersion() {
  try {
    const DeviceInfo = require('react-native-device-info').default || require('react-native-device-info');
    const v = DeviceInfo.getVersion();
    const b = DeviceInfo.getBuildNumber();
    if (v && v !== 'unknown') return {version: String(v), build: b && b !== 'unknown' ? String(b) : null};
  } catch {
    // sem módulo nativo
  }
  try {
    return {version: String(require('../../app.json').version), build: null};
  } catch {
    return {version: '', build: null};
  }
}

export function appVersionLabel() {
  const {version, build} = appVersion();
  if (!version) return '';
  return `Versão ${version}${build ? ` (build ${build})` : ''}`;
}
