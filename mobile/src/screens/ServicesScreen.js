/**
 * Todos os serviços: tudo o que o app faz, em grupos, com busca (sem acento).
 */
import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {C, F, searchServices} from '../theme/home';
import navigateTo from '../navigation/navigateTo';

export default function ServicesScreen({navigation, route}) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => searchServices(query), [query]);

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Voltar" testID="voltar">
          <Ionicons name="chevron-back" size={24} color={C.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, F.heavy]}>Todos os serviços</Text>
      </View>
      <View style={styles.search}>
        <Ionicons name="search" size={20} color={C.muted} />
        <TextInput
          style={[styles.input, F.regular]}
          placeholder="Buscar: vacina, doação, orçamento…"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          autoFocus={!!route?.params?.focusSearch}
          accessibilityLabel="Buscar serviço"
          testID="busca-servicos"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={{paddingBottom: 32}} keyboardShouldPersistTaps="handled">
        {groups.length ? (
          groups.map(g => (
            <View key={g.title} style={{marginHorizontal: 20, marginTop: 20}}>
              <Text style={[styles.groupTitle, F.heavy]}>{g.title}</Text>
              <View style={styles.grid}>
                {g.items.map(s => (
                  <Pressable key={s.id} style={styles.item} onPress={() => navigateTo(navigation, s.screen)} testID={`servico-${s.id}`}>
                    <View style={[styles.icon, {backgroundColor: s.bg}]}>
                      <Ionicons name={s.icon} size={23} color={s.fg} />
                    </View>
                    <Text style={[styles.label, F.semibold]} numberOfLines={2}>
                      {s.label}
                    </Text>
                    {s.isNew ? (
                      <View style={styles.new}>
                        <Text style={[styles.newText, F.heavy]}>NOVO</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        ) : (
          <Text style={[styles.empty, F.regular]}>Nada encontrado para "{query}".</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bg},
  top: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingTop: 16},
  back: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 20, color: C.ink},
  search: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 14, height: 50, marginHorizontal: 20, marginTop: 8, borderWidth: 1, borderColor: '#E7E4F0'},
  input: {flex: 1, fontSize: 15, color: C.ink},
  groupTitle: {fontSize: 12, color: C.muted, letterSpacing: 0.6, marginBottom: 10},
  grid: {backgroundColor: C.card, borderRadius: 22, paddingTop: 14, paddingHorizontal: 6, paddingBottom: 4, flexDirection: 'row', flexWrap: 'wrap'},
  item: {width: '25%', alignItems: 'center', paddingBottom: 12, paddingHorizontal: 2},
  icon: {width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  label: {fontSize: 12, color: C.ink, textAlign: 'center', marginTop: 6, lineHeight: 15},
  new: {position: 'absolute', top: -4, right: 6, backgroundColor: '#DB2777', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2},
  newText: {fontSize: 9, color: '#FFFFFF'},
  empty: {textAlign: 'center', color: C.muted, marginTop: 40},
});
