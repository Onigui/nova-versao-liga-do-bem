/**
 * Imagem em tela cheia com zoom de pinça, arrastar e toque duplo (visualizador nativo do WebView).
 * Baixa a imagem com o token (rota protegida) e mostra como data URI — nada fica salvo no aparelho.
 */
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, StatusBar, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

function toDataUri(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function zoomHtml(src) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=8, user-scalable=yes">
<style>html,body{margin:0;background:#000;height:100%}body{display:flex;align-items:center;justify-content:center}
img{max-width:100%;max-height:100vh;display:block}</style></head>
<body><img src="${src}" alt="receita"></body></html>`;
}

export default function ZoomImageModal({visible, onClose, uri, headers, title = 'Receita', fetchImpl = fetch}) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || src) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetchImpl(uri, {headers});
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await toDataUri(await res.blob());
        if (alive) setSrc(data);
      } catch (e) {
        if (alive) setError('Não foi possível carregar a imagem. Verifique a internet.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, src, uri, headers, fetchImpl]);

  let WebView = null;
  try {
    WebView = require('react-native-webview').WebView;
  } catch {
    WebView = null;
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={{flex: 1, backgroundColor: '#000000'}}>
        <View style={{flexDirection: 'row', alignItems: 'center', paddingTop: 36, paddingHorizontal: 12, paddingBottom: 8}}>
          <Text style={{flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700'}}>{title}</Text>
          <Text style={{color: '#CBD5E1', fontSize: 12, marginRight: 12}}>Use dois dedos para ampliar</Text>
          <Pressable onPress={onClose} hitSlop={12} testID="fechar-zoom" accessibilityLabel="Fechar">
            <Icon name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
        {error ? (
          <Text style={{color: '#FCA5A5', textAlign: 'center', marginTop: 40, paddingHorizontal: 24}}>{error}</Text>
        ) : !src ? (
          <ActivityIndicator size="large" color="#FFFFFF" style={{marginTop: 60}} />
        ) : WebView ? (
          <WebView
            testID="zoom-webview"
            originWhitelist={['*']}
            source={{html: zoomHtml(src)}}
            style={{flex: 1, backgroundColor: '#000000'}}
            setBuiltInZoomControls
            setDisplayZoomControls={false}
            scalesPageToFit
            javaScriptEnabled={false}
          />
        ) : null}
      </View>
    </Modal>
  );
}
