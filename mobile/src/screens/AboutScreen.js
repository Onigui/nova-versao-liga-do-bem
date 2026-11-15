/**
 * "Sobre a ONG": texto e contatos vêm do painel de cada ONG (Textos e contatos).
 * Nada fixo de uma ONG específica: a mesma tela serve para todas.
 */
import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {F} from '../theme/home';
import MarkdownText from '../components/MarkdownText';
import {useDoc, useOrg, formatPhone} from '../utils/org';
import {appVersionLabel} from '../utils/appVersion';

const open = url => Linking.openURL(url).catch(() => {});
const shortUrl = u => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

export function contactRows(org) {
  const c = org?.contacts || {};
  const rows = [];
  if (c.whatsapp) rows.push({key: 'whatsapp', icon: 'logo-whatsapp', color: '#25D366', label: 'WhatsApp', value: formatPhone(c.whatsapp), url: `https://wa.me/${String(c.whatsapp).replace(/\D/g, '').replace(/^(?!55)/, '55')}`});
  if (c.phone) rows.push({key: 'phone', icon: 'call', color: '#6D28D9', label: 'Telefone', value: formatPhone(c.phone), url: `tel:${String(c.phone).replace(/\D/g, '')}`});
  if (c.email) rows.push({key: 'email', icon: 'mail', color: '#6D28D9', label: 'E-mail', value: c.email, url: `mailto:${c.email}`});
  if (c.website) rows.push({key: 'website', icon: 'globe', color: '#6D28D9', label: 'Site', value: shortUrl(c.website), url: c.website});
  if (c.instagram) rows.push({key: 'instagram', icon: 'logo-instagram', color: '#E4405F', label: 'Instagram', value: shortUrl(c.instagram).replace(/^instagram\.com\//i, '@'), url: c.instagram});
  if (c.facebook) rows.push({key: 'facebook', icon: 'logo-facebook', color: '#1877F2', label: 'Facebook', value: shortUrl(c.facebook), url: c.facebook});
  const place = c.address || [org?.city, org?.state].filter(Boolean).join(' - ');
  if (place) rows.push({key: 'address', icon: 'location', color: '#6D28D9', label: 'Endereço', value: place, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`});
  return rows;
}

export default function AboutScreen({fetchImpl}) {
  const org = useOrg({fetchImpl});
  const {doc, loading} = useDoc('about', {fetchImpl});
  const rows = contactRows(org);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="sobre-titulo">
          {doc?.title || `Sobre a ${org.name}`}
        </Text>
        {org.city ? (
          <Text style={styles.headerSubtitle}>
            {org.city}
            {org.state ? ` - ${org.state}` : ''}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        {doc?.body ? (
          <MarkdownText source={doc.body} skipFirstHeading testID="sobre-texto" />
        ) : loading ? (
          <ActivityIndicator color="#5B21B6" />
        ) : (
          <Text style={styles.muted}>Não foi possível carregar agora. Tente de novo mais tarde.</Text>
        )}
      </View>

      {rows.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fale com a {org.name}</Text>
          <View style={styles.contactList}>
            {rows.map((r, i) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.contactItem, i === rows.length - 1 && {borderBottomWidth: 0}]}
                onPress={() => open(r.url)}
                testID={`contato-${r.key}`}>
                <Ionicons name={r.icon} size={22} color={r.color} />
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{r.label}</Text>
                  <Text style={styles.contactValue}>{r.value}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>
          © {new Date().getFullYear()} {org.legalName}
          {org.cnpj ? ` · CNPJ ${org.cnpj}` : ''}
        </Text>
        <Text style={styles.versionText}>Aplicativo SóciONG · {appVersionLabel()}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F6F5FB'},
  header: {padding: 20, paddingTop: 10},
  headerTitle: {fontSize: 24, ...F.bold, color: '#1F2937', marginBottom: 4},
  headerSubtitle: {...F.regular, fontSize: 15, color: '#6B7280'},
  card: {backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginHorizontal: 20, marginBottom: 20},
  muted: {...F.regular, fontSize: 14, color: '#6B7280'},
  section: {paddingHorizontal: 20},
  sectionTitle: {fontSize: 18, ...F.semibold, color: '#1F2937', marginBottom: 12},
  contactList: {backgroundColor: 'white', borderRadius: 16, overflow: 'hidden'},
  contactItem: {flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'},
  contactInfo: {flex: 1, marginLeft: 12},
  contactLabel: {...F.regular, fontSize: 13, color: '#6B7280', marginBottom: 2},
  contactValue: {fontSize: 15, ...F.semibold, color: '#1F2937'},
  versionContainer: {alignItems: 'center', padding: 20, paddingTop: 32},
  versionText: {...F.regular, fontSize: 13, color: '#9CA3AF', marginBottom: 4, textAlign: 'center'},
});
