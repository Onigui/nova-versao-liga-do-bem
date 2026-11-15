/**
 * Termos de uso, política de privacidade e termos de adoção da ONG da pessoa.
 * Os textos vêm do painel (Textos e contatos): cada ONG tem os seus e muda sem nova versão do app.
 * route.params.section: 'terms' | 'privacy' | 'adoption' | 'both' (termos + privacidade, o padrão).
 */
import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, ScrollView, Linking, Pressable, ActivityIndicator} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_URL} from '../config/apiConfig';
import {F} from '../theme/home';
import MarkdownText from '../components/MarkdownText';
import {useDoc, useOrg} from '../utils/org';

const TABS = [
  {kind: 'terms', label: 'Termos de uso'},
  {kind: 'privacy', label: 'Privacidade'},
  {kind: 'adoption', label: 'Adoção'},
];

export default function LegalScreen({route, fetchImpl}) {
  const section = route?.params?.section || 'both';
  const [kind, setKind] = useState(section === 'both' ? 'terms' : section);
  useEffect(() => {
    if (section !== 'both') setKind(section);
  }, [section]);
  const org = useOrg({fetchImpl});
  const {doc, loading} = useDoc(kind, {fetchImpl});

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#3B1A78', '#5B21B6']} style={styles.header}>
        <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Termos e privacidade</Text>
        <Text style={styles.headerSubtitle}>{org.legalName}</Text>
      </LinearGradient>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <Pressable
            key={t.kind}
            onPress={() => setKind(t.kind)}
            style={[styles.tab, kind === t.kind && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{selected: kind === t.kind}}
            testID={`aba-${t.kind}`}>
            <Text style={[styles.tabText, kind === t.kind && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          {doc?.body && doc.kind === kind ? (
            <>
              <Text style={styles.sectionTitle}>{doc.title}</Text>
              <MarkdownText source={doc.body} skipFirstHeading testID={`texto-${kind}`} />
              {doc.webUrl ? (
                <Text style={styles.link} onPress={() => Linking.openURL(`${API_BASE_URL}${doc.webUrl}`).catch(() => {})} testID="politica-completa">
                  Abrir no navegador
                </Text>
              ) : null}
            </>
          ) : loading ? (
            <ActivityIndicator color="#5B21B6" />
          ) : (
            <Text style={styles.paragraph}>Não foi possível carregar agora. Tente de novo mais tarde.</Text>
          )}
        </View>
        {kind === 'privacy' ? (
          <Text style={styles.paragraph}>Para excluir sua conta: Perfil → Excluir minha conta.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F6F5FB'},
  header: {paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden'},
  headerTitle: {fontSize: 22, ...F.bold, color: '#FFFFFF', marginTop: 6},
  headerSubtitle: {...F.regular, fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4, textAlign: 'center'},
  tabs: {flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16},
  tab: {flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EDE9FE', alignItems: 'center'},
  tabActive: {backgroundColor: '#5B21B6'},
  tabText: {...F.semibold, fontSize: 13, color: '#5B21B6'},
  tabTextActive: {color: '#FFFFFF'},
  content: {padding: 20, paddingBottom: 40},
  section: {backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16},
  sectionTitle: {fontSize: 18, ...F.bold, color: '#1F2937', marginBottom: 12},
  link: {...F.bold, fontSize: 14, color: '#5B21B6', textDecorationLine: 'underline', marginTop: 4},
  paragraph: {...F.regular, fontSize: 14, color: '#4B5563', lineHeight: 22, marginBottom: 12},
});
