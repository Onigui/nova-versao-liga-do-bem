import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import NotificationService from './NotificationService';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext({});

const API_BASE_URL = 'https://nova-versao-liga-do-bem-api.onrender.com/api';

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
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const { token: authToken, user: userData } = data;
        
        await AsyncStorage.setItem('auth_token', authToken);
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        
        setToken(authToken);
        setUser(userData);
        
        // Registrar para notificações push após login bem-sucedido
        NotificationService.registerForPushNotifications(authToken);
        
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Erro ao fazer login' };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
    try {
      const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=YOUR_GOOGLE_CLIENT_ID&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=openid%20profile%20email`;

      const result = await AuthSession.startAsync({ authUrl });
      
      if (result.type === 'success') {
        // Processar o código de autorização
        const response = await fetch(`${API_BASE_URL}/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: result.params.code }),
        });

        const data = await response.json();

        if (response.ok) {
          const { token: authToken, user: userData } = data;
          
          await AsyncStorage.setItem('auth_token', authToken);
          await AsyncStorage.setItem('user_data', JSON.stringify(userData));
          
          setToken(authToken);
          setUser(userData);
          
          return { success: true };
        }
      }
      
      return { success: false, error: 'Erro na autenticação Google' };
    } catch (error) {
      console.error('Erro no login Google:', error);
      return { success: false, error: 'Erro de conexão' };
    }
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
