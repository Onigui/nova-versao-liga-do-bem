import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function LegalScreen({route}) {
  const section = route?.params?.section || 'both';
  const showTerms = section === 'terms' || section === 'both';
  const showPrivacy = section === 'privacy' || section === 'both';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <Ionicons name="shield-checkmark" size={40} color="#FFFFFF" />
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
              nome, e-mail, telefone, CPF (quando informado) e informações de
              pets/vacinas que você cadastrar.
            </Text>
            <Text style={styles.paragraph}>
              Esses dados são usados para autenticação, comunicação sobre
              adoções/eventos, emissão do cartão de membro e melhoria dos
              serviços. Não vendemos seus dados pessoais.
            </Text>
            <Text style={styles.paragraph}>
              Doações via PIX são registradas no sistema para transparência e
              histórico do usuário. Você pode solicitar correção ou exclusão de
              dados entrando em contato com a Liga do Bem.
            </Text>
            <Text style={styles.paragraph}>
              CNPJ: 27.644.955/0001-38 — Botucatu/SP.
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F9FAFB'},
  header: {padding: 32, alignItems: 'center'},
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  headerSubtitle: {
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
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 12,
  },
});
