import React, {useState} from 'react';
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../config/apiConfig';

export default function ForgotPasswordScreen({navigation}) {
  const [step, setStep] = useState('email'); // email | code | success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [displayedCode, setDisplayedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Digite seu e-mail');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Atenção', 'Digite um e-mail válido');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/auth/forgot-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: email.trim().toLowerCase()}),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        Alert.alert('Erro', data.error || 'Não foi possível solicitar o código');
        return;
      }

      if (data.resetCode) {
        setDisplayedCode(data.resetCode);
        setCode(data.resetCode);
      } else {
        setDisplayedCode('');
        setCode('');
      }
      setStep('code');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || code.length < 4) {
      Alert.alert('Atenção', 'Digite o código de recuperação');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Atenção', 'A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Atenção', 'As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/auth/reset-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        Alert.alert('Erro', data.error || 'Não foi possível redefinir a senha');
        return;
      }

      setStep('success');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.successContainer}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Senha atualizada!</Text>
            <Text style={styles.successText}>
              Sua senha foi redefinida com sucesso. Faça login com a nova senha.
            </Text>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Login')}>
              <LinearGradient
                colors={['#FFFFFF', '#FFFFFF']}
                style={styles.backButtonGradient}>
                <Text style={styles.backButtonText}>Ir para Login</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (step === 'code') {
                  setStep('email');
                } else {
                  navigation.goBack();
                }
              }}
              style={styles.headerBackButton}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Recuperar Senha</Text>
            <View style={{width: 40}} />
          </View>

          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={step === 'code' ? 'lock-closed-outline' : 'key-outline'}
                size={40}
                color="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.card}>
            {step === 'email' ? (
              <>
                <Text style={styles.title}>Esqueceu sua senha?</Text>
                <Text style={styles.subtitle}>
                  Digite seu e-mail para receber um código de recuperação.
                </Text>

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

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                  onPress={handleRequestCode}
                  disabled={loading}>
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    style={styles.submitButtonGradient}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}>
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name="mail"
                          size={20}
                          color="#FFFFFF"
                          style={{marginRight: 8}}
                        />
                        <Text style={styles.submitButtonText}>
                          Enviar código
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.title}>Nova senha</Text>
                <Text style={styles.subtitle}>
                  Informe o código e escolha uma nova senha para{'\n'}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>

                {displayedCode ? (
                  <View style={styles.codeBanner}>
                    <Text style={styles.codeBannerLabel}>Seu código</Text>
                    <Text style={styles.codeBannerValue}>{displayedCode}</Text>
                    <Text style={styles.codeBannerHint}>
                      Válido por 30 minutos. Em breve este código será enviado
                      por e-mail.
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.subtitleSmall}>
                    Se o e-mail estiver cadastrado, use o código recebido.
                  </Text>
                )}

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="keypad-outline"
                    size={20}
                    color="#6B7280"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Código de 6 dígitos"
                    placeholderTextColor="#9CA3AF"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#6B7280"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Nova senha"
                    placeholderTextColor="#9CA3AF"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#6B7280"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirmar nova senha"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                  onPress={handleResetPassword}
                  disabled={loading}>
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    style={styles.submitButtonGradient}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}>
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        Redefinir senha
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLink}>
              <Ionicons
                name="arrow-back"
                size={16}
                color="#8B5CF6"
                style={{marginRight: 4}}
              />
              <Text style={styles.loginLinkText}>Voltar para login</Text>
            </TouchableOpacity>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  subtitleSmall: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  emailHighlight: {
    fontWeight: '700',
    color: '#8B5CF6',
  },
  codeBanner: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  codeBannerLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  codeBannerValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#8B5CF6',
    letterSpacing: 6,
    marginBottom: 8,
  },
  codeBannerHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
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
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonGradient: {
    height: 54,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginLinkText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCircle: {
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  backButtonGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
});
