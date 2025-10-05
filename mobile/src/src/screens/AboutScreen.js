import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AboutScreen = () => {
  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header com logo */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>LIGA</Text>
            <Text style={[styles.logoText, styles.logoAccent]}>DO</Text>
            <Text style={[styles.logoText, styles.logoAccent2]}>BEM</Text>
          </View>
          <Text style={styles.subtitle}>Liga do Bem Botucatu</Text>
        </View>

        {/* Missão */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nossa Missão</Text>
          <Text style={styles.sectionText}>
            A Liga do Bem Botucatu é uma organização não governamental dedicada ao resgate, 
            cuidado e proteção de animais abandonados e em situação de risco. Nossa missão é 
            proporcionar uma segunda chance de vida para animais que foram vítimas de abandono, 
            maus-tratos ou negligência.
          </Text>
        </View>

        {/* Visão */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nossa Visão</Text>
          <Text style={styles.sectionText}>
            Ser reconhecida como referência em proteção animal na região de Botucatu, 
            promovendo uma sociedade mais consciente e responsável pelo bem-estar dos animais, 
            onde cada animal tenha direito a uma vida digna, com amor, cuidado e proteção.
          </Text>
        </View>

        {/* Valores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nossos Valores</Text>
          
          <View style={styles.valuesList}>
            <View style={styles.valueItem}>
              <Ionicons name="heart" size={20} color="#4CAF50" />
              <Text style={styles.valueText}>
                <Text style={styles.valueTitle}>Amor:</Text> Cada animal é tratado com carinho e respeito
              </Text>
            </View>
            
            <View style={styles.valueItem}>
              <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
              <Text style={styles.valueText}>
                <Text style={styles.valueTitle}>Proteção:</Text> Defendemos os direitos dos animais
              </Text>
            </View>
            
            <View style={styles.valueItem}>
              <Ionicons name="people" size={20} color="#4CAF50" />
              <Text style={styles.valueText}>
                <Text style={styles.valueTitle}>Solidariedade:</Text> Trabalhamos em equipe pela causa
              </Text>
            </View>
            
            <View style={styles.valueItem}>
              <Ionicons name="eye" size={20} color="#4CAF50" />
              <Text style={styles.valueText}>
                <Text style={styles.valueTitle}>Transparência:</Text> Nossas ações são sempre transparentes
              </Text>
            </View>
            
            <View style={styles.valueItem}>
              <Ionicons name="leaf" size={20} color="#4CAF50" />
              <Text style={styles.valueText}>
                <Text style={styles.valueTitle}>Sustentabilidade:</Text> Cuidamos do meio ambiente e dos animais
              </Text>
            </View>
          </View>
        </View>

        {/* História */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nossa História</Text>
          <Text style={styles.sectionText}>
            A Liga do Bem Botucatu foi fundada em 2021 por um grupo de pessoas apaixonadas 
            por animais que se uniram para fazer a diferença na vida dos animais abandonados 
            de nossa cidade. O que começou como um pequeno grupo de voluntários se transformou 
            em uma organização estruturada que já resgatou centenas de animais.
          </Text>
          <Text style={styles.sectionText}>
            Hoje, contamos com uma equipe dedicada de voluntários, parcerias estratégicas 
            e o apoio da comunidade para continuar nossa missão de proteger e cuidar dos 
            animais que mais precisam.
          </Text>
        </View>

        {/* Números */}
        <View style={styles.numbersSection}>
          <Text style={styles.numbersTitle}>Nossos Números</Text>
          
          <View style={styles.numbersGrid}>
            <View style={styles.numberCard}>
              <Text style={styles.numberValue}>500+</Text>
              <Text style={styles.numberLabel}>Animais Resgatados</Text>
            </View>
            
            <View style={styles.numberCard}>
              <Text style={styles.numberValue}>350+</Text>
              <Text style={styles.numberLabel}>Adoções Realizadas</Text>
            </View>
            
            <View style={styles.numberCard}>
              <Text style={styles.numberValue}>25+</Text>
              <Text style={styles.numberLabel}>Voluntários Ativos</Text>
            </View>
            
            <View style={styles.numberCard}>
              <Text style={styles.numberValue}>3</Text>
              <Text style={styles.numberLabel}>Anos de Atuação</Text>
            </View>
          </View>
        </View>

        {/* Como Funcionamos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Como Funcionamos</Text>
          
          <View style={styles.processSteps}>
            <View style={styles.processStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Resgate</Text>
                <Text style={styles.stepDescription}>
                  Identificamos e resgatamos animais em situação de risco
                </Text>
              </View>
            </View>
            
            <View style={styles.processStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Cuidados</Text>
                <Text style={styles.stepDescription}>
                  Fornecemos cuidados veterinários, alimentação e abrigo
                </Text>
              </View>
            </View>
            
            <View style={styles.processStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Reabilitação</Text>
                <Text style={styles.stepDescription}>
                  Trabalhamos na socialização e preparação para adoção
                </Text>
              </View>
            </View>
            
            <View style={styles.processStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Adoção</Text>
                <Text style={styles.stepDescription}>
                  Encontramos lares amorosos para nossos resgatados
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Parceiros */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nossos Parceiros</Text>
          <Text style={styles.sectionText}>
            A Liga do Bem conta com o apoio de diversos parceiros que compartilham 
            nossa visão de proteção animal. Clínicas veterinárias, pet shops, 
            empresas locais e pessoas físicas se unem a nós para fazer a diferença.
          </Text>
          
          <View style={styles.partnersInfo}>
            <View style={styles.partnerInfoItem}>
              <Ionicons name="medical" size={20} color="#4CAF50" />
              <Text style={styles.partnerInfoText}>Clínicas Veterinárias</Text>
            </View>
            <View style={styles.partnerInfoItem}>
              <Ionicons name="storefront" size={20} color="#4CAF50" />
              <Text style={styles.partnerInfoText}>Pet Shops e Lojas</Text>
            </View>
            <View style={styles.partnerInfoItem}>
              <Ionicons name="business" size={20} color="#4CAF50" />
              <Text style={styles.partnerInfoText}>Empresas Locais</Text>
            </View>
            <View style={styles.partnerInfoItem}>
              <Ionicons name="people" size={20} color="#4CAF50" />
              <Text style={styles.partnerInfoText}>Doadores e Apoiadores</Text>
            </View>
          </View>
        </View>

        {/* Reconhecimentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reconhecimentos</Text>
          
          <View style={styles.recognitionsList}>
            <View style={styles.recognitionItem}>
              <Ionicons name="trophy" size={20} color="#FFD700" />
              <Text style={styles.recognitionText}>
                Certificação de Utilidade Pública Municipal (em tramitação)
              </Text>
            </View>
            
            <View style={styles.recognitionItem}>
              <Ionicons name="ribbon" size={20} color="#FFD700" />
              <Text style={styles.recognitionText}>
                Reconhecimento pela Prefeitura de Botucatu
              </Text>
            </View>
            
            <View style={styles.recognitionItem}>
              <Ionicons name="heart" size={20} color="#FFD700" />
              <Text style={styles.recognitionText}>
                Apoio da comunidade local
              </Text>
            </View>
          </View>
        </View>

        {/* Call to Action */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Faça Parte da Nossa História</Text>
          <Text style={styles.ctaText}>
            Você também pode fazer a diferença na vida de um animal. 
            Seja através de adoção, voluntariado, doações ou simplesmente 
            compartilhando nossa causa.
          </Text>
          
          <View style={styles.ctaButtons}>
            <View style={styles.ctaButton}>
              <Ionicons name="heart" size={20} color="#4CAF50" />
              <Text style={styles.ctaButtonText}>Adotar</Text>
            </View>
            
            <View style={styles.ctaButton}>
              <Ionicons name="people" size={20} color="#4CAF50" />
              <Text style={styles.ctaButtonText}>Voluntariar</Text>
            </View>
            
            <View style={styles.ctaButton}>
              <Ionicons name="card" size={20} color="#4CAF50" />
              <Text style={styles.ctaButtonText}>Doar</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Liga do Bem Botucatu{'\n'}
            CNPJ: 27.644.955/0001-38{'\n'}
            Rua Brasílio Panhozzi, 186 - Jardim Eldorado{'\n'}
            Botucatu - SP
          </Text>
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
    padding: 40,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  logoAccent: {
    color: '#FF9800',
    fontSize: 28,
  },
  logoAccent2: {
    color: '#2196F3',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sectionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 12,
  },
  valuesList: {
    gap: 16,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  valueText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  valueTitle: {
    fontWeight: '600',
    color: '#333',
  },
  numbersSection: {
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
  numbersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  numberCard: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  numberValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  numberLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  processSteps: {
    gap: 20,
  },
  processStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  partnersInfo: {
    marginTop: 16,
    gap: 12,
  },
  partnerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerInfoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  recognitionsList: {
    gap: 12,
  },
  recognitionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recognitionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  ctaSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  ctaButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    gap: 8,
  },
  ctaButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  footer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AboutScreen;
