import React, { useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = 'https://liga-do-bem-backend.onrender.com/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
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
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setEmailSent(true);
      } else {
        Alert.alert('Erro', 'E-mail não encontrado em nossa base de dados');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar o e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Success Icon */}
          <View style={styles.successContainer}>
            <View style={styles.successCircle}>
              <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>E-mail Enviado!</Text>
            <Text style={styles.successText}>
              Enviamos um link de recuperação para {'\n'}
              <Text style={styles.successEmail}>{email}</Text>
            </Text>
            <Text style={styles.successSubtext}>
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </Text>

            {/* Back to Login Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Login')}
            >
              <LinearGradient
                colors={['#FFFFFF', '#FFFFFF']}
                style={styles.backButtonGradient}
              >
                <Text style={styles.backButtonText}>Voltar para Login</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend Link */}
            <TouchableOpacity
              onPress={() => setEmailSent(false)}
              style={styles.resendLink}
            >
              <Text style={styles.resendLinkText}>
                Não recebeu? <Text style={styles.resendLinkBold}>Reenviar e-mail</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#8B5CF6', '#EC4899']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerBackButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Recuperar Senha</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={40} color="#FFFFFF" />
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Esqueceu sua senha?</Text>
            <Text style={styles.subtitle}>
              Não se preocupe! Digite seu e-mail e enviaremos um link para você redefinir sua senha.
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.inputIcon} />
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

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.submitButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="mail" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Enviar Link de Recuperação</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Back to Login Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLink}
            >
              <Ionicons name="arrow-back" size={16} color="#8B5CF6" style={{ marginRight: 4 }} />
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
    shadowOffset: { width: 0, height: 10 },
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
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
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
  // Success Screen Styles
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
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  successEmail: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 16,
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
  resendLink: {
    alignItems: 'center',
  },
  resendLinkText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  resendLinkBold: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

