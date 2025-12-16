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
import { logInfo, logError, logDebug } from '../services/RemoteLogger';

// Função helper para validar se CPF é válido
const isValidCPF = (cpf) => {
  if (!cpf) return false;
  const cpfStr = String(cpf).trim();
  if (cpfStr === '' || cpfStr === '00000000000' || cpfStr === '000.000.000-00') return false;
  const numbers = cpfStr.replace(/\D/g, '');
  return numbers.length === 11 && numbers !== '00000000000';
};

// Função para formatar CPF
const formatCPF = (value) => {
  if (!value || value === null || value === undefined || value === 'null' || value === 'undefined') {
    return '';
  }
  try {
    const valueStr = String(value).trim();
    if (valueStr === '' || valueStr === '0' || valueStr === '00000000000' || valueStr === '000.000.000-00') {
      return '';
    }
    const numbers = valueStr.replace(/\D/g, '');
    if (numbers.length === 11 && numbers !== '00000000000') {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return '';
  } catch (error) {
    console.error('Erro ao formatar CPF:', error);
    return '';
  }
};

// Componente interno protegido
function EditProfileScreenContent({navigation}) {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: null,
    avatar: null,
  });
  
  // Estado local para o valor do campo CPF (permite edição sem resetar)
  const [cpfInputValue, setCpfInputValue] = useState('');

  // Carregar perfil do usuário ao abrir a tela
  useEffect(() => {
    mountedRef.current = true;
    
    const loadUserProfile = async () => {
      try {
        if (!mountedRef.current) return;
        setLoadingProfile(true);
        setError(null);
        
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) {
          console.warn('⚠️ Token não encontrado, tentando carregar do storage');
          // Tentar carregar do storage se não tiver token
            try {
              const storedUser = await AsyncStorage.getItem('user_data');
              if (storedUser && mountedRef.current) {
                const parsedUser = JSON.parse(storedUser);
                // Processar CPF do storage também (limpar zeros)
                let storedCpf = parsedUser.cpf;
                // IMPORTANTE: Tratar explicitamente "0" como inválido também
                if (storedCpf === '0' || storedCpf === 0) {
                  storedCpf = null;
                  console.log('⚠️ CPF é "0" no storage (inválido), convertendo para null');
                } else if (storedCpf !== null && storedCpf !== undefined) {
                  const cpfStr = String(storedCpf).trim();
                  if (cpfStr === '' || cpfStr === '0' || cpfStr === '00000000000' || cpfStr === '000.000.000-00') {
                    storedCpf = null;
                    console.log('⚠️ CPF inválido no storage, limpando');
                  } else {
                    const cpfNumbers = cpfStr.replace(/\D/g, '');
                    if (cpfNumbers === '' || cpfNumbers === '0' || cpfNumbers === '00000000000' || cpfNumbers.length !== 11) {
                      storedCpf = null;
                      console.log('⚠️ CPF inválido no storage após limpeza');
                    } else {
                      storedCpf = cpfNumbers;
                    }
                  }
                } else {
                  // Garantir que seja null explicitamente (não undefined)
                  storedCpf = null;
                }
                setFormData({
                  name: parsedUser.name || '',
                  email: parsedUser.email || '',
                  phone: parsedUser.phone || '',
                  cpf: storedCpf, // CPF processado do storage
                  avatar: parsedUser.avatar || null,
                });
                // Atualizar também o estado local do campo CPF
                // IMPORTANTE: Não chamar formatCPF para valores parciais/inválidos
                if (storedCpf && storedCpf !== null && storedCpf !== undefined && 
                    storedCpf !== '0' && storedCpf !== '00000000000') {
                  const cpfStr = String(storedCpf).replace(/\D/g, '');
                  // Só formatar se tiver exatamente 11 dígitos válidos
                  if (cpfStr.length === 11 && cpfStr !== '00000000000') {
                    setCpfInputValue(formatCPF(cpfStr) || '');
                  } else {
                    setCpfInputValue('');
                  }
                } else {
                  setCpfInputValue('');
                }
                console.log('✅ Dados carregados do storage (com CPF processado):', { cpf: storedCpf });
              }
            } catch (storageError) {
              console.error('Erro ao carregar do AsyncStorage:', storageError);
            }
          if (mountedRef.current) setLoadingProfile(false);
          return;
        }
        
        // Buscar dados atualizados da API
        console.log('🔄 Carregando perfil do usuário...');
        logInfo('🔄 EDIT PROFILE - Carregando perfil do usuário');
        const response = await fetch(`${API_BASE_PATH}/user/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('📡 Resposta da API:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Erro na resposta da API:', response.status, errorText);
          throw new Error(`Erro ${response.status}: ${errorText || 'Erro desconhecido'}`);
        }

        const data = await response.json();
        console.log('✅ Dados recebidos da API:', {
          hasData: !!data,
          keys: Object.keys(data || {}),
          name: data?.name,
          email: data?.email,
          phone: data?.phone,
          cpf: data?.cpf,
          cpfType: typeof data?.cpf,
          cpfRaw: JSON.stringify(data?.cpf),
          cpfIsNull: data?.cpf === null,
          cpfIsUndefined: data?.cpf === undefined,
        });
        
        logInfo('✅ EDIT PROFILE - Dados recebidos da API (RESPOSTA COMPLETA)', {
          hasData: !!data,
          name: data?.name,
          email: data?.email,
          phone: data?.phone,
          cpf: data?.cpf,
          cpfType: typeof data?.cpf,
          cpfRaw: JSON.stringify(data?.cpf),
          cpfIsNull: data?.cpf === null,
          cpfIsUndefined: data?.cpf === undefined,
          cpfLength: data?.cpf ? String(data.cpf).length : 0,
        });
        
        if (!mountedRef.current) return;

        // Processar CPF - limpar valores inválidos
        let cpfValue = data.cpf;
        logDebug('🔍 EDIT PROFILE - CPF antes do processamento', { cpfValue, type: typeof cpfValue });
        
        // IMPORTANTE: Tratar explicitamente "0" como inválido também
        if (cpfValue === '0' || cpfValue === 0) {
          cpfValue = null;
          console.log('⚠️ CPF é "0" (inválido), convertendo para null');
          logError('⚠️ EDIT PROFILE - CPF é "0" (inválido), convertendo para null');
        } else if (cpfValue !== null && cpfValue !== undefined) {
          const cpfStr = String(cpfValue).trim();
          logDebug('🔍 EDIT PROFILE - CPF como string', { cpfStr, length: cpfStr.length });
          
          // Se CPF for apenas zeros ou vazio, definir como null
          if (cpfStr === '' || cpfStr === '0' || cpfStr === '00000000000' || cpfStr === '000.000.000-00') {
            cpfValue = null;
            console.log('⚠️ CPF inválido (zeros) recebido da API, convertendo para null');
            logError('⚠️ EDIT PROFILE - CPF inválido (zeros) recebido da API, convertendo para null', { cpfOriginal: cpfStr });
          } else {
            // Limpar formatação e manter apenas números
            const cpfNumbers = cpfStr.replace(/\D/g, '');
            logDebug('🔍 EDIT PROFILE - CPF após limpeza de formatação', { cpfNumbers, length: cpfNumbers.length });
            
            if (cpfNumbers === '' || cpfNumbers === '0' || cpfNumbers === '00000000000' || cpfNumbers.length !== 11) {
              cpfValue = null;
              console.log('⚠️ CPF inválido após limpeza, convertendo para null');
              logError('⚠️ EDIT PROFILE - CPF inválido após limpeza, convertendo para null', { cpfNumbers, length: cpfNumbers.length });
            } else {
              cpfValue = cpfNumbers; // Manter apenas números
              logInfo('✅ EDIT PROFILE - CPF válido processado', { cpfValue });
            }
          }
        } else {
          logDebug('🔍 EDIT PROFILE - CPF é null ou undefined', { cpfValue });
          // Garantir que seja null explicitamente (não undefined)
          cpfValue = null;
        }
        
        console.log('📝 CPF processado:', { antes: data?.cpf, depois: cpfValue });
        logInfo('📝 EDIT PROFILE - CPF processado', { antes: data?.cpf, depois: cpfValue });

        // Processar dados - SIMPLIFICADO: usar dados diretamente da API
        // Inclui também o CPF BRUTO vindo da API para debug visual
        const processedData = {
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          cpf: cpfValue, // CPF já processado (null se inválido)
          cpfRawFromApi: data.cpf, // CPF exatamente como veio da API (para debug)
          avatar: data.avatar || null,
        };

        console.log('📝 Dados processados para formulário:', processedData);
        logInfo('📝 EDIT PROFILE - Dados processados para formulário', {
          name: processedData.name,
          email: processedData.email,
          phone: processedData.phone,
          cpf: processedData.cpf,
          cpfType: typeof processedData.cpf,
          cpfIsNull: processedData.cpf === null,
          cpfIsUndefined: processedData.cpf === undefined,
        });
        
        // Log detalhado do valor que será exibido no campo
        const cpfDisplayValue = processedData.cpf && processedData.cpf !== null && processedData.cpf !== undefined ? formatCPF(processedData.cpf) : '';
        logDebug('🔍 EDIT PROFILE - Valor que será exibido no campo CPF', {
          cpfRaw: processedData.cpf,
          cpfFormatted: cpfDisplayValue,
          willShowPlaceholder: cpfDisplayValue === '',
        });
        
        setFormData(processedData);
        
        // Atualizar também o estado local do campo CPF para exibição
        // IMPORTANTE: Não chamar formatCPF para valores parciais/inválidos, pois retorna string vazia
        if (cpfValue && cpfValue !== null && cpfValue !== undefined && 
            cpfValue !== '0' && cpfValue !== '00000000000') {
          const cpfStr = String(cpfValue).replace(/\D/g, '');
          // Só formatar se tiver exatamente 11 dígitos válidos
          if (cpfStr.length === 11 && cpfStr !== '00000000000') {
            setCpfInputValue(formatCPF(cpfStr) || '');
          } else {
            // Para valores parciais ou inválidos, mostrar vazio (não tentar formatar)
            setCpfInputValue('');
          }
        } else {
          setCpfInputValue('');
        }
        
        // Salvar dados PROCESSADOS no AsyncStorage (com CPF limpo)
        // IMPORTANTE: Salvar processedData, não data bruto, para evitar cache de CPF inválido
        try {
          const dataToCache = {
            ...data,
            cpf: cpfValue, // Usar CPF processado (null se inválido)
            cpfRawFromApi: data.cpf,
          };
          await AsyncStorage.setItem('user_data', JSON.stringify(dataToCache));
          console.log('✅ Dados salvos no cache (com CPF processado):', { cpf: dataToCache.cpf });
        } catch (storageError) {
          console.warn('⚠️ Erro ao salvar no AsyncStorage:', storageError);
        }
        
      } catch (error) {
        console.error('❌ Erro ao carregar perfil:', error);
        if (mountedRef.current) {
          setError(error.message || 'Não foi possível carregar os dados do perfil');
          // Tentar carregar do cache como fallback
          try {
            const storedUser = await AsyncStorage.getItem('user_data');
            if (storedUser) {
              const parsedUser = JSON.parse(storedUser);
              // Processar CPF do cache também (limpar zeros)
              let cachedCpf = parsedUser.cpf;
              // IMPORTANTE: Tratar explicitamente "0" como inválido também
              if (cachedCpf === '0' || cachedCpf === 0) {
                cachedCpf = null;
                console.log('⚠️ CPF é "0" no cache (inválido), convertendo para null');
              } else if (cachedCpf !== null && cachedCpf !== undefined) {
                const cpfStr = String(cachedCpf).trim();
                if (cpfStr === '' || cpfStr === '0' || cpfStr === '00000000000' || cpfStr === '000.000.000-00') {
                  cachedCpf = null;
                  console.log('⚠️ CPF inválido no cache, limpando');
                } else {
                  const cpfNumbers = cpfStr.replace(/\D/g, '');
                  if (cpfNumbers === '' || cpfNumbers === '0' || cpfNumbers === '00000000000' || cpfNumbers.length !== 11) {
                    cachedCpf = null;
                    console.log('⚠️ CPF inválido no cache após limpeza');
                  } else {
                    cachedCpf = cpfNumbers;
                  }
                }
              } else {
                // Garantir que seja null explicitamente (não undefined)
                cachedCpf = null;
              }
              setFormData({
                name: parsedUser.name || '',
                email: parsedUser.email || '',
                phone: parsedUser.phone || '',
                cpf: cachedCpf, // CPF processado do cache
                cpfRawFromApi: parsedUser.cpf, // manter original para debug
                avatar: parsedUser.avatar || null,
              });
              // Atualizar também o estado local do campo CPF
              // IMPORTANTE: Não chamar formatCPF para valores parciais/inválidos
              if (cachedCpf && cachedCpf !== null && cachedCpf !== undefined && 
                  cachedCpf !== '0' && cachedCpf !== '00000000000') {
                const cpfStr = String(cachedCpf).replace(/\D/g, '');
                // Só formatar se tiver exatamente 11 dígitos válidos
                if (cpfStr.length === 11 && cpfStr !== '00000000000') {
                  setCpfInputValue(formatCPF(cpfStr) || '');
                } else {
                  setCpfInputValue('');
                }
              } else {
                setCpfInputValue('');
              }
              setError(null); // Limpar erro se conseguiu carregar do cache
              console.log('✅ Dados carregados do cache (com CPF processado):', { cpf: cachedCpf });
            }
          } catch (cacheError) {
            console.error('Erro ao carregar do cache:', cacheError);
          }
        }
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
      setError(null);
      
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Erro', 'Você precisa estar logado para atualizar o perfil.');
        return;
      }

      // Preparar CPF para envio (usar cpfInputValue se disponível, senão formData.cpf)
      const cpfToSend = cpfInputValue ? cpfInputValue.replace(/\D/g, '') : (formData.cpf ? String(formData.cpf).replace(/\D/g, '') : null);
      
      console.log('💾 Salvando perfil...', { 
        name: formData.name, 
        phone: formData.phone,
        cpf: cpfToSend,
        cpfInputValue: cpfInputValue,
        formDataCpf: formData.cpf,
      });
      logInfo('💾 EDIT PROFILE - Salvando perfil', {
        name: formData.name,
        phone: formData.phone,
        cpf: cpfToSend,
        cpfLength: cpfToSend ? cpfToSend.length : 0,
      });

      const response = await fetch(`${API_BASE_PATH}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          cpf: cpfToSend, // Enviar CPF para o backend
        }),
      });

      const responseData = await response.json();

      if (response.ok && mountedRef.current) {
        console.log('✅ Perfil atualizado com sucesso:', responseData);
        logInfo('✅ EDIT PROFILE - Perfil atualizado com sucesso', {
          responseData: responseData,
          userCpf: responseData.user?.cpf,
        });
        
        // Atualizar dados locais com a resposta da API
        const updatedUser = responseData.user || responseData;
        
        // Processar CPF retornado
        let updatedCpf = updatedUser.cpf;
        if (updatedCpf && updatedCpf !== null && updatedCpf !== undefined) {
          const cpfStr = String(updatedCpf).replace(/\D/g, '');
          if (cpfStr.length === 11 && cpfStr !== '00000000000') {
            updatedCpf = cpfStr;
          } else {
            updatedCpf = null;
          }
        } else {
          updatedCpf = null;
        }
        
        setFormData(prev => ({
          ...prev,
          name: updatedUser.name || prev.name,
          phone: updatedUser.phone || prev.phone,
          cpf: updatedCpf, // Atualizar CPF também
        }));
        
        // Atualizar também o estado do campo CPF para exibição
        if (updatedCpf && updatedCpf !== null && updatedCpf !== undefined && updatedCpf !== '0' && updatedCpf !== '00000000000') {
          const cpfStr = String(updatedCpf).replace(/\D/g, '');
          if (cpfStr.length === 11) {
            setCpfInputValue(formatCPF(cpfStr) || '');
          } else {
            setCpfInputValue(updatedCpf);
          }
        } else {
          setCpfInputValue('');
        }
        
        // Salvar no AsyncStorage
        try {
          const currentUserData = await AsyncStorage.getItem('user_data');
          const userData = currentUserData ? JSON.parse(currentUserData) : {};
          const mergedData = { 
            ...userData, 
            ...updatedUser,
            cpf: updatedCpf, // Garantir que o CPF processado seja salvo
          };
          await AsyncStorage.setItem('user_data', JSON.stringify(mergedData));
          console.log('✅ Dados salvos no AsyncStorage (com CPF):', { cpf: updatedCpf });
          logInfo('✅ EDIT PROFILE - Dados salvos no AsyncStorage', { cpf: updatedCpf });
        } catch (storageError) {
          console.warn('⚠️ Erro ao salvar no AsyncStorage:', storageError);
          logError('⚠️ EDIT PROFILE - Erro ao salvar no AsyncStorage', storageError);
        }
        
        Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
          {text: 'OK', onPress: () => {
            if (navigation && navigation.goBack) {
              navigation.goBack();
            }
          }},
        ]);
      } else {
        const errorMsg = responseData.error || responseData.message || 'Erro ao atualizar perfil';
        console.error('❌ Erro ao atualizar perfil:', errorMsg);
        setError(errorMsg);
        Alert.alert('Erro', errorMsg);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error);
      const errorMsg = error.message || 'Erro desconhecido';
      setError(errorMsg);
      Alert.alert('Erro', `Não foi possível atualizar o perfil: ${errorMsg}`);
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

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

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
              style={styles.input}
              value={cpfInputValue}
              onChangeText={(text) => {
                // Extrair apenas números do input
                const cpfNumbers = text.replace(/\D/g, '');
                
                // Limitar a 11 dígitos
                const limitedCpf = cpfNumbers.slice(0, 11);
                
                // Atualizar formData com números apenas
                setFormData(prev => ({...prev, cpf: limitedCpf || null}));
                
                // Atualizar estado de exibição:
                // - Se tiver 11 dígitos completos, formatar
                // - Caso contrário, mostrar números brutos (permite digitação sem resetar)
                if (limitedCpf.length === 11 && limitedCpf !== '00000000000') {
                  const formatted = formatCPF(limitedCpf);
                  setCpfInputValue(formatted || limitedCpf);
                } else {
                  // Mostrar números brutos durante digitação
                  setCpfInputValue(limitedCpf);
                }
                
                logDebug('🎯 CAMPO CPF - Usuário digitou', {
                  textInput: text,
                  cpfNumbers: limitedCpf,
                  length: limitedCpf.length,
                  displayValue: limitedCpf.length === 11 ? formatCPF(limitedCpf) : limitedCpf,
                });
              }}
              placeholder="000.000.000-00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <Text style={styles.helperText}>
              {formData?.cpf && isValidCPF(formData.cpf)
                ? 'CPF carregado do banco de dados'
                : 'CPF não cadastrado. Entre em contato com o suporte.'}
            </Text>
            {/* DEBUG VISUAL: mostrar sempre o CPF bruto vindo da API / storage */}
            <Text style={[styles.helperText, { fontSize: 10 }]}>
              Debug CPF bruto (API/storage): {JSON.stringify(formData?.cpfRawFromApi)}
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
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
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
