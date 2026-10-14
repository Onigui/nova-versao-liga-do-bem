/**
 * Todas as avaliações de uma empresa parceira (e a resposta da empresa).
 */
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {RatingSummary, ReviewCard} from '../components/Reviews';
import {memberApi} from '../utils/quotes';

const PURPLE = '#7C3AED';

export default function PartnerReviewsScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const {partnerId, partnerName} = route?.params || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      navigation?.setOptions?.({title: partnerName ? `Avaliações · ${partnerName}` : 'Avaliações'});
      api('GET', `/partners/${partnerId}/reviews?limit=50`)
        .then(setData)
        .catch(e => setError(e.message));
    }, [api, partnerId, partnerName, navigation]),
  );

  if (!data) return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{marginTop: 40}} color={PURPLE} />;
  const tagLabels = Object.fromEntries((data.tags || []).map(t => [t.id, t.label]));
  const me = data.me;

  return (
    <FlatList
      style={{flex: 1, backgroundColor: '#F9FAFB'}}
      contentContainerStyle={{padding: 16, paddingBottom: 40}}
      data={data.reviews}
      keyExtractor={r => r.id}
      ListHeaderComponent={
        <View>
          <View style={styles.box}>
            <RatingSummary summary={data.summary} />
          </View>
          {me?.canReview ? (
            <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('ReviewForm', {partnerId, partnerName})} testID="avaliar">
              <Ionicons name={me.review ? 'create-outline' : 'star'} size={18} color="#FFFFFF" />
              <Text style={styles.btnText}>{me.review ? 'Editar minha avaliação' : 'Avaliar esta empresa'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      }
      renderItem={({item}) => <ReviewCard review={item} tagLabels={tagLabels} partnerName={partnerName} />}
    />
  );
}

const styles = StyleSheet.create({
  error: {color: '#B91C1C', margin: 24},
  box: {backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16},
  btn: {flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: PURPLE, height: 48, borderRadius: 12, marginTop: 12},
  btnText: {color: '#FFFFFF', fontWeight: '800', fontSize: 15},
});
