/**
 * Gráfico do peso do pet ao longo do tempo.
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {dayLabel, kg, weightChart} from '../utils/health';
import {F} from '../theme/home';

export default function WeightChart({weights, color = '#7C3AED', width = 300}) {
  const c = weightChart(weights, width, 110);
  if (!c) return null;
  const up = c.change > 0;
  return (
    <View style={styles.chartBox} testID="grafico-peso">
      <View style={styles.chartHead}>
        <Text style={styles.chartTitle}>Peso</Text>
        <Text style={styles.chartNow}>{kg(c.last.weight)}</Text>
      </View>
      <Text style={styles.chartMeta}>
        {c.change === 0 ? 'Estável' : `${up ? '+' : '−'}${kg(Math.abs(c.change))}`} desde {dayLabel(c.first.date)} · {weights.length} medições
      </Text>
      <Svg width={width} height={110}>
        <Path d={c.path} stroke={color} strokeWidth={2.5} fill="none" />
        {c.points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
        ))}
      </Svg>
    </View>
  );
}


const styles = StyleSheet.create({
  chartBox: {backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, overflow: 'hidden'},
  chartHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline'},
  chartTitle: {fontSize: 15, ...F.heavy, color: '#1F2937'},
  chartNow: {fontSize: 20, ...F.heavy, color: '#1F2937'},
  chartMeta: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginBottom: 6},
});
