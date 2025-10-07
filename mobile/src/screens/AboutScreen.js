import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const handleContact = (type, value) => {
    switch (type) {
      case 'phone':
        Linking.openURL(`tel:${value}`);
        break;
      case 'email':
        Linking.openURL(`mailto:${value}`);
        break;
      case 'website':
        Linking.openURL(value);
        break;
      default:
        break;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sobre a Liga do Bem</Text>
        <Text style={styles.headerSubtitle}>
          Conheça nossa missão e história
        </Text>
      </View>

      {/* Mission */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nossa Missão</Text>
        <Text style={styles.sectionText}>
          Promover o bem-estar animal através de adoções responsáveis, 
          cuidados veterinários e conscientização da comunidade de Botucatu. 
          Trabalhamos para garantir que todos os animais tenham uma vida digna 
          e um lar cheio de amor.
        </Text>
      </View>

      {/* Values */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nossos Valores</Text>
        <View style={styles.valuesList}>
          <View style={styles.valueItem}>
            <Ionicons name="heart" size={24} color="#8B5CF6" />
            <Text style={styles.valueText}>Amor pelos animais</Text>
          </View>
          <View style={styles.valueItem}>
            <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            <Text style={styles.valueText}>Responsabilidade</Text>
          </View>
          <View style={styles.valueItem}>
            <Ionicons name="people" size={24} color="#F59E0B" />
            <Text style={styles.valueText}>Comunidade</Text>
          </View>
          <View style={styles.valueItem}>
            <Ionicons name="eye" size={24} color="#EF4444" />
            <Text style={styles.valueText}>Transparência</Text>
          </View>
        </View>
      </View>

      {/* Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contato</Text>
        <View style={styles.contactList}>
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => handleContact('phone', '+5514999999999')}
          >
            <Ionicons name="call" size={24} color="#8B5CF6" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Telefone</Text>
              <Text style={styles.contactValue}>(14) 99999-9999</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => handleContact('email', 'contato@ligadobem.com')}
          >
            <Ionicons name="mail" size={24} color="#8B5CF6" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>contato@ligadobem.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => handleContact('website', 'https://ligadobem.com')}
          >
            <Ionicons name="globe" size={24} color="#8B5CF6" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Website</Text>
              <Text style={styles.contactValue}>ligadobem.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactItem}>
            <Ionicons name="location" size={24} color="#8B5CF6" />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Endereço</Text>
              <Text style={styles.contactValue}>Botucatu - SP</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Social Media */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Redes Sociais</Text>
        <View style={styles.socialList}>
          <TouchableOpacity style={styles.socialItem}>
            <Ionicons name="logo-facebook" size={24} color="#1877F2" />
            <Text style={styles.socialText}>Facebook</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialItem}>
            <Ionicons name="logo-instagram" size={24} color="#E4405F" />
            <Text style={styles.socialText}>Instagram</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialItem}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            <Text style={styles.socialText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Versão 1.0.0</Text>
        <Text style={styles.versionText}>© 2025 Liga do Bem Botucatu</Text>
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
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
  },
  valuesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  valueText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  contactList: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  socialList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  socialItem: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  socialText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  versionContainer: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  versionText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
});
