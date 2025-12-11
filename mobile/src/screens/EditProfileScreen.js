import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
// Importação condicional do image picker
let launchImageLibrary = null;
let launchCamera = null;
try {
  const imagePicker = require('react-native-image-picker');
  launchImageLibrary = imagePicker.launchImageLibrary;
  launchCamera = imagePicker.launchCamera;
} catch (e) {
  console.warn('react-native-image-picker não instalado. Instale com: npm install react-native-image-picker');
}
import {useAuth} from '../services/AuthService';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {logInfo, logError, logDebug, logWarn, captureError} from '../services/RemoteLogger';

// Função helper para validar se CPF é válido
const isValidCPF = (cpf) => {
  if (!cpf) return false;
  const cpfStr = String(cpf).trim();
  if (cpfStr === '' || cpfStr === '00000000000' || cpfStr === '000.000.000-00') return false;
  const numbers = cpfStr.replace(/\D/g, '');
  return numbers.length === 11 && numbers !== '00000000000';
};

export default function EditProfileScreen({navigation}) {
  let authContext;
  try {
    authContext = useAuth();
  } catch (error) {
    console.error('❌ EditProfileScreen: Erro ao chamar useAuth', error);
    authContext = {};
  }
  
  // Log após hooks serem processados
  useEffect(() => {
    try {
      if (logDebug) {
        logDebug('🔵 EditProfileScreen: Componente montado', {
          hasNavigation: !!navigation,
          hasAuthContext: !!authContext,
          hasUser: !!authContext?.user,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      // Ignorar erros de log
    }
  }, []);

  const user = authContext?.user || null;
  const setUser = authContext?.setUser || null;
  const updateUser = authContext?.updateUser || null;
  
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    avatar: null,
  });

  // Log de inicialização movido para useEffect para evitar problemas
  useEffect(() => {
    try {
      if (logDebug) {
        logDebug('🔵 EditProfileScreen: Estados inicializados', {
          loading,
          loadingProfile,
          uploadingAvatar,
        });
      }
    } catch (e) {
      // Ignorar erros de log
    }
  }, []);

  // Carregar perfil do usuário ao abrir a tela
  useEffect(() => {
    logDebug('🔵 EditProfileScreen: useEffect de carregamento executado', {
      hasNavigation: !!navigation,
    });
    if (navigation) {
      loadUserProfile();
    } else {
      logError('❌ EditProfileScreen: navigation não disponível no useEffect');
    }
  }, []);

  // Atualizar formData quando user mudar
  useEffect(() => {
    logDebug('🔵 EditProfileScreen: useEffect de user executado', {
      hasUser: !!user,
      userId: user?.id,
    });
    if (user) {
      try {
        logDebug('🔵 EditProfileScreen: Processando dados do usuário', {
          hasName: !!user.name,
          hasEmail: !!user.email,
          hasPhone: !!user.phone,
          hasCpf: !!user.cpf,
        });
        const cpfValue = isValidCPF(user.cpf) ? user.cpf : '';
        setFormData({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          cpf: cpfValue,
          avatar: user.avatar || null,
        });
        logInfo('📝 EditProfileScreen: FormData atualizado', { 
          name: user.name, 
          email: user.email, 
          hasCpf: !!cpfValue,
          cpfValue: cpfValue ? '***' : 'vazio'
        });
      } catch (error) {
        logError('❌ EditProfileScreen: Erro ao atualizar formData', error);
        captureError(error, {
          context: 'useEffect user',
          userData: {id: user?.id, email: user?.email},
        });
      }
    } else {
      logDebug('🔵 EditProfileScreen: user é null/undefined, não atualizando formData');
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      logDebug('🔵 EditProfileScreen: loadUserProfile iniciado');
      setLoadingProfile(true);
      
      logDebug('🔵 EditProfileScreen: Buscando token do AsyncStorage');
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        logWarn('⚠️ EditProfileScreen: Token não encontrado, usando dados do contexto');
        setLoadingProfile(false);
        return;
      }

      logInfo('🔄 EditProfileScreen: Carregando perfil do usuário...', {
        apiUrl: `${API_BASE_PATH}/user/profile`,
        hasToken: !!token,
      });
      
      const response = await fetch(`${API_BASE_PATH}/user/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      logDebug('🔵 EditProfileScreen: Resposta recebida', {
        status: response.status,
        ok: response.ok,
      });

      if (response.ok) {
        const userData = await response.json();
        logDebug('🔵 EditProfileScreen: Dados do usuário recebidos', {
          hasUserData: !!userData,
          hasName: !!userData?.name,
          hasEmail: !!userData?.email,
        });
        
        if (userData) {
          logInfo('✅ EditProfileScreen: Perfil carregado', { 
            name: userData.name, 
            email: userData.email,
            cpf: userData.cpf ? 'existe' : 'null/vazio',
            cpfValue: userData.cpf || 'null'
          });
          
          // Atualizar usuário no contexto
          logDebug('🔵 EditProfileScreen: Tentando atualizar usuário no contexto', {
            hasUpdateUser: !!updateUser,
            hasSetUser: !!setUser,
          });
          
          if (updateUser) {
            try {
              updateUser(userData);
              logInfo('✅ EditProfileScreen: Usuário atualizado via updateUser');
            } catch (error) {
              logError('❌ EditProfileScreen: Erro ao chamar updateUser', error);
              captureError(error, {context: 'updateUser', userData: {id: userData?.id}});
            }
          } else if (setUser) {
            try {
              setUser(userData);
              await AsyncStorage.setItem('user_data', JSON.stringify(userData));
              logInfo('✅ EditProfileScreen: Usuário atualizado via setUser');
            } catch (error) {
              logError('❌ EditProfileScreen: Erro ao chamar setUser', error);
              captureError(error, {context: 'setUser', userData: {id: userData?.id}});
            }
          } else {
            logWarn('⚠️ EditProfileScreen: Nem updateUser nem setUser disponíveis');
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        logError('❌ EditProfileScreen: Erro ao carregar perfil', {
          status: response.status,
          errorData,
        });
      }
    } catch (error) {
      logError('❌ EditProfileScreen: Erro ao carregar perfil', error);
      captureError(error, {
        context: 'loadUserProfile',
        function: 'loadUserProfile',
      });
    } finally {
      setLoadingProfile(false);
      logDebug('🔵 EditProfileScreen: loadUserProfile finalizado');
    }
  };

  const formatCPF = (value) => {
    if (!value) return '';
    try {
      const numbers = String(value).replace(/\D/g, '');
      if (numbers.length <= 11) {
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }
      return value;
    } catch (error) {
      console.error('Erro ao formatar CPF:', error);
      return String(value || '');
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permissão de Câmera',
            message: 'O app precisa de acesso à câmera para tirar fotos',
            buttonNeutral: 'Perguntar depois',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Em breve',
      'A funcionalidade de upload de foto estará disponível em breve. Por enquanto, entre em contato com o suporte para atualizar sua foto de perfil.',
      [{text: 'OK'}],
    );
  };

  // Função comentada até instalar react-native-image-picker e react-native-fs
  /*
  const handleImageResponse = async (response: any) => {
    if (response.didCancel || response.errorCode) {
      if (response.errorCode) {
        Alert.alert('Erro', 'Erro ao selecionar imagem');
      }
      return;
    }

    const asset = response.assets?.[0];
    if (!asset?.uri) {
      return;
    }

    setUploadingAvatar(true);
    try {
      // Converter imagem para base64 usando fetch (React Native)
      // No React Native, podemos ler o arquivo diretamente
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      
      // Converter blob para base64 usando uma abordagem compatível com React Native
      const base64 = await new Promise((resolve, reject) => {
        try {
          // Usar FileReader se disponível (algumas versões do RN têm polyfill)
          if (typeof FileReader !== 'undefined') {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result;
              // Remover o prefixo data:image/...;base64, se existir
              const base64Data = base64String && base64String.includes(',') 
                ? base64String.split(',')[1] 
                : base64String;
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          } else {
            // Fallback: usar uma abordagem alternativa
            // Para React Native puro, podemos usar react-native-fs ou outra biblioteca
            // Por enquanto, vamos tentar ler como texto e converter
            reject(new Error('FileReader não disponível. Instale react-native-fs para upload de imagens.'));
          }
        } catch (error) {
          reject(error);
        }
      });

      // Enviar para o backend
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Erro', 'Você precisa estar logado');
        return;
      }

      const uploadResponse = await fetch(`${API_BASE_PATH}/user/avatar/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64: base64,
        }),
      });

      const uploadData = await uploadResponse.json();

      if (uploadResponse.ok && uploadData.avatarUrl) {
        // Atualizar formData e user
        setFormData({...formData, avatar: uploadData.avatarUrl});
        if (updateUser) {
          updateUser({...user, avatar: uploadData.avatarUrl});
        }
        Alert.alert('Sucesso', 'Foto atualizada com sucesso!');
      } else {
        Alert.alert('Erro', uploadData.error || 'Erro ao fazer upload da foto');
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      Alert.alert('Erro', 'Não foi possível fazer upload da foto');
    } finally {
      setUploadingAvatar(false);
    }
  };
  */

  const handleSave = async () => {
    try {
      if (!formData || !formData.name || !formData.name.trim()) {
        Alert.alert('Erro', 'O nome é obrigatório');
        return;
      }

      if (!navigation) {
        Alert.alert('Erro', 'Navegação não disponível');
        return;
      }

      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Erro', 'Você precisa estar logado para atualizar o perfil');
        if (navigation && navigation.goBack) {
          navigation.goBack();
        }
        return;
      }

      console.log('🔄 Enviando atualização de perfil...', {
        name: formData.name.trim(),
        phone: formData.phone ? formData.phone.trim() : null,
      });

      const response = await fetch(`${API_BASE_PATH}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone ? formData.phone.trim() : null,
          // CPF não é enviado - não pode ser alterado após cadastro
          avatar: formData.avatar || null,
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        // Atualizar usuário no contexto
        const userData = responseData.user || responseData;
        if (updateUser && userData) {
          updateUser(userData);
        } else if (setUser && userData) {
          setUser(userData);
          await AsyncStorage.setItem('user_data', JSON.stringify(userData));
        } else {
          console.warn('⚠️ Nem updateUser nem setUser estão disponíveis, mas perfil foi atualizado no servidor');
        }
        
        Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
          {text: 'OK', onPress: () => {
            if (navigation && navigation.goBack) {
              navigation.goBack();
            }
          }},
        ]);
      } else {
        console.error('❌ Erro ao atualizar perfil:', response.status, responseData);
        Alert.alert('Erro', responseData.error || responseData.message || 'Erro ao atualizar perfil');
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error);
      Alert.alert('Erro', `Não foi possível atualizar o perfil: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={{marginTop: 16, color: '#6B7280'}}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!navigation) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <Text style={{color: '#EF4444'}}>Erro: Navegação não disponível</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation && navigation.goBack) {
              navigation.goBack();
            }
          }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {formData && formData.avatar ? (
              <Image source={{uri: formData.avatar}} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={50} color="#8B5CF6" />
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.changeAvatarButton, uploadingAvatar && styles.changeAvatarButtonDisabled]}
            onPress={handleImagePicker}
            disabled={uploadingAvatar}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <>
                <Ionicons name="camera" size={20} color="#8B5CF6" />
                <Text style={styles.changeAvatarText}>Alterar Foto</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              value={formData?.name || ''}
              onChangeText={(text) => {
                if (formData) {
                  setFormData({...formData, name: text});
                }
              }}
              placeholder="Seu nome completo"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData?.email || ''}
              editable={false}
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.helperText}>O e-mail não pode ser alterado</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={formData?.phone || ''}
              onChangeText={(text) => {
                if (formData) {
                  setFormData({...formData, phone: text});
                }
              }}
              placeholder="(00) 00000-0000"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CPF</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData && formData.cpf && isValidCPF(formData.cpf) ? formatCPF(formData.cpf) : ''}
              editable={false}
              placeholder="000.000.000-00"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.helperText}>
              {formData && formData.cpf && isValidCPF(formData.cpf)
                ? 'CPF não pode ser alterado após o cadastro para prevenir fraudes'
                : 'CPF não cadastrado. Entre em contato com o suporte para adicionar seu CPF.'}
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.saveButtonGradient}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Salvar Alterações</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeAvatarText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  changeAvatarButtonDisabled: {
    opacity: 0.6,
  },
  formSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

