/**
 * Mapa dentro de telas com rolagem: a miniatura não pega o toque (assim não briga com a rolagem)
 * e, ao tocar, abre o mapa em tela cheia, que funciona igual ao mapa principal (arrastar, pinça para zoom).
 *
 *  - MapPreview: miniatura fixa com o selo "Toque para ampliar".
 *  - MapFullscreen: mapa em tela cheia (Modal) com título, botão de fechar e um rodapé livre.
 */
import React from 'react';
import {Modal, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LeafletMap from './LeafletMap';

export function MapPreview({center, markers, track, zoom = 15, hint = 'Toque para ampliar', onPress, style, testID}) {
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.preview, style, pressed && {opacity: 0.9}]} accessibilityRole="button" accessibilityLabel={hint} testID={testID}>
      {/* o mapa só é montado de novo quando o centro chega (ex.: GPS demorou); depois o marcador recentraliza */}
      <LeafletMap key={center ? 'com-centro' : 'sem-centro'} style={StyleSheet.absoluteFill} center={center} zoom={zoom} markers={markers} track={track} interactive={false} />
      <View style={styles.badge} pointerEvents="none">
        <Ionicons name="expand" size={14} color="#FFFFFF" />
        <Text style={styles.badgeText}>{hint}</Text>
      </View>
    </Pressable>
  );
}

export function MapFullscreen({visible, onClose, title, subtitle, footer, testID, ...mapProps}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent={false} testID={testID}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.full}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.close} hitSlop={10} accessibilityLabel="Fechar mapa" testID="fechar-mapa">
            <Ionicons name="close" size={24} color="#1E1B2E" />
          </TouchableOpacity>
          <View style={{flex: 1}}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {visible ? <LeafletMap style={{flex: 1}} zoomControl {...mapProps} /> : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  preview: {overflow: 'hidden', backgroundColor: '#E5E7EB'},
  badge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,27,46,0.78)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  full: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ECEAF3'},
  close: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F5FB'},
  title: {fontSize: 16, fontWeight: '800', color: '#1E1B2E'},
  subtitle: {fontSize: 12, color: '#6B6880', marginTop: 1},
  footer: {padding: 14, paddingBottom: 18, borderTopWidth: 1, borderTopColor: '#ECEAF3', backgroundColor: '#FFFFFF', gap: 10},
});
