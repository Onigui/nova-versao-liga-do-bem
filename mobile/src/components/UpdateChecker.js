import React, {useState, useEffect} from 'react';
import {AppState} from 'react-native';
import {useAuth} from '../services/AuthService';
import UpdateService from '../services/UpdateService';
import UpdateModal from './UpdateModal';

/**
 * Verifica atualizações ao abrir o app (e ao voltar do background)
 * e mostra o modal para baixar/instalar o APK.
 */
export default function UpdateChecker() {
  const {isAuthenticated} = useAuth();
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Checa ao montar (logo na abertura), independente do login
    const timer = setTimeout(() => {
      if (!hasChecked) {
        checkForUpdates();
      }
    }, 1500);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Revalida quando o usuário volta ao app (sem spam: só se já checou e modal fechado)
        // Mantém silencioso se já mostrou nesta sessão
      }
    });

    return () => {
      clearTimeout(timer);
      sub?.remove?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Também verifica após login (caso a primeira checagem tenha falhado offline)
  useEffect(() => {
    if (isAuthenticated && !hasChecked) {
      checkForUpdates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const checkForUpdates = async () => {
    try {
      console.log('🔍 [UpdateChecker] Verificando atualizações...');
      const info = await UpdateService.checkForUpdates();

      if (info && info.hasUpdate && info.latestVersion) {
        console.log('✅ [UpdateChecker] Atualização disponível!', {
          latestVersion: info.latestVersion.version,
          latestVersionCode: info.latestVersion.versionCode,
          apkUrl: info.latestVersion.apkUrl,
        });
        setUpdateInfo(info);
        setTimeout(() => setShowUpdateModal(true), 800);
      } else {
        console.log('ℹ️ [UpdateChecker] App atualizado');
      }
      setHasChecked(true);
    } catch (error) {
      console.error('❌ [UpdateChecker] Erro:', error);
      setHasChecked(true);
    }
  };

  return (
    <UpdateModal
      visible={showUpdateModal}
      updateInfo={updateInfo}
      onDismiss={() => {
        if (updateInfo?.latestVersion?.isMandatory) {
          return;
        }
        setShowUpdateModal(false);
      }}
      onUpdateComplete={() => setShowUpdateModal(false)}
    />
  );
}
