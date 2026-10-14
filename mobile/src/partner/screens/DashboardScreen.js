/**
 * Painel do parceiro: como a parceria com a Liga está rendendo.
 * Validações por semana, indicadores dos últimos 30 dias (com comparação), dias de mais
 * movimento e as promoções mais usadas.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions} from 'react-native';
import Svg, {Line, Path, Text as SvgText} from 'react-native-svg';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, formatMoney, usePartner} from '../PartnerContext';
import {Card, Empty, styles as ui} from '../ui';
import {describePromo} from '../../utils/promo';

/** Cor das barras (teal com saturação suficiente; validada no fundo claro). */
export const MARK = '#0D9488';
const GRID = '#E2E8F0';
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Variação % entre períodos; null quando não dá para comparar. */
export function delta(cur, prev) {
  if (cur == null || prev == null) return null;
  if (!prev) return cur ? null : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

/** Teto "redondo" do eixo e as marcas (0, metade, teto). */
export function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const steps = [1, 2, 2.5, 5, 10];
  const n = steps.find(s => s * pow >= v) * pow;
  return n % 2 ? n + 1 : n;
}

const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Coluna com o topo arredondado (4px) e a base reta. */
function columnPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
/** Barra horizontal com a ponta arredondada e a base reta. */
function barPath(x, y, w, h, r = 4) {
  if (w <= 0) return '';
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

function Kpi({label, value, change, testID}) {
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  return (
    <View
      testID={testID}
      style={{
        width: '48.5%',
        backgroundColor: COLORS.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
      }}>
      <Text style={{fontSize: 12, color: COLORS.muted, fontWeight: '600'}}>{label}</Text>
      <Text style={{fontSize: 26, fontWeight: '900', color: COLORS.text, marginTop: 4}}>{value}</Text>
      {change != null ? (
        <View style={[ui.row, {gap: 4, marginTop: 2}]}>
          <Icon
            name={up ? 'trending-up' : down ? 'trending-down' : 'remove'}
            size={14}
            color={up ? COLORS.ok : down ? COLORS.bad : COLORS.muted}
          />
          <Text style={{fontSize: 12, color: COLORS.muted}}>
            {up ? '+' : ''}
            {change}% vs. 30 dias antes
          </Text>
        </View>
      ) : (
        <Text style={{fontSize: 12, color: COLORS.muted, marginTop: 2}}>últimos 30 dias</Text>
      )}
    </View>
  );
}

export function WeeklyChart({weeks, width}) {
  const [sel, setSel] = useState(null);
  const H = 170;
  const padL = 28;
  const padB = 22;
  const padT = 18;
  const plotW = width - padL - 4;
  const plotH = H - padB - padT;
  const max = niceMax(Math.max(...weeks.map(w => w.validations), 1));
  const slot = plotW / weeks.length;
  const bw = Math.min(24, Math.max(8, slot - 6));
  const y = v => padT + plotH - (v / max) * plotH;
  const last = weeks.length - 1;
  const shown = sel ?? last;
  const summary = weeks.map(w => `semana de ${ddmm(w.week)}: ${w.validations}`).join('; ');
  return (
    <View accessible accessibilityLabel={`Validações por semana. ${summary}`}>
      <Text style={{color: COLORS.text, fontWeight: '700', marginBottom: 6}} testID="semana-selecionada">
        Semana de {ddmm(weeks[shown].week)}: {weeks[shown].validations} validação(ões)
        {weeks[shown].withDiscount ? ` · ${weeks[shown].withDiscount} com promoção` : ''}
      </Text>
      <View>
      <Svg width={width} height={H}>
        {[0, max / 2, max].map(t => (
          <React.Fragment key={t}>
            <Line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <SvgText x={padL - 6} y={y(t) + 4} fontSize={10} fill={COLORS.muted} textAnchor="end">
              {Math.round(t)}
            </SvgText>
          </React.Fragment>
        ))}
        {weeks.map((w, i) => {
          const x = padL + i * slot + (slot - bw) / 2;
          const top = y(w.validations);
          return (
            <React.Fragment key={w.week}>
              <Path
                d={columnPath(x, top, bw, padT + plotH - top)}
                fill={MARK}
                opacity={sel == null || sel === i ? 1 : 0.45}
              />
              {i % 3 === last % 3 ? (
                <SvgText x={x + bw / 2} y={H - 6} fontSize={10} fill={COLORS.muted} textAnchor="middle">
                  {ddmm(w.week)}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
        {/* valor só na coluna mais recente (o resto fica no toque) */}
        <SvgText
          x={padL + last * slot + slot / 2}
          y={y(weeks[last].validations) - 5}
          fontSize={11}
          fontWeight="700"
          fill={COLORS.text}
          textAnchor="middle">
          {weeks[last].validations}
        </SvgText>
      </Svg>
      {/* áreas de toque maiores que as colunas */}
      <View style={{position: 'absolute', left: padL, right: 4, top: 0, bottom: 0, flexDirection: 'row'}}>
        {weeks.map((w, i) => (
          <Pressable
            key={w.week}
            testID={`coluna-${i}`}
            style={{flex: 1}}
            onPress={() => setSel(sel === i ? null : i)}
          />
        ))}
      </View>
      </View>
    </View>
  );
}

export function WeekdayChart({counts, width}) {
  const rows = WEEK_ORDER.map(d => ({label: WEEKDAYS[d], n: counts[d] || 0}));
  const max = Math.max(...rows.map(r => r.n), 1);
  const labelW = 34;
  const valueW = 30;
  const rowH = 22;
  const bh = 12;
  const plotW = width - labelW - valueW;
  return (
    <View accessible accessibilityLabel={`Validações por dia da semana: ${rows.map(r => `${r.label} ${r.n}`).join(', ')}`}>
      <Svg width={width} height={rows.length * rowH}>
        {rows.map((r, i) => {
          const w = (r.n / max) * plotW;
          const yy = i * rowH + (rowH - bh) / 2;
          return (
            <React.Fragment key={r.label}>
              <SvgText x={0} y={yy + bh - 1} fontSize={12} fill={COLORS.muted}>
                {r.label}
              </SvgText>
              <Path d={barPath(labelW, yy, Math.max(w, r.n ? 2 : 0), bh)} fill={MARK} />
              <SvgText x={labelW + w + 6} y={yy + bh - 1} fontSize={12} fill={COLORS.text} fontWeight="600">
                {r.n}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export default function DashboardScreen({navigation}) {
  const {api} = usePartner();
  const [reviews, setReviews] = useState(null);
  const {width: screenW} = useWindowDimensions();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const chartW = Math.min(screenW, 600) - 32 - 32;

  const load = useCallback(async () => {
    try {
      setData(await api('GET', '/partner/dashboard'));
      setError('');
      api('GET', '/partner/reviews')
        .then(r => setReviews(r?.summary && typeof r.summary.count === 'number' ? r.summary : null))
        .catch(() => {});
    } catch (e) {
      setError(e.message);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const k = data?.kpis;
  const total12 = useMemo(() => (data?.weeks || []).reduce((a, w) => a + w.validations, 0), [data]);
  const topMax = Math.max(...(data?.topDiscounts || []).map(d => d.uses), 1);

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }>
      {error ? <Text style={[ui.error, {marginBottom: 10}]}>{error}</Text> : null}
      {!data ? (
        <Empty text={error ? 'Não foi possível carregar o painel.' : 'Carregando…'} />
      ) : (
        <>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12}}>
            <Kpi
              testID="kpi-validacoes"
              label="Validações"
              value={k.current.validations}
              change={delta(k.current.validations, k.previous.validations)}
            />
            <Kpi
              testID="kpi-membros"
              label="Membros diferentes"
              value={k.current.members}
              change={delta(k.current.members, k.previous.members)}
            />
            <Kpi
              label="Promoções usadas"
              value={k.current.discountsUsed}
              change={delta(k.current.discountsUsed, k.previous.discountsUsed)}
            />
            {data.showAmounts ? (
              <Kpi
                label="Compras registradas"
                value={formatMoney(k.current.amount || 0)}
                change={delta(k.current.amount, k.previous.amount)}
              />
            ) : (
              <Kpi label="Notificações enviadas" value={data.push?.sent || 0} change={null} />
            )}
          </View>

          <Pressable onPress={() => navigation?.navigate('Reviews')} testID="abrir-avaliacoes">
            <Card style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <Icon name="star" size={28} color="#F59E0B" />
              <View style={{flex: 1}}>
                <Text style={ui.sectionTitle}>Avaliações dos clientes</Text>
                <Text style={ui.muted}>
                  {reviews?.count
                    ? `${String(reviews.rating.toFixed(1)).replace('.', ',')} de 5 · ${reviews.count} ${reviews.count === 1 ? 'avaliação' : 'avaliações'}`
                    : 'Ainda sem avaliações'}
                </Text>
              </View>
              <Icon name="chevron-forward" size={20} color={COLORS.muted} />
            </Card>
          </Pressable>

          <Card>
            <Text style={ui.sectionTitle}>Validações por semana</Text>
            <Text style={[ui.muted, {fontSize: 12, marginBottom: 10}]}>
              Últimas 12 semanas · toque numa coluna para ver a semana
            </Text>
            {total12 ? (
              <WeeklyChart weeks={data.weeks} width={chartW} />
            ) : (
              <Text style={ui.muted}>
                Ainda não há validações. Assim que os membros usarem a carteirinha na sua loja, o gráfico aparece aqui.
              </Text>
            )}
          </Card>

          {total12 ? (
            <Card>
              <Text style={ui.sectionTitle}>Dias de mais movimento</Text>
              <Text style={[ui.muted, {fontSize: 12, marginBottom: 10}]}>
                Últimos 90 dias
                {data.peakHour != null ? ` · horário de pico: ${String(data.peakHour).padStart(2, '0')}h` : ''}
              </Text>
              <WeekdayChart counts={data.byWeekday} width={chartW} />
            </Card>
          ) : null}

          <Card>
            <Text style={ui.sectionTitle}>Promoções mais usadas</Text>
            <Text style={[ui.muted, {fontSize: 12, marginBottom: 10}]}>Últimos 90 dias</Text>
            {data.topDiscounts.length ? (
              data.topDiscounts.map(d => (
                <View key={d.id} style={{marginBottom: 12}} testID="promo-top">
                  <View style={[ui.row, {justifyContent: 'space-between'}]}>
                    <Text style={{fontWeight: '700', color: COLORS.text, flex: 1}} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={{fontWeight: '800', color: COLORS.text}}>{d.uses}x</Text>
                  </View>
                  <Text style={[ui.muted, {fontSize: 12}]}>{d.badge || describePromo(d).badge}</Text>
                  <View style={{height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, marginTop: 4}}>
                    <View
                      style={{
                        height: 8,
                        width: `${Math.max(4, (d.uses / topMax) * 100)}%`,
                        backgroundColor: MARK,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text style={ui.muted}>
                Nenhuma promoção registrada nas validações ainda. No resultado da validação, marque a promoção usada.
              </Text>
            )}
          </Card>

          {data.push?.sent ? (
            <Card>
              <View style={[ui.row, {gap: 10}]}>
                <Icon name="notifications" size={22} color={COLORS.primary} />
                <Text style={{color: COLORS.text, flex: 1}}>
                  {data.push.sent} notificação(ões) enviada(s) nos últimos 90 dias, para {data.push.recipients} pessoa(s).
                </Text>
              </View>
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
