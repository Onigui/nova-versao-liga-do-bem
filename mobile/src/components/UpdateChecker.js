import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthService';
import UpdateService from '../services/UpdateService';
import UpdateModal from './UpdateModal';

/**
 * Componente global que verifica atualizações após o login
 * e mostra o modal de atualização quando necessário
 */
export default function UpdateChecker() {
  const { isAuthenticated } = useAuth();
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Verificar atualizações apenas quando o usuário está autenticado
    // e ainda não verificou nesta sessão
    if (isAuthenticated && !hasChecked) {
      console.log('🔍 [UpdateChecker] Usuário autenticado, verificando atualizações...');
      console.log('🔍 [UpdateChecker] Estado:', { isAuthenticated, hasChecked });
      checkForUpdates();
    } else if (!isAuthenticated) {
      // Resetar quando o usuário faz logout
      console.log('🔍 [UpdateChecker] Usuário não autenticado, resetando...');
      setHasChecked(false);
      setUpdateInfo(null);
      setShowUpdateModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, hasChecked]);

  const checkForUpdates = async () => {
    try {
      console.log('🔍 [UpdateChecker] Verificando atualizações...');
      const info = await UpdateService.checkForUpdates();
      console.log('📱 [UpdateChecker] Resultado da verificação:', JSON.stringify(info, null, 2));
      
      if (info && info.hasUpdate && info.latestVersion) {
        console.log('✅ [UpdateChecker] Atualização disponível!', {
          currentVersion: info.currentVersion,
          currentVersionCode: info.currentVersionCode,
          latestVersion: info.latestVersion.version,
          latestVersionCode: info.latestVersion.versionCode,
          apkUrl: info.latestVersion.apkUrl,
        });
        
        setUpdateInfo(info);
        
        // Aguardar um pouco para garantir que a navegação foi concluída
        setTimeout(() => {
          console.log('📱 [UpdateChecker] Abrindo modal de atualização...');
          setShowUpdateModal(true);
        }, 2000);
      } else {
        console.log('ℹ️ [UpdateChecker] Nenhuma atualização disponível', {
          hasInfo: !!info,
          hasUpdate: info?.hasUpdate,
          hasLatestVersion: !!info?.latestVersion,
        });
      }
      
      setHasChecked(true);
    } catch (error) {
      console.error('❌ [UpdateChecker] Erro ao verificar atualizações:', error);
      console.error('❌ [UpdateChecker] Stack trace:', error.stack);
      setHasChecked(true); // Marcar como verificado mesmo em caso de erro
    }
  };

  return (
    <UpdateModal
      visible={showUpdateModal}
      updateInfo={updateInfo}
      onDismiss={() => {
        console.log('📱 [UpdateChecker] Modal de atualização fechado');
        setShowUpdateModal(false);
      }}
      onUpdateComplete={() => {
        console.log('✅ [UpdateChecker] Atualização concluída');
        setShowUpdateModal(false);
      }}
    />
  );
}

