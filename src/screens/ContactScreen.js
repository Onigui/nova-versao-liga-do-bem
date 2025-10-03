import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ContactScreen = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const handleCall = () => {
    const phoneNumber = '14998225023';
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmail = () => {
    const email = 'administrativo@ligadobembotucatu.org.br';
    Linking.openURL(`mailto:${email}`);
  };

  const handleWhatsApp = () => {
    const phoneNumber = '5514998225023';
    const message = 'Olá! Gostaria de saber mais sobre a Liga do Bem Botucatu.';
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  const handleMaps = () => {
    const address = 'Rua Brasílio Panhozzi, 186, Jardim Eldorado, Botucatu - SP';
    const url = `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  const handleSubmitForm = () => {
    if (!formData.name || !formData.email || !formData.message) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    Alert.alert(
      'Mensagem Enviada',
      'Obrigado pelo seu contato! Entraremos em contato em breve.',
      [
        {
          text: 'OK',
          onPress: () => {
            setFormData({
              name: '',
              email: '',
              phone: '',
              subject: '',
              message: ''
            });
          }
        }
      ]
    );
  };

  const contactInfo = [
    {
      id: 'phone',
      title: 'Telefone',
      value: '(14) 99822-5023',
      icon: 'call',
      color: '#4CAF50',
      action: handleCall
    },
    {
      id: 'email',
      title: 'E-mail',
      value: 'administrativo@ligadobembotucatu.org.br',
      icon: 'mail',
      color: '#2196F3',
      action: handleEmail
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      value: '(14) 99822-5023',
      icon: 'logo-whatsapp',
      color: '#25D366',
      action: handleWhatsApp
    },
    {
      id: 'address',
      title: 'Endereço',
      value: 'Rua Brasílio Panhozzi, 186\nJardim Eldorado - Botucatu/SP',
      icon: 'location',
      color: '#FF5722',
      action: handleMaps
    }
  ];

  const renderContactCard = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.contactCard}
      onPress={item.action}
    >
      <View style={[styles.contactIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={24} color="white" />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactTitle}>{item.title}</Text>
        <Text style={styles.contactValue}>{item.value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Contato</Text>
          <Text style={styles.headerSubtitle}>
            Entre em contato conosco para tirar dúvidas, fazer denúncias, 
            solicitar resgates ou se tornar um voluntário.
          </Text>
        </View>

        {/* Informações de Contato */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Informações - Liga do Bem Botucatu</Text>
          
          <View style={styles.contactCards}>
            {contactInfo.map(renderContactCard)}
          </View>
        </View>

        {/* Horários de Funcionamento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Horários de Funcionamento</Text>
          
          <View style={styles.scheduleList}>
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleDay}>Segunda a Sexta</Text>
              <Text style={styles.scheduleTime}>08:00 - 18:00</Text>
            </View>
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleDay}>Sábado</Text>
              <Text style={styles.scheduleTime}>08:00 - 12:00</Text>
            </View>
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleDay}>Domingo</Text>
              <Text style={styles.scheduleTime}>Fechado</Text>
            </View>
          </View>
          
          <View style={styles.emergencyInfo}>
            <Ionicons name="warning" size={20} color="#FF5722" />
            <Text style={styles.emergencyText}>
              Para emergências e resgates, nosso telefone funciona 24h
            </Text>
          </View>
        </View>

        {/* Formulário de Contato */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Envie sua Mensagem</Text>
          
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                placeholder="Seu nome completo"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>E-mail *</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                placeholder="seu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({...formData, phone: text})}
                placeholder="(14) 99999-9999"
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Assunto</Text>
              <TextInput
                style={styles.input}
                value={formData.subject}
                onChangeText={(text) => setFormData({...formData, subject: text})}
                placeholder="Sobre o que você gostaria de falar?"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mensagem *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.message}
                onChangeText={(text) => setFormData({...formData, message: text})}
                placeholder="Escreva sua mensagem aqui..."
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
            
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitForm}>
              <Ionicons name="send" size={20} color="white" />
              <Text style={styles.submitButtonText}>Enviar Mensagem</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Redes Sociais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siga-nos nas Redes Sociais</Text>
          
          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
              <Text style={styles.socialButtonText}>Facebook</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-instagram" size={24} color="#E4405F" />
              <Text style={styles.socialButtonText}>Instagram</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-youtube" size={24} color="#FF0000" />
              <Text style={styles.socialButtonText}>YouTube</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tipos de Contato */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quando Nos Contatar</Text>
          
          <View style={styles.contactTypes}>
            <View style={styles.contactTypeItem}>
              <Ionicons name="paw" size={20} color="#4CAF50" />
              <Text style={styles.contactTypeTitle}>Resgate de Animais</Text>
              <Text style={styles.contactTypeText}>
                Animal abandonado, ferido ou em perigo
              </Text>
            </View>
            
            <View style={styles.contactTypeItem}>
              <Ionicons name="heart" size={20} color="#E91E63" />
              <Text style={styles.contactTypeTitle}>Adoção</Text>
              <Text style={styles.contactTypeText}>
                Interesse em adotar um animal
              </Text>
            </View>
            
            <View style={styles.contactTypeItem}>
              <Ionicons name="people" size={20} color="#2196F3" />
              <Text style={styles.contactTypeTitle}>Voluntariado</Text>
              <Text style={styles.contactTypeText}>
                Quer se tornar um voluntário
              </Text>
            </View>
            
            <View style={styles.contactTypeItem}>
              <Ionicons name="card" size={20} color="#FF9800" />
              <Text style={styles.contactTypeTitle}>Doações</Text>
              <Text style={styles.contactTypeText}>
                Quer ajudar com doações
              </Text>
            </View>
            
            <View style={styles.contactTypeItem}>
              <Ionicons name="business" size={20} color="#9C27B0" />
              <Text style={styles.contactTypeTitle}>Parcerias</Text>
              <Text style={styles.contactTypeText}>
                Empresa interessada em parceria
              </Text>
            </View>
          </View>
        </View>

        {/* Informações Legais */}
        <View style={styles.legalSection}>
          <Text style={styles.legalTitle}>Informações Legais</Text>
          
          <View style={styles.legalInfo}>
            <Text style={styles.legalLabel}>CNPJ:</Text>
            <Text style={styles.legalValue}>27.644.955/0001-38</Text>
          </View>
          
          <View style={styles.legalInfo}>
            <Text style={styles.legalLabel}>Razão Social:</Text>
            <Text style={styles.legalValue}>Liga do Bem Botucatu</Text>
          </View>
          
          <View style={styles.legalInfo}>
            <Text style={styles.legalLabel}>Endereço Completo:</Text>
            <Text style={styles.legalValue}>
              Rua Brasílio Panhozzi, 186{'\n'}
              Complemento: A{'\n'}
              Bairro: Loteamento Jardim Eldorado{'\n'}
              CEP: 18608-785{'\n'}
              Cidade: Botucatu – SP
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  contactSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  contactCards: {
    gap: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scheduleList: {
    marginBottom: 16,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scheduleDay: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  scheduleTime: {
    fontSize: 14,
    color: '#666',
  },
  emergencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
  },
  emergencyText: {
    fontSize: 14,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  textArea: {
    height: 100,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    gap: 8,
  },
  socialButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  contactTypes: {
    gap: 16,
  },
  contactTypeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contactTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    marginLeft: 12,
  },
  contactTypeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  legalSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 32,
  },
  legalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  legalInfo: {
    marginBottom: 12,
  },
  legalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  legalValue: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default ContactScreen;
