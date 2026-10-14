/**
 * Meus avisos de achados e perdidos.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {memberApi} from '../utils/quotes';
import {ReportRow} from './LostFoundScreen';

const STATUS = {ACTIVE: 'No mapa', RESOLVED: '💚 Voltou para casa', EXPIRED: 'Expirado: renove para voltar ao mapa'};

export default function LostFoundMineScreen({navigation, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const [list, setList] = useState(null);

  useFocusEffect(
    useCallback(() => {
      api('GET', '/lostfound/mine')
        .then(d => setList(d.reports || []))
        .catch(() => setList([]));
    }, [api]),
  );

  if (!list) return <ActivityIndicator style={{marginTop: 40}} color="#7C3AED" />;
  return (
    <FlatList
      style={{flex: 1, backgroundColor: '#F9FAFB'}}
      contentContainerStyle={{padding: 16}}
      data={list}
      keyExtractor={r => r.id}
      ListEmptyComponent={<Text style={styles.empty}>Você ainda não publicou avisos.</Text>}
      renderItem={({item}) => (
        <View>
          <Text style={styles.status}>
            {item.hidden ? 'Em revisão pela Liga' : STATUS[item.status] || item.status}
            {item.views ? ` · ${item.views} visualizações` : ''}
          </Text>
          <ReportRow r={item} onPress={() => navigation.navigate('LostFoundDetail', {id: item.id})} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: {textAlign: 'center', color: '#6B7280', marginTop: 40},
  status: {fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 4, marginLeft: 4},
});
