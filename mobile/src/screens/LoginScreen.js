import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import { API_BASE_PATH } from '../config/apiConfig';
import { APP_CONFIG } from '../config/appConfig';
import {logInfo, logError, logDebug} from '../services/RemoteLogger';

const API_BASE_URL = API_BASE_PATH;

export default function LoginScreen({navigation}) {
  const {login, continueAsGuest} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [loginConfig, setLoginConfig] = useState({
    logoUrl: null,
    appName: APP_CONFIG.appName,
    icon: '🐾',
    iconImage: null,
  });
  const [logoError, setLogoError] = useState(false);
  const [iconError, setIconError] = useState(false);

  // Carregar configurações do app da API
  const loadLoginConfig = async () => {
    try {
      logInfo('🔄 Carregando configurações de login', {url: `${API_BASE_URL}/api/app/config`});
      const response = await fetch(`${API_BASE_URL}/api/app/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Forçar buscar sempre da API
      });
      
      logDebug('📡 Resposta do servidor (login)', {status: response.status, statusText: response.statusText});
      
      if (response.ok) {
        const config = await response.json();
        logInfo('✅ Configurações de login recebidas', config);
        
        // Usar configurações de login se disponíveis, senão usar da página inicial
        const loginLogoUrl = config['login.logoUrl'] || config['app.logoUrl'];
        const loginIconImage = config['login.iconImage'];
        
        const newConfig = {
          logoUrl: (loginLogoUrl && loginLogoUrl.trim() !== '') ? loginLogoUrl : null,
          appName: config['login.appName'] || config['app.name'] || APP_CONFIG.appName,
          icon: config['login.icon'] || '🐾',
          iconImage: (loginIconImage && loginIconImage.trim() !== '') ? loginIconImage : null,
        };
        
        logInfo('📝 Configurações de login aplicadas', newConfig);
        logDebug('🖼️ Logo URL', {hasLogo: !!newConfig.logoUrl, logoUrl: newConfig.logoUrl});
        logDebug('🖼️ Ícone Imagem', {hasIconImage: !!newConfig.iconImage, iconImage: newConfig.iconImage});
        setLoginConfig(newConfig);
        // Resetar erros quando novas configurações são carregadas
        if (newConfig.logoUrl) {
          setLogoError(false);
        }
        if (newConfig.iconImage) {
          setIconError(false);
        }
      } else {
        const errorText = await response.text();
        logError('❌ Erro ao carregar configurações de login', {status: response.status, error: errorText});
      }
    } catch (error) {
      logError('❌ Erro ao carregar configurações do login', error);
    }
  };

  useEffect(() => {
    loadLoginConfig();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        Alert.alert('Erro', result.error || 'Email ou senha incorretos');
      }
      // Se success = true, o AuthProvider já atualiza o estado e o usuário será redirecionado automaticamente
    } catch (error) {
      console.error('Erro no login:', error);
      Alert.alert(
        'Erro',
        'Não foi possível fazer login. Verifique sua conexão e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = async () => {
    setGuestLoading(true);
    try {
      const result = await continueAsGuest();
      if (!result.success) {
        Alert.alert('Erro', 'Não foi possível continuar como visitante');
      }
      // Se success = true, o AuthProvider já atualiza o estado e o usuário será redirecionado automaticamente
    } catch (error) {
      console.error('Erro ao continuar como visitante:', error);
      Alert.alert('Erro', 'Não foi possível continuar como visitante');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            {loginConfig.logoUrl && !logoError ? (
              <Image
                source={{ uri: loginConfig.logoUrl }}
                style={styles.logoImage}
                resizeMode="contain"
                onError={(error) => {
                  logError('❌ Erro ao carregar logo da API', {error, url: loginConfig.logoUrl});
                  setLogoError(true);
                }}
                onLoad={() => {
                  logInfo('✅ Logo de login carregado com sucesso', {url: loginConfig.logoUrl});
                }}
              />
            ) : (
              <>
                <View style={styles.logoCircle}>
                  {loginConfig.iconImage && !iconError ? (
                    <Image
                      source={{ uri: loginConfig.iconImage }}
                      style={styles.iconImage}
                      resizeMode="contain"
                      onError={(error) => {
                        logError('❌ Erro ao carregar ícone da API', {error, url: loginConfig.iconImage});
                        setIconError(true);
                      }}
                      onLoad={() => {
                        logInfo('✅ Ícone de login carregado com sucesso', {url: loginConfig.iconImage});
                      }}
                    />
                  ) : (
                    <Text style={styles.logoIcon}>{loginConfig.icon}</Text>
                  )}
                </View>
                <Text style={styles.logoText}>{loginConfig.appName}</Text>
                <Text style={styles.logoSubtext}>{APP_CONFIG.appSubtitle}</Text>
              </>
            )}
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Bem-vindo de volta!</Text>
            <Text style={styles.subtitle}>
              Faça login para acessar sua conta
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Seu e-mail"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Sua senha"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Esqueceu sua senha?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}>
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.loginButtonGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Entrar</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.registerLink}>
              <Text style={styles.registerLinkText}>
                Não tem uma conta?{' '}
                <Text style={styles.registerLinkTextBold}>Cadastre-se</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Guest Access */}
          <TouchableOpacity
            onPress={handleGuestAccess}
            style={[
              styles.guestAccess,
              guestLoading && styles.guestAccessDisabled,
            ]}
            disabled={guestLoading}>
            {guestLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.guestAccessText}>
                  Continuar como visitante
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 40,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  logoSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  logoImage: {
    width: 200,
    height: 80,
    marginBottom: 16,
  },
  iconImage: {
    width: 40,
    height: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  registerLink: {
    alignItems: 'center',
  },
  registerLinkText: {
    color: '#6B7280',
    fontSize: 14,
  },
  registerLinkTextBold: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  guestAccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  guestAccessDisabled: {
    opacity: 0.6,
  },
  guestAccessText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
