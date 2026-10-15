/**
 * Linha do tempo de saúde do pet e gráfico de peso.
 * Usada pelo tutor (Histórico de saúde) e pelo veterinário (atendimento pelo QR).
 */
import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {dayLabel, groupByMonth, kg, kindInfo} from '../utils/health';
import {F} from '../theme/home';

function Row({item, color, onPhoto, onEdit, canEdit}) {
  const [open, setOpen] = useState(false);
  const k = kindInfo(item);
  const editable = !!(onEdit && canEdit && canEdit(item));
  const hasMore = !!(item.details || item.guidance || item.hasPhoto || item.vetName || item.returnDate || editable);
  return (
    <Pressable onPress={() => hasMore && setOpen(o => !o)} style={styles.row} testID={`hist-${item.id}`}>
      <View style={[styles.dot, {backgroundColor: `${k.color}1A`}]}>
        <Ionicons name={k.icon} size={18} color={k.color} />
      </View>
      <View style={{flex: 1}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
          <Text style={styles.title}>{item.title}</Text>
          {item.verified ? (
            <View style={styles.verified}>
              <Ionicons name="checkmark-circle" size={11} color="#047857" />
              <Text style={styles.verifiedText}>VETERINÁRIO</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta}>
          {[k.label, dayLabel(item.date), item.weight != null && item.kind !== 'PESO' ? kg(item.weight) : null, item.kind === 'PESO' ? kg(item.weight) : null, item.clinicName]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {open ? (
          <View style={{marginTop: 6}}>
            {item.details ? <Text style={styles.body}>{item.details}</Text> : null}
            {item.guidance ? (
              <Text style={[styles.body, {marginTop: 4}]}>
                <Text style={{fontWeight: '700'}}>Orientações: </Text>
                {item.guidance}
              </Text>
            ) : null}
            {item.returnDate ? (
              <Text style={[styles.body, {marginTop: 4}]}>
                <Text style={{fontWeight: '700'}}>{item.type === 'VACCINATION' ? 'Próxima dose: ' : 'Retorno: '}</Text>
                {dayLabel(item.returnDate)}
              </Text>
            ) : null}
            {item.vetName ? (
              <Text style={[styles.meta, {marginTop: 4}]}>
                {item.vetName}
                {item.vetCrmv ? ` · CRMV ${item.vetCrmv}` : ''}
              </Text>
            ) : null}
            <View style={{flexDirection: 'row', gap: 14, marginTop: 6}}>
              {item.hasPhoto && onPhoto ? (
                <Pressable onPress={() => onPhoto(item)} style={styles.link} testID={`foto-${item.id}`}>
                  <Ionicons name="image" size={15} color={color} />
                  <Text style={[styles.linkText, {color}]}>Ver foto</Text>
                </Pressable>
              ) : null}
              {editable ? (
                <Pressable onPress={() => onEdit(item)} style={styles.link} testID={`editar-${item.id}`}>
                  <Ionicons name="create-outline" size={15} color={color} />
                  <Text style={[styles.linkText, {color}]}>Editar</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : item.details ? (
          <Text style={styles.preview} numberOfLines={1}>
            {item.details}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function HealthTimeline({items, color = '#7C3AED', onPhoto, onEdit, canEdit, emptyText}) {
  const groups = groupByMonth(items);
  if (!groups.length) return <Text style={styles.empty}>{emptyText || 'Nada registrado ainda.'}</Text>;
  return (
    <View>
      {groups.map(g => (
        <View key={g.key}>
          <Text style={styles.month}>{g.title}</Text>
          {g.items.map(it => (
            <Row key={`${it.type}-${it.id}`} item={it} color={color} onPhoto={onPhoto} onEdit={onEdit} canEdit={canEdit} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  month: {fontSize: 12, ...F.heavy, color: '#6B7280', textTransform: 'uppercase', marginTop: 14, marginBottom: 6},
  row: {flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 8},
  dot: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 15, ...F.bold, color: '#1F2937', flexShrink: 1},
  verified: {flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1},
  verifiedText: {fontSize: 9, ...F.heavy, color: '#047857'},
  meta: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginTop: 2},
  preview: {
    ...F.regular, fontSize: 13, color: '#4B5563', marginTop: 3},
  body: {
    ...F.regular, fontSize: 14, color: '#374151', lineHeight: 20},
  link: {flexDirection: 'row', alignItems: 'center', gap: 4},
  linkText: {...F.bold, fontSize: 13},
  empty: {textAlign: 'center', color: '#6B7280', marginTop: 24},
});
