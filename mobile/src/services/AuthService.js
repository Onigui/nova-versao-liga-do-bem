import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './NotificationService';
import { API_BASE_PATH } from '../config/apiConfig';

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Sistema de timeout inteligente para logout
    let backgroundTime = null;
    let timeoutId = null;
    let previousAppState = AppState.currentState;
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos de inatividade
    const TEMPORARY_STATE_THRESHOLD = 5000; // 5 segundos - mudanças menores que isso são temporárias (permissões, etc)

    // Atualizar timestamp de última atividade periodicamente enquanto o app está ativo
    const updateActiveTimestamp = setInterval(() => {
      if (AppState.currentState === 'active') {
        AsyncStorage.setItem('app_last_active', Date.now().toString()).catch(() => {});
      }
    }, 10000); // Atualizar a cada 10 segundos

    const handleAppStateChange = (nextAppState) => {
      console.log('📱 Mudança de estado do app:', { previous: previousAppState, next: nextAppState });
      
      // Ignorar mudanças de 'active' para 'inactive' que são temporárias (diálogos de permissão, etc)
      if (previousAppState === 'active' && nextAppState === 'inactive') {
        // Esta é provavelmente uma mudança temporária (diálogo de permissão, etc)
        // Não fazer logout imediatamente, apenas marcar o tempo
        const tempTime = Date.now();
        
        // Se voltar para 'active' rapidamente (menos de 5 segundos), não fazer logout
        const tempTimeout = setTimeout(() => {
          // Se ainda estiver inactive após 5 segundos, considerar como background real
          if (AppState.currentState === 'inactive') {
            backgroundTime = tempTime;
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
              console.log('⏰ Timeout de inatividade atingido, fazendo logout...');
              logout();
            }, INACTIVITY_TIMEOUT);
          }
        }, TEMPORARY_STATE_THRESHOLD);
        
        // Limpar timeout temporário se voltar para active rapidamente
        const checkActive = setInterval(() => {
          if (AppState.currentState === 'active') {
            clearTimeout(tempTimeout);
            clearInterval(checkActive);
          }
        }, 100);
        
        previousAppState = nextAppState;
        return;
      }
      
      if (nextAppState === 'background') {
        // App foi realmente para background (home button, etc)
        backgroundTime = Date.now();
        
        // Atualizar timestamp de última atividade
        AsyncStorage.setItem('app_last_active', Date.now().toString()).catch(() => {});
        
        // Limpar timeout anterior se existir
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Criar timeout para logout após inatividade
        timeoutId = setTimeout(() => {
          console.log('⏰ Timeout de inatividade atingido, fazendo logout...');
          logout();
        }, INACTIVITY_TIMEOUT);
      } else if (nextAppState === 'active') {
        // App voltou para foreground
        // Limpar timeout se ainda não passou muito tempo
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // Se passou muito tempo (mais que o timeout), fazer logout
        if (backgroundTime && (Date.now() - backgroundTime) >= INACTIVITY_TIMEOUT) {
          console.log('⏰ App voltou após muito tempo inativo, fazendo logout...');
          logout();
        }
        
        backgroundTime = null;
      }
      
      previousAppState = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    (async () => {
      await loadStoredAuth();
      if (cancelled) {
        return;
      }
      const appStartTime = Date.now();
      await AsyncStorage.setItem('app_last_active', appStartTime.toString()).catch(() => {});
    })();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      clearInterval(updateActiveTimestamp);
      subscription?.remove();
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      // Verificar se o app foi completamente fechado
      // Quando o app é completamente fechado, o timestamp 'app_last_active' não é atualizado
      // Se o timestamp for muito antigo (mais de 1 minuto), significa que o app foi completamente fechado
      const lastActiveTimestamp = await AsyncStorage.getItem('app_last_active');
      const now = Date.now();
      
      if (lastActiveTimestamp) {
        const timeSinceLastActive = now - parseInt(lastActiveTimestamp, 10);
        // Se passou mais de 1 minuto desde a última atividade, o app foi completamente fechado
        if (timeSinceLastActive > 60000) { // 1 minuto
          console.log('🔒 App foi completamente fechado (timestamp muito antigo), limpando sessão...', {
            timeSinceLastActive: Math.round(timeSinceLastActive / 1000) + ' segundos',
          });
          // Limpar sessão
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('user_data');
          await AsyncStorage.removeItem('app_last_active');
          setToken(null);
          setUser(null);
          setLoading(false);
          return;
        } else {
          console.log('✅ App não foi completamente fechado (timestamp recente)', {
            timeSinceLastActive: Math.round(timeSinceLastActive / 1000) + ' segundos',
          });
        }
      } else {
        // Se não há timestamp, é a primeira vez que o app é aberto ou foi completamente fechado
        // Verificar se há token armazenado
        const storedToken = await AsyncStorage.getItem('auth_token');
        if (storedToken) {
          // Há token mas não há timestamp = app foi completamente fechado
          console.log('🔒 App foi completamente fechado (sem timestamp), limpando sessão...');
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('user_data');
          setToken(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }
      
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        const userData = JSON.parse(storedUser);
        // Limpar CPF inválido (zeros) ao carregar do storage
        if (userData.cpf && (userData.cpf.trim() === '' || userData.cpf === '00000000000')) {
          userData.cpf = null;
        }
        setUser(userData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de autenticação:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      // Limpar cache antigo
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('user');
      
      console.log('🔐 TENTANDO LOGIN v1.1.8 (CACHE LIMPO):', { email, apiUrl: `${API_BASE_PATH}/auth/login` });
      
      const response = await fetch(`${API_BASE_PATH}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Resposta do servidor:', response.status, response.statusText);

      // Verificar se a resposta é JSON válida
      const contentType = response.headers.get('content-type');
      console.log('Content-Type da resposta:', contentType);

      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.log('Resposta não-JSON recebida:', textResponse);
        
        if (response.status === 404) {
          return { success: false, error: 'Endpoint de login não encontrado. Verifique se o backend está funcionando.' };
        } else {
          return { success: false, error: `Servidor retornou: ${textResponse}` };
        }
      }

      const data = await response.json();
      console.log('Dados recebidos:', data);

      if (response.ok) {
        const { token: authToken, user: userData } = data;
        
        // Limpar CPF inválido (zeros) antes de salvar
        if (userData.cpf && (userData.cpf.trim() === '' || userData.cpf === '00000000000')) {
          userData.cpf = null;
        }
        
        await AsyncStorage.setItem('auth_token', authToken);
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        
        setToken(authToken);
        setUser(userData);
        
        // Registrar para notificações push após login bem-sucedido
        try {
          await NotificationService.registerForPushNotifications(authToken);
        } catch (notifError) {
          console.log('Erro ao registrar notificações (não crítico):', notifError);
        }
        
        return { success: true };
      } else {
        console.error('Erro de login:', data);
        return { success: false, error: data.message || data.error || 'Email ou senha incorretos' };
      }
    } catch (error) {
      console.error('Erro de conexão no login:', error);
      return { success: false, error: `Erro de conexão: ${error.message || 'Verifique sua internet'}` };
    }
  };

  const register = async (userData) => {
    try {
      console.log('🔄 Tentando registrar usuário:', { email: userData.email, hasCpf: !!userData.cpf });
      
      const response = await fetch(`${API_BASE_PATH}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      console.log('📡 Resposta do registro:', { status: response.status, data });

      if (response.ok) {
        console.log('✅ Registro bem-sucedido');
        return { success: true, message: data.message || 'Conta criada com sucesso!' };
      } else {
        console.error('❌ Erro no registro:', data.error || data.message);
        return { success: false, error: data.error || data.message || 'Erro ao criar conta' };
      }
    } catch (error) {
      console.error('❌ Erro de conexão no registro:', error);
      return { success: false, error: `Erro de conexão: ${error.message || 'Verifique sua internet'}` };
    }
  };

  const loginWithGoogle = async () => {
    // Google OAuth será implementado futuramente com @react-native-google-signin/google-signin
    return { success: false, error: 'Login com Google em desenvolvimento' };
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user_data');
      await AsyncStorage.removeItem('guest_mode'); // Limpar caso exista de versões antigas
      await AsyncStorage.removeItem('app_last_active'); // Limpar timestamp
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const makeAuthenticatedRequest = async (url, options = {}) => {
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  };

  const updateUser = (userData) => {
    // Limpar CPF inválido (zeros) antes de atualizar
    if (userData && userData.cpf && (userData.cpf.trim() === '' || userData.cpf === '00000000000')) {
      userData.cpf = null;
    }
    setUser(userData);
    // Salvar também no AsyncStorage para persistência
    if (userData) {
      AsyncStorage.setItem('user_data', JSON.stringify(userData)).catch(err => {
        console.error('Erro ao salvar dados do usuário:', err);
      });
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    makeAuthenticatedRequest,
    updateUser,
    setUser, // Expor setUser também para compatibilidade
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
