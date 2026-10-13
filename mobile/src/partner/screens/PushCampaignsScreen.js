/**
 * Notificação paga: lista + criação. O parceiro escreve, paga e a Liga aprova antes do envio.
 */
import React, {useCallback, useState} from 'react';
import {RefreshControl, ScrollView, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  COLORS,
  formatDateTimeBR,
  formatMoney,
  usePartner,
  formatDateBR,
} from '../PartnerContext';
import {Badge, Button, Card, Field, styles as ui} from '../ui';
import SlotPicker, {formatSlot} from '../components/SlotPicker';

export const PUSH_STATUS = {
  AWAITING_PAYMENT: {text: 'Aguardando pagamento', tone: 'warn'},
  PENDING_REVIEW: {text: 'Paga · em análise pela Liga', tone: 'warn'},
  SCHEDULED: {text: 'Aprovada · agendada', tone: 'ok'},
  SENDING: {text: 'Enviando…', tone: 'ok'},
  SENT: {text: 'Enviada', tone: 'ok'},
  REJECTED: {text: 'Não aprovada', tone: 'bad'},
  CANCELLED: {text: 'Cancelada', tone: 'muted'},
};

export function validatePush(
  title,
  body,
  limits = {titleMax: 50, bodyMax: 180},
) {
  const t = title.trim();
  const b = body.trim();
  if (t.length < 3) return 'Escreva um título (mín. 3 letras).';
  if (t.length > limits.titleMax)
    return `Título com no máximo ${limits.titleMax} caracteres.`;
  if (b.length < 10) return 'Escreva a mensagem (mín. 10 letras).';
  if (b.length > limits.bodyMax)
    return `Mensagem com no máximo ${limits.bodyMax} caracteres.`;
  if (/https?:\/\/|www\./i.test(`${t} ${b}`))
    return 'Links não são permitidos. O membro abre a página da sua empresa no app.';
  return null;
}

export default function PushCampaignsScreen({navigation}) {
  const {api, partner, isOwner} = usePartner();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [slot, setSlot] = useState(null);
  const [slotsKey, setSlotsKey] = useState(0);
  const [moving, setMoving] = useState(false);
  const [newSlot, setNewSlot] = useState(null);
  const [moveMsg, setMoveMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api('GET', '/partner/push-campaigns'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = data?.campaigns?.find(c =>
    ['AWAITING_PAYMENT', 'PENDING_REVIEW', 'SCHEDULED', 'SENDING'].includes(c.status),
  );
  const limits = data?.limits || {titleMax: 50, bodyMax: 180};
  const blockedUntil = data?.nextAllowedAt;
  const enabled = data?.settings?.enabled !== false;

  const create = async () => {
    const err = validatePush(title, body, limits);
    if (err) {
      setFormError(err);
      return;
    }
    if (!slot) {
      setFormError('Escolha o dia e o horário do envio.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      const r = await api('POST', '/partner/push-campaigns', {
        title: title.trim(),
        body: body.trim(),
        scheduledFor: slot,
      });
      setTitle('');
      setBody('');
      setSlot(null);
      navigation.navigate('PushPayment', {campaignId: r.campaign.id});
    } catch (e) {
      setFormError(e.message);
      if (/horário/i.test(e.message)) {
        setSlot(null);
        setSlotsKey(k => k + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const reschedule = async () => {
    if (!newSlot || !open) return;
    try {
      const r = await api('POST', `/partner/push-campaigns/${open.id}/reschedule`, {scheduledFor: newSlot});
      setMoveMsg(r.message || 'Horário alterado.');
      setMoving(false);
      setNewSlot(null);
      load();
    } catch (e) {
      setMoveMsg(e.message);
      setSlotsKey(k => k + 1);
    }
  };

  const previewTitle = `${partner?.name || 'Sua empresa'} · ${
    title.trim() || 'Título da notificação'
  }`;

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled"
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
      <Card
        style={{backgroundColor: COLORS.primarySoft, borderColor: '#99F6E4'}}>
        <Text
          style={{fontSize: 16, fontWeight: '800', color: COLORS.primaryDark}}>
          Fale com todos os membros da Liga do Bem
        </Text>
        <Text style={{color: COLORS.primaryDark, marginTop: 4}}>
          {data
            ? `Sua mensagem chega para ${
                data.audience
              } pessoa(s) com o app instalado. Valor: ${formatMoney(
                data.settings.price,
              )} por envio.`
            : 'Carregando…'}
        </Text>
        <Text style={[ui.muted, {marginTop: 6, fontSize: 12}]}>
          Você escolhe o dia e o horário. A Liga revisa antes de enviar; se não aprovar, o valor é devolvido.
        </Text>
      </Card>
      {error ? (
        <Text style={[ui.error, {marginBottom: 10}]}>{error}</Text>
      ) : null}

      {open ? (
        <Card>
          <Text
            style={{fontWeight: '800', color: COLORS.text, marginBottom: 6}}>
            Em andamento
          </Text>
          <Text style={{fontWeight: '700', color: COLORS.text}}>
            {open.title}
          </Text>
          <Text style={ui.muted}>{open.body}</Text>
          <View style={{marginTop: 8}}>
            <Badge
              text={PUSH_STATUS[open.status]?.text || open.status}
              tone={PUSH_STATUS[open.status]?.tone}
            />
          </View>
          {open.scheduledFor ? (
            <Text style={{color: COLORS.primaryDark, fontWeight: '700', marginTop: 8}} testID="agendada-para">
              🗓️ Envio: {formatSlot(open.scheduledFor)}
            </Text>
          ) : null}
          {moveMsg ? <Text style={[ui.muted, {marginTop: 6}]}>{moveMsg}</Text> : null}
          {isOwner && open.scheduledFor && ['AWAITING_PAYMENT', 'PENDING_REVIEW', 'SCHEDULED'].includes(open.status) ? (
            moving ? (
              <View style={{marginTop: 12}}>
                <SlotPicker value={newSlot} onChange={setNewSlot} campaignId={open.id} refreshKey={slotsKey} />
                <Button title="Confirmar novo horário" onPress={reschedule} disabled={!newSlot} testID="confirmar-horario" />
                <Button title="Cancelar" variant="ghost" onPress={() => setMoving(false)} style={{marginTop: 4}} />
              </View>
            ) : (
              <Button
                title="Trocar horário"
                variant="secondary"
                onPress={() => {
                  setMoveMsg('');
                  setMoving(true);
                }}
                style={{marginTop: 10, minHeight: 42}}
                testID="trocar-horario"
              />
            )
          ) : null}
          {open.status === 'AWAITING_PAYMENT' && isOwner ? (
            <Button
              title="Pagar agora"
              onPress={() =>
                navigation.navigate('PushPayment', {campaignId: open.id})
              }
              style={{marginTop: 12}}
              testID="pagar"
            />
          ) : null}
        </Card>
      ) : !isOwner ? (
        <Card>
          <Text style={ui.muted}>
            Só o responsável pela empresa pode criar notificações.
          </Text>
        </Card>
      ) : !enabled ? (
        <Card>
          <Text style={ui.muted}>
            As notificações pagas estão pausadas pela Liga no momento.
          </Text>
        </Card>
      ) : blockedUntil ? (
        <Card>
          <Text style={ui.muted}>
            Você já usou o limite desta semana. Próxima notificação liberada em{' '}
            {formatDateBR(blockedUntil)}.
          </Text>
        </Card>
      ) : data ? (
        <Card>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: COLORS.text,
              marginBottom: 10,
            }}>
            Nova notificação
          </Text>
          <Field
            label={`Título (${title.trim().length}/${limits.titleMax})`}
            value={title}
            onChangeText={setTitle}
            maxLength={limits.titleMax}
            placeholder="Ex.: Banho e tosa com 20% OFF"
            testID="push-titulo"
          />
          <Field
            label={`Mensagem (${body.trim().length}/${limits.bodyMax})`}
            value={body}
            onChangeText={setBody}
            maxLength={limits.bodyMax}
            multiline
            placeholder="Ex.: Só nesta semana, membros da Liga têm 20% no banho e tosa. Mostre a carteirinha!"
            testID="push-mensagem"
          />
          <Text style={[ui.label, {fontSize: 15, marginTop: 4}]}>Quando enviar?</Text>
          <SlotPicker value={slot} onChange={setSlot} refreshKey={slotsKey} />
          <Text style={ui.label}>Prévia no celular do membro</Text>
          <View
            style={{
              backgroundColor: '#1E293B',
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
            }}>
            <Text style={{color: '#94A3B8', fontSize: 11}}>
              Liga do Bem · {slot ? formatSlot(slot) : 'no horário escolhido'}
            </Text>
            <Text
              style={{color: '#FFFFFF', fontWeight: '700', marginTop: 2}}
              numberOfLines={1}>
              {previewTitle}
            </Text>
            <Text style={{color: '#E2E8F0', marginTop: 2}} numberOfLines={3}>
              {body.trim() || 'Sua mensagem aparece aqui.'}
            </Text>
          </View>
          {formError ? (
            <Text style={[ui.error, {marginBottom: 10, fontSize: 14}]}>
              {formError}
            </Text>
          ) : null}
          <Button
            title={`Continuar para o pagamento · ${formatMoney(
              data.settings.price,
            )}`}
            onPress={create}
            loading={saving}
            testID="criar-push"
          />
        </Card>
      ) : null}

      {data?.campaigns?.filter(c => c !== open).length ? (
        <Text style={[ui.sectionTitle, {marginVertical: 10}]}>Histórico</Text>
      ) : null}
      {data?.campaigns
        ?.filter(c => c !== open)
        .map(c => (
          <Card key={c.id} style={{paddingVertical: 12}}>
            <View style={[ui.row, {justifyContent: 'space-between'}]}>
              <Text
                style={{fontWeight: '700', color: COLORS.text, flex: 1}}
                numberOfLines={1}>
                {c.title}
              </Text>
              <Badge
                text={PUSH_STATUS[c.status]?.text || c.status}
                tone={PUSH_STATUS[c.status]?.tone}
              />
            </View>
            <Text style={[ui.muted, {fontSize: 13, marginTop: 2}]}>
              {c.sentAt
                ? formatDateTimeBR(c.sentAt)
                : c.scheduledFor
                  ? `Agendada: ${formatSlot(c.scheduledFor)}`
                  : formatDateTimeBR(c.createdAt)}{' '}
              ·{' '}
              {formatMoney(c.price)}
              {c.status === 'SENT' && c.recipients != null
                ? ` · ${c.recipients} pessoa(s)`
                : ''}
            </Text>
            {c.status === 'REJECTED' ? (
              <Text style={{color: COLORS.bad, fontSize: 13, marginTop: 4}}>
                {c.reviewNote}
                {c.refundStatus === 'REFUNDED'
                  ? ' · valor estornado'
                  : ' · estorno em andamento'}
              </Text>
            ) : null}
          </Card>
        ))}
    </ScrollView>
  );
}
