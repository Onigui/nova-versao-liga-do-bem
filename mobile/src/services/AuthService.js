import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './NotificationService';
import { API_BASE_PATH } from '../config/apiConfig';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      const storedGuestMode = await AsyncStorage.getItem('guest_mode');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else if (storedGuestMode === 'true') {
        setIsGuest(true);
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
      const response = await fetch(`${API_BASE_PATH}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: 'Conta criada com sucesso!' };
      } else {
        return { success: false, error: data.message || 'Erro ao criar conta' };
      }
    } catch (error) {
      console.error('Erro no registro:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  };

  const loginWithGoogle = async () => {
    // Google OAuth será implementado futuramente com @react-native-google-signin/google-signin
    return { success: false, error: 'Login com Google em desenvolvimento' };
  };

  const continueAsGuest = async () => {
    try {
      await AsyncStorage.setItem('guest_mode', 'true');
      setIsGuest(true);
      return { success: true };
    } catch (error) {
      console.error('Erro ao continuar como visitante:', error);
      return { success: false, error: 'Erro ao continuar como visitante' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user_data');
      await AsyncStorage.removeItem('guest_mode');
      setToken(null);
      setUser(null);
      setIsGuest(false);
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

  const value = {
    user,
    token,
    loading,
    isGuest,
    login,
    register,
    loginWithGoogle,
    logout,
    continueAsGuest,
    makeAuthenticatedRequest,
    isAuthenticated: (!!user && !!token) || isGuest,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
