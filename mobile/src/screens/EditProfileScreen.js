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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from '../components/ErrorBoundary';

// Função helper para validar se CPF é válido
const isValidCPF = (cpf) => {
  if (!cpf) return false;
  const cpfStr = String(cpf).trim();
  if (cpfStr === '' || cpfStr === '00000000000' || cpfStr === '000.000.000-00') return false;
  const numbers = cpfStr.replace(/\D/g, '');
  return numbers.length === 11 && numbers !== '00000000000';
};

// Componente interno protegido
function EditProfileScreenContent({navigation}) {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userData, setUserData] = useState(null);
  const mountedRef = useRef(true);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    avatar: null,
  });

  // Carregar perfil do usuário ao abrir a tela
  useEffect(() => {
    mountedRef.current = true;
    
    const loadUserProfile = async () => {
      try {
        if (!mountedRef.current) return;
        setLoadingProfile(true);
        
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) {
          // Tentar carregar do storage se não tiver token
            try {
              const storedUser = await AsyncStorage.getItem('user_data');
              if (storedUser && mountedRef.current) {
                const parsedUser = JSON.parse(storedUser);
                setUserData(parsedUser);
                // Sempre salvar o CPF, mesmo que não seja válido (para exibir)
                const cpfValue = parsedUser.cpf || '';
                setFormData({
                  name: parsedUser.name || '',
                  email: parsedUser.email || '',
                  phone: parsedUser.phone || '',
                  cpf: cpfValue,
                  avatar: parsedUser.avatar || null,
                });
              }
            } catch (storageError) {
              console.error('Erro ao carregar do AsyncStorage:', storageError);
            }
          if (mountedRef.current) setLoadingProfile(false);
          return;
        }
        
        // Buscar dados atualizados da API
        const response = await fetch(`${API_BASE_PATH}/user/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok && mountedRef.current) {
          const data = await response.json();
          console.log('📋 RESPOSTA COMPLETA DA API:', JSON.stringify(data, null, 2));
          console.log('📋 CPF na resposta:', data.cpf, 'Tipo:', typeof data.cpf);
          console.log('📋 Todos os campos:', Object.keys(data));
          
          setUserData(data);
          // Sempre salvar o CPF, mesmo que não seja válido (para exibir)
          const cpfValue = data.cpf || data.user?.cpf || '';
          console.log('📋 CPF que será salvo no formData:', cpfValue);
          
          setFormData({
            name: data.name || data.user?.name || '',
            email: data.email || data.user?.email || '',
            phone: data.phone || data.user?.phone || '',
            cpf: cpfValue,
            avatar: data.avatar || data.user?.avatar || null,
          });
          
          console.log('📋 FormData após setFormData:', {
            name: data.name || data.user?.name || '',
            email: data.email || data.user?.email || '',
            phone: data.phone || data.user?.phone || '',
            cpf: cpfValue,
          });
        } else {
          const errorText = await response.text();
          console.error('❌ Erro na resposta da API:', response.status, errorText);
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        Alert.alert('Erro', 'Não foi possível carregar os dados do perfil. Tente novamente.');
      } finally {
        if (mountedRef.current) {
          setLoadingProfile(false);
        }
      }
    };

    loadUserProfile();
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const handleImagePicker = () => {
    Alert.alert(
      'Em breve',
      'A funcionalidade de upload de foto estará disponível em breve.',
      [{text: 'OK'}],
    );
  };

  const handleSave = async () => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Erro', 'Você precisa estar logado para atualizar o perfil.');
        return;
      }

      const response = await fetch(`${API_BASE_PATH}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
        }),
      });

      const responseData = await response.json();

      if (response.ok && mountedRef.current) {
        // Atualizar dados locais
        const updatedUser = {...userData, ...responseData.user};
        setUserData(updatedUser);
        await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
        
        Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
          {text: 'OK', onPress: () => {
            if (navigation && navigation.goBack) {
              navigation.goBack();
            }
          }},
        ]);
      } else {
        Alert.alert('Erro', responseData.error || responseData.message || 'Erro ao atualizar perfil');
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      Alert.alert('Erro', `Não foi possível atualizar o perfil: ${error.message || 'Erro desconhecido'}`);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  if (!navigation) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF'}]}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={{marginTop: 16, color: '#EF4444', fontSize: 16, fontWeight: '600'}}>Erro: Navegação não disponível</Text>
      </View>
    );
  }

  if (loadingProfile) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF'}]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={{marginTop: 16, color: '#6B7280', fontSize: 16}}>Carregando perfil...</Text>
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
            style={styles.changeAvatarButton}
            onPress={handleImagePicker}>
            <Ionicons name="camera" size={20} color="#8B5CF6" />
            <Text style={styles.changeAvatarText}>Alterar Foto</Text>
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
                setFormData(prev => ({...prev, name: text}));
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
                setFormData(prev => ({...prev, phone: text}));
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
              value={formData?.cpf ? formatCPF(formData.cpf) : ''}
              editable={false}
              placeholder="000.000.000-00"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.helperText}>
              {formData?.cpf && isValidCPF(formData.cpf)
                ? 'CPF não pode ser alterado após o cadastro'
                : formData?.cpf
                ? `CPF cadastrado (formato pode estar incorreto): ${formData.cpf}`
                : 'CPF não cadastrado. Entre em contato com o suporte.'}
            </Text>
            {/* Debug: mostrar valor bruto do CPF em desenvolvimento */}
            {__DEV__ && (
              <Text style={{fontSize: 10, color: '#999', marginTop: 4}}>
                Debug: CPF raw = {JSON.stringify(formData?.cpf)}
              </Text>
            )}
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

// Componente principal com ErrorBoundary
export default function EditProfileScreen({navigation}) {
  return (
    <ErrorBoundary>
      <EditProfileScreenContent navigation={navigation} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  changeAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
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
    borderRadius: 8,
    padding: 12,
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
    opacity: 0.6,
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
