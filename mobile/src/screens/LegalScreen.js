import React from 'react';
import {View, Text, StyleSheet, ScrollView, Linking} from 'react-native';
import {API_BASE_PATH} from '../config/apiConfig';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {F} from '../theme/home';

export default function LegalScreen({route}) {
  const section = route?.params?.section || 'both';
  const showTerms = section === 'terms' || section === 'both';
  const showPrivacy = section === 'privacy' || section === 'both';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#3B1A78', '#5B21B6']} style={styles.header}>
        <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Termos e Privacidade</Text>
        <Text style={styles.headerSubtitle}>Liga do Bem Botucatu</Text>
      </LinearGradient>

      <View style={styles.content}>
        {showTerms ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Termos de Uso</Text>
            <Text style={styles.paragraph}>
              Ao utilizar o aplicativo da Liga do Bem Botucatu, você concorda em
              usar a plataforma de forma responsável, fornecendo informações
              verdadeiras no cadastro e respeitando as regras de adoção,
              doações e uso do cartão de membro.
            </Text>
            <Text style={styles.paragraph}>
              O cartão digital e os descontos em parceiros são benefícios
              destinados a membros ativos. O uso indevido do QR Code ou de dados
              de terceiros pode resultar na suspensão da conta.
            </Text>
            <Text style={styles.paragraph}>
              Solicitações de adoção, inscrição em eventos e cadastro de
              voluntariado estão sujeitos à análise da organização.
            </Text>
          </View>
        ) : null}

        {showPrivacy ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Política de Privacidade</Text>
            <Text style={styles.paragraph}>
              Coletamos dados necessários para o funcionamento do app, como
              nome, e-mail, telefone, CPF (obrigatório, uma conta por pessoa),
              localização (com a sua permissão), fotos que você envia e
              informações de pets/vacinas que você cadastrar.
            </Text>
            <Text style={styles.paragraph}>
              Esses dados são usados para autenticação, comunicação sobre
              adoções/eventos, emissão do cartão de membro e melhoria dos
              serviços. Não vendemos seus dados pessoais.
            </Text>
            <Text style={styles.paragraph}>
              Doações via PIX são registradas no sistema para transparência e
              histórico do usuário. Você pode corrigir seus dados no Perfil e
              excluir sua conta a qualquer momento em Perfil → Excluir minha
              conta.
            </Text>
            <Text style={styles.paragraph}>
              CNPJ: 27.644.955/0001-38 — Botucatu/SP.
            </Text>
            <Text style={styles.link} onPress={() => Linking.openURL(`${API_BASE_PATH}/privacidade`)} testID="politica-completa">
              Ler a política de privacidade completa
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F6F5FB'},
  header: {paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 22,
    ...F.bold,
    color: '#FFFFFF',
    marginTop: 6,
  },
  headerSubtitle: {
    ...F.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  content: {padding: 20, paddingBottom: 40},
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    ...F.bold,
    color: '#1F2937',
    marginBottom: 12,
  },
  link: {...F.bold, fontSize: 14, color: '#5B21B6', textDecorationLine: 'underline'},
  paragraph: {
    ...F.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 12,
  },
});
