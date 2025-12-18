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
import UpdateService from '../services/UpdateService';
import UpdateModal from '../components/UpdateModal';
import BiometricService from '../services/BiometricService';

const API_BASE_URL = API_BASE_PATH.replace('/api', ''); // Remover /api duplicado

export default function LoginScreen({navigation}) {
  const {login} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginConfig, setLoginConfig] = useState({
    logoUrl: null,
    appName: APP_CONFIG.appName,
    icon: '🐾',
    iconImage: null,
  });
  const [logoError, setLogoError] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [localAssets, setLocalAssets] = useState({
    logo: null,
    icon: null,
    iconEmoji: '🐾',
  });
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometryType, setBiometryType] = useState('Biometria');
  
  // Tentar carregar assets locais
  useEffect(() => {
    try {
      const localLogo = require('../assets/images/login-logo.png');
      setLocalAssets(prev => ({ ...prev, logo: localLogo }));
      logInfo('✅ Logo local de login encontrado');
    } catch (error) {
      logDebug('ℹ️ Logo local de login não encontrado');
    }
    
    try {
      const localIcon = require('../assets/images/app-icon.png');
      setLocalAssets(prev => ({ ...prev, icon: localIcon }));
      logInfo('✅ Ícone local encontrado');
    } catch (error) {
      logDebug('ℹ️ Ícone local não encontrado');
    }
    
    // Tentar carregar configuração do ícone emoji
    try {
      const iconConfig = require('../assets/images/icon-config.json');
      setLocalAssets(prev => ({ ...prev, iconEmoji: iconConfig.icon || '🐾' }));
      logInfo('✅ Configuração do ícone local encontrada');
    } catch (error) {
      logDebug('ℹ️ Configuração do ícone local não encontrada');
    }
  }, []);

  // Carregar configurações do app da API
  const loadLoginConfig = async () => {
    try {
      logInfo('🔄 Carregando configurações de login', {url: `${API_BASE_PATH}/app/config`});
      const response = await fetch(`${API_BASE_PATH}/app/config`, {
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
    checkBiometric();
    // Removido checkForUpdates() daqui - será feito após login
  }, []);

  // Verificar biometria novamente quando a tela ganha foco (após habilitar)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      checkBiometric();
    });
    return unsubscribe;
  }, [navigation]);

  const checkBiometric = async () => {
    try {
      const { available, biometryType: type } = await BiometricService.isAvailable();
      setBiometricAvailable(available);
      
      if (type === 'FaceID') {
        setBiometryType('Face ID');
      } else if (type === 'TouchID') {
        setBiometryType('Touch ID');
      } else if (type === 'Biometrics') {
        setBiometryType(Platform.OS === 'ios' ? 'Face ID' : 'Impressão Digital');
      }

      const enabled = await BiometricService.isEnabled();
      setBiometricEnabled(enabled);
    } catch (error) {
      console.error('Erro ao verificar biometria:', error);
      setBiometricAvailable(false);
    }
  };

  const checkForUpdates = async () => {
    try {
      console.log('🔍 Verificando atualizações...');
      const info = await UpdateService.checkForUpdates();
      console.log('📱 Resultado da verificação:', info);
      
      if (info && info.hasUpdate) {
        console.log('✅ Atualização disponível, mostrando modal...');
        setUpdateInfo(info);
        // Usar setTimeout para garantir que o modal aparece após navegação
        setTimeout(() => {
          setShowUpdateModal(true);
        }, 1000);
      } else {
        console.log('ℹ️ Nenhuma atualização disponível');
      }
    } catch (error) {
      console.error('❌ Erro ao verificar atualizações:', error);
    }
  };

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
      } else {
        // Login bem-sucedido - o AuthProvider já atualiza o estado
        // Aguardar um pouco para garantir que o estado foi atualizado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Após login bem-sucedido, oferecer para habilitar biometria se disponível
        // IMPORTANTE: Fazer isso ANTES de verificar atualizações para não bloquear
        if (biometricAvailable && !biometricEnabled) {
          // Usar setTimeout para garantir que o Alert aparece após a navegação
          setTimeout(() => {
            Alert.alert(
              'Login Biométrico',
              `Deseja habilitar ${biometryType} para fazer login mais rápido?`,
              [
                {
                  text: 'Não',
                  style: 'cancel',
                  onPress: () => {
                    // Após recusar, verificar atualizações
                    checkForUpdates();
                  },
                },
                {
                  text: 'Sim',
                  onPress: async () => {
                    const biometricResult = await BiometricService.enableBiometric(email, password);
                    if (biometricResult.success) {
                      setBiometricEnabled(true);
                      // Após habilitar biometria, verificar atualizações
                      Alert.alert('Sucesso', `${biometryType} habilitado com sucesso!`, [
                        {
                          text: 'OK',
                          onPress: () => {
                            checkForUpdates();
                          },
                        },
                      ]);
                    } else {
                      Alert.alert('Erro', biometricResult.error || 'Não foi possível habilitar biometria');
                      // Mesmo com erro, verificar atualizações
                      checkForUpdates();
                    }
                  },
                },
              ],
            );
          }, 500);
        } else {
          // Se biometria já está habilitada ou não disponível, verificar atualizações diretamente
          console.log('✅ Login bem-sucedido, verificando atualizações...');
          await checkForUpdates();
        }
      }
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

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const result = await BiometricService.authenticate();
      if (result.success) {
        const loginResult = await login(result.email, result.password);
        if (!loginResult.success) {
          Alert.alert('Erro', loginResult.error || 'Erro ao fazer login');
        } else {
          // Login bem-sucedido - aguardar estado atualizar
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Após login bem-sucedido, verificar atualizações
          console.log('✅ Login biométrico bem-sucedido, verificando atualizações...');
          await checkForUpdates();
        }
      } else {
        Alert.alert('Erro', result.error || 'Autenticação biométrica falhou');
      }
    } catch (error) {
      console.error('Erro no login biométrico:', error);
      Alert.alert('Erro', 'Não foi possível fazer login biométrico');
    } finally {
      setLoading(false);
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
            {/* Ícone acima do logo (sempre mostra se configurado) */}
            {(localAssets.icon || loginConfig.iconImage || localAssets.iconEmoji || loginConfig.icon) && (
              <View style={styles.logoCircle}>
                {localAssets.icon ? (
                  <Image
                    source={localAssets.icon}
                    style={styles.iconImage}
                    resizeMode="contain"
                    onLoad={() => {
                      logInfo('✅ Ícone local de login carregado com sucesso');
                    }}
                  />
                ) : loginConfig.iconImage && !iconError ? (
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
                  <Text style={styles.logoIcon}>{localAssets.iconEmoji || loginConfig.icon}</Text>
                )}
              </View>
            )}
            
            {/* Logo ou texto do app */}
            {localAssets.logo ? (
              <Image
                source={localAssets.logo}
                style={styles.logoImage}
                resizeMode="contain"
                onLoad={() => {
                  logInfo('✅ Logo local de login carregado com sucesso');
                }}
              />
            ) : loginConfig.logoUrl && !logoError ? (
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
                {/* Se não tem logo, mostra texto do app (só se não tiver ícone) */}
                {(!localAssets.icon && !loginConfig.iconImage && !localAssets.iconEmoji && !loginConfig.icon) && (
                  <>
                    <Text style={styles.logoText}>{loginConfig.appName}</Text>
                    <Text style={styles.logoSubtext}>{APP_CONFIG.appSubtitle}</Text>
                  </>
                )}
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

            {/* Biometric Login Button (se habilitado) */}
            {biometricEnabled && biometricAvailable && (
              <>
                <TouchableOpacity
                  style={[
                    styles.biometricButton,
                    loading && styles.biometricButtonDisabled,
                  ]}
                  onPress={handleBiometricLogin}
                  disabled={loading}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.biometricButtonGradient}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}>
                    <Ionicons name="finger-print" size={24} color="#FFFFFF" />
                    <Text style={styles.biometricButtonText}>
                      Entrar com {biometryType}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

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

            {/* Divider (se biometria não estiver habilitada) */}
            {(!biometricEnabled || !biometricAvailable) && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

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
        </ScrollView>
      </KeyboardAvoidingView>
      <UpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onDismiss={() => setShowUpdateModal(false)}
        onUpdateComplete={() => {
          setShowUpdateModal(false);
        }}
      />
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
  biometricButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  biometricButtonDisabled: {
    opacity: 0.7,
  },
  biometricButtonGradient: {
    height: 54,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  biometricButtonText: {
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
});
