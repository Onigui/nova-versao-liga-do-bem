/**
 * Vaquinhas da ONG: campanhas abertas (e as encerradas há pouco, para ver o resultado).
 */
import React, {useCallback, useState} from 'react';
import {ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {fetchCampaigns} from '../utils/campaigns';
import CampaignCard from '../components/CampaignCard';
import {C, F} from '../theme/home';

export default function CampaignsScreen({navigation, fetchImpl = fetch}) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await fetchCampaigns(fetchImpl));
      setError(false);
    } catch {
      setError(true);
      setList(l => l || []);
    }
  }, [fetchImpl]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!list) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{padding: 16, paddingBottom: 32}}
      data={list}
      keyExtractor={c => c.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <Text style={[styles.intro, F.regular]}>
          Campanhas para causas específicas, como a cirurgia de um animal. Cada real vai para aquele caso, e a ONG
          mostra aqui como ele está.
        </Text>
      }
      ListEmptyComponent={
        <View style={[styles.center, {paddingVertical: 48}]} testID="vaquinhas-vazio">
          <Ionicons name={error ? 'cloud-offline' : 'heart-outline'} size={42} color={C.muted} />
          <Text style={[styles.empty, F.semibold]}>
            {error ? 'Sem conexão. Puxe para tentar de novo.' : 'Nenhuma vaquinha aberta no momento.'}
          </Text>
        </View>
      }
      renderItem={({item}) => <CampaignCard campaign={item} onPress={() => navigation.navigate('CampaignDetail', {campaignId: item.id})} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bg},
  center: {alignItems: 'center', justifyContent: 'center'},
  intro: {fontSize: 13, color: C.muted, marginBottom: 14},
  empty: {fontSize: 14, color: C.muted, marginTop: 10, textAlign: 'center'},
});
