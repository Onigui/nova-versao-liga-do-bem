/**
 * Início: "Como foi?" — empresas que o membro visitou e ainda não avaliou.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {memberApi} from '../utils/quotes';

export default function PendingReviewsCard({navigation, enabled = true, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const [pending, setPending] = useState([]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let alive = true;
      api('GET', '/reviews/pending')
        .then(d => alive && setPending(d.pending || []))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [api, enabled]),
  );

  if (!enabled || !pending.length) return null;
  return (
    <View style={styles.box} testID="avaliacoes-pendentes">
      <Text style={styles.title}>Como foi?</Text>
      <Text style={styles.sub}>Avalie as empresas que você visitou. Leva 10 segundos e ajuda outros tutores.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10, paddingTop: 10}}>
        {pending.map(p => (
          <TouchableOpacity
            key={p.partnerId}
            style={styles.item}
            onPress={() => navigation.navigate('ReviewForm', {partnerId: p.partnerId, partnerName: p.name})}
            testID={`avaliar-${p.partnerId}`}>
            <View style={styles.logo}>
              {p.logo ? <Image source={{uri: p.logo}} style={{width: '100%', height: '100%'}} /> : <Text style={styles.initial}>{(p.name || '?')[0]}</Text>}
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {p.name}
            </Text>
            <View style={{flexDirection: 'row', gap: 1, marginTop: 4}}>
              {[1, 2, 3, 4, 5].map(i => (
                <Ionicons key={i} name="star-outline" size={13} color="#F59E0B" />
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginHorizontal: 20, marginTop: 16, borderWidth: 1, borderColor: '#FDE68A'},
  title: {fontSize: 17, fontWeight: '800', color: '#92400E'},
  sub: {fontSize: 13, color: '#92400E', marginTop: 2},
  item: {width: 110, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10, alignItems: 'center'},
  logo: {width: 44, height: 44, borderRadius: 12, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  initial: {fontSize: 18, fontWeight: '800', color: '#7C3AED'},
  name: {fontSize: 12, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginTop: 6},
});
