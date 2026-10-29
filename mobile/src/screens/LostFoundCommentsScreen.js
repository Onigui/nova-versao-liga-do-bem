/**
 * Mural de conversa de um caso (como os comentários de uma postagem): perguntas, informações e
 * avisos sobre o animal. Só para quem tem conta. Respostas num nível, foto opcional.
 * Segurança: o servidor bloqueia PIX/depósito/links e esconde telefone e e-mail; denúncia
 * (3 escondem); o autor do caso pode ocultar; quem escreveu pode apagar.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {memberApi} from '../utils/quotes';
import {getPicker} from '../utils/photoPicker';
import {photoUrl, timeAgo} from '../utils/lostfound';
import {F} from '../theme/home';

const PURPLE = '#6D28D9';

function Comment({c, reply, onReply, onFlag, onHide, onDelete}) {
  return (
    <View style={[styles.comment, reply && styles.reply]} testID={`comentario-${c.id}`}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{String(c.author || '?').slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{flex: 1}}>
        <View style={styles.bubble}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Text style={styles.author}>{c.author}</Text>
            {c.isCaseAuthor ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>autor do caso</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.body}>{c.body}</Text>
          {c.photo ? <Image source={{uri: photoUrl(c.photo)}} style={styles.photo} /> : null}
        </View>
        <View style={styles.actions}>
          <Text style={styles.meta}>{timeAgo(c.createdAt)}</Text>
          <TouchableOpacity onPress={() => onReply(c)} testID={`responder-${c.id}`}>
            <Text style={styles.action}>Responder</Text>
          </TouchableOpacity>
          {c.canDelete ? (
            <TouchableOpacity onPress={() => onDelete(c)} testID={`apagar-${c.id}`}>
              <Text style={styles.action}>Apagar</Text>
            </TouchableOpacity>
          ) : null}
          {c.canHide ? (
            <TouchableOpacity onPress={() => onHide(c)} testID={`ocultar-${c.id}`}>
              <Text style={styles.action}>Ocultar</Text>
            </TouchableOpacity>
          ) : null}
          {!c.mine ? (
            <TouchableOpacity onPress={() => onFlag(c)} testID={`denunciar-${c.id}`}>
              <Text style={[styles.action, {color: '#9CA3AF'}]}>Denunciar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function LostFoundCommentsScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const id = route?.params?.id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [flagging, setFlagging] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api('GET', `/lostfound/${id}/comments`));
      setError('');
    } catch (e) {
      setError(e.status === 404 ? 'Este caso não está mais disponível.' : e.message);
    }
  }, [api, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleFollow = useCallback(async () => {
    const on = !data?.following;
    setData(d => ({...d, following: on}));
    try {
      await api(on ? 'POST' : 'DELETE', `/lostfound/${id}/follow`);
    } catch (e) {
      setData(d => ({...d, following: !on}));
      Alert.alert('Não foi possível', e.message);
    }
  }, [api, id, data?.following]);

  useEffect(() => {
    navigation?.setOptions?.({
      title: route?.params?.title ? `Conversa · ${route.params.title}` : 'Conversa',
      headerRight: data
        ? () => (
            <Pressable onPress={toggleFollow} hitSlop={10} style={{paddingHorizontal: 14}} testID="acompanhar-topo" accessibilityLabel={data.following ? 'Deixar de acompanhar' : 'Acompanhar'}>
              <Ionicons name={data.following ? 'notifications' : 'notifications-outline'} size={22} color="#FFFFFF" />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, route?.params?.title, data, toggleFollow]);

  const attach = async () => {
    const launch = getPicker('library');
    const res = await launch({mediaType: 'photo', maxWidth: 1200, maxHeight: 1200, quality: 0.6, includeBase64: true});
    const a = res?.assets?.[0];
    if (!a?.base64) return;
    if (a.base64.length * 0.75 > 780 * 1024) {
      Alert.alert('Foto muito grande', 'Escolha outra foto.');
      return;
    }
    setPhoto({uri: a.uri, data: `data:${a.type || 'image/jpeg'};base64,${a.base64}`});
  };

  const send = async () => {
    const body = text.trim();
    if (body.length < 2) return;
    setSending(true);
    try {
      const d = await api('POST', `/lostfound/${id}/comments`, {body, parentId: replyTo?.id, photo: photo?.data});
      setText('');
      setPhoto(null);
      setReplyTo(null);
      if (d.message) Alert.alert('Publicado', d.message);
      await load();
    } catch (e) {
      Alert.alert('Não foi possível publicar', e.message);
    } finally {
      setSending(false);
    }
  };

  const remove = (c, hide) =>
    Alert.alert(hide ? 'Ocultar comentário?' : 'Apagar comentário?', hide ? 'Ele some do mural para todos (as respostas também).' : 'As respostas a ele também somem.', [
      {text: 'Voltar', style: 'cancel'},
      {
        text: hide ? 'Ocultar' : 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', `/lostfound/${id}/comments/${c.id}`);
            load();
          } catch (e) {
            Alert.alert('Não foi possível', e.message);
          }
        },
      },
    ]);

  const sendFlag = async () => {
    try {
      const d = await api('POST', `/lostfound/${id}/comments/${flagging.id}/flag`, {reason});
      Alert.alert('Obrigado', d.message);
      setFlagging(null);
      setReason('');
    } catch (e) {
      Alert.alert('Não foi possível', e.message);
    }
  };

  if (!data) return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{marginTop: 40}} color={PURPLE} />;

  const handlers = {onReply: setReplyTo, onFlag: c => setFlagging(c), onHide: c => remove(c, true), onDelete: c => remove(c, false)};

  return (
    <KeyboardAvoidingView style={{flex: 1, backgroundColor: '#F6F5FB'}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={data.comments}
        keyExtractor={c => c.id}
        contentContainerStyle={{padding: 14, paddingBottom: 20}}
        ListHeaderComponent={
          <View>
            <TouchableOpacity style={[styles.follow, data.following && styles.followOn]} onPress={toggleFollow} testID="acompanhar">
              <Ionicons name={data.following ? 'notifications' : 'notifications-outline'} size={18} color={data.following ? '#FFFFFF' : PURPLE} />
              <Text style={[styles.followText, data.following && {color: '#FFFFFF'}]}>
                {data.following ? 'Acompanhando: você recebe as novidades' : 'Acompanhar este caso'}
              </Text>
            </TouchableOpacity>
            <View style={styles.warn}>
              <Ionicons name="shield-checkmark" size={16} color="#92400E" />
              <Text style={styles.warnText}>Nunca faça PIX ou pagamento para "liberar" um animal. Para combinar, use o WhatsApp do aviso.</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Ninguém comentou ainda. Viu o animal ou tem alguma pista? Conte aqui.</Text>}
        renderItem={({item}) => (
          <View>
            <Comment c={item} {...handlers} />
            {item.replies.map(rp => (
              <Comment key={rp.id} c={rp} reply {...handlers} onReply={() => setReplyTo(item)} />
            ))}
          </View>
        )}
      />

      {flagging ? (
        <View style={styles.composer} testID="caixa-denuncia">
          <Text style={styles.replying}>Denunciar comentário de {flagging.author}</Text>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="O que há de errado? (golpe, ofensivo, falso…)" placeholderTextColor="#9CA3AF" maxLength={200} testID="motivo-denuncia" />
          <View style={{flexDirection: 'row', gap: 10, marginTop: 8}}>
            <TouchableOpacity style={[styles.btn, {backgroundColor: '#F3F4F6'}]} onPress={() => setFlagging(null)}>
              <Text style={[styles.btnText, {color: '#374151'}]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, {backgroundColor: '#B91C1C'}]} onPress={sendFlag} testID="enviar-denuncia">
              <Text style={styles.btnText}>Denunciar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.composer}>
          {replyTo ? (
            <View style={styles.replyBar}>
              <Text style={styles.replying} numberOfLines={1}>
                Respondendo a {replyTo.author}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={10} testID="cancelar-resposta">
                <Ionicons name="close" size={18} color="#6B7280" />
              </Pressable>
            </View>
          ) : null}
          {photo ? (
            <View style={{marginBottom: 8}}>
              <Image source={{uri: photo.uri}} style={styles.preview} />
              <Pressable style={styles.removePhoto} onPress={() => setPhoto(null)} accessibilityLabel="Tirar foto">
                <Ionicons name="close-circle" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : null}
          <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 8}}>
            <TouchableOpacity onPress={attach} style={styles.iconBtn} testID="anexar-foto" accessibilityLabel="Anexar foto">
              <Ionicons name="image-outline" size={22} color={PURPLE} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, {flex: 1, maxHeight: 110}]}
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? 'Escreva a resposta…' : 'Escreva um comentário…'}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={1000}
              testID="campo-comentario"
            />
            <TouchableOpacity onPress={send} disabled={sending || text.trim().length < 2} style={[styles.send, (sending || text.trim().length < 2) && {opacity: 0.5}]} testID="enviar-comentario" accessibilityLabel="Enviar">
              {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  error: {color: '#B91C1C', margin: 24},
  follow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: PURPLE, backgroundColor: '#FFFFFF'},
  followOn: {backgroundColor: PURPLE},
  followText: {fontSize: 14, ...F.bold, color: PURPLE},
  warn: {flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 10, marginTop: 10, marginBottom: 6},
  warnText: {...F.regular, flex: 1, fontSize: 12, color: '#92400E'},
  empty: {...F.regular, color: '#6B7280', textAlign: 'center', marginTop: 24, paddingHorizontal: 20},
  comment: {flexDirection: 'row', gap: 8, marginTop: 12},
  reply: {marginLeft: 40, marginTop: 8},
  avatar: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontSize: 14, ...F.heavy, color: PURPLE},
  bubble: {backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8},
  author: {fontSize: 13, ...F.heavy, color: '#1F2937'},
  badge: {backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1},
  badgeText: {fontSize: 10, ...F.bold, color: PURPLE},
  body: {fontSize: 14, ...F.regular, color: '#374151', marginTop: 2, lineHeight: 20},
  photo: {width: '100%', height: 180, borderRadius: 10, marginTop: 8, backgroundColor: '#E5E7EB'},
  actions: {flexDirection: 'row', gap: 14, marginTop: 4, marginLeft: 6},
  meta: {fontSize: 12, ...F.regular, color: '#9CA3AF'},
  action: {fontSize: 12, ...F.bold, color: '#6B7280'},
  composer: {backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#ECEAF3', padding: 10},
  replyBar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6},
  replying: {fontSize: 12, ...F.bold, color: PURPLE},
  input: {...F.regular, backgroundColor: '#F6F5FB', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#1F2937'},
  iconBtn: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF'},
  send: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: PURPLE},
  preview: {width: 90, height: 90, borderRadius: 10},
  removePhoto: {position: 'absolute', top: 2, left: 66, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12},
  btn: {flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  btnText: {fontSize: 14, ...F.heavy, color: '#FFFFFF'},
});
