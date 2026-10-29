/**
 * Mapa gratuito (OpenStreetMap + Leaflet) dentro de um WebView: sem chave de API e sem cobrança.
 *
 * Modos:
 *  - marcadores: `markers` [{id, lat, lng, color, approximate, label}] → onMarkerPress(id)
 *  - escolher local: `pick` + `onPick({lat, lng})` → pino arrastável / toque no mapa
 *  - trajeto: `track` [{lat, lng}] → linha tracejada ligando os pontos (por onde o animal passou)
 *  - miniatura: `interactive={false}` → o mapa não pega o toque (não briga com a rolagem da tela);
 *    use junto com MapPreview/MapFullscreen para abrir o mapa em tela cheia.
 * `userLocation` mostra o ponto azul de onde a pessoa está.
 */
import React, {useEffect, useMemo, useRef} from 'react';
import {StyleSheet, View} from 'react-native';

function getWebView() {
  try {
    return require('react-native-webview').WebView;
  } catch {
    return null;
  }
}

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

export function buildMapHtml({center, zoom = 14, pick = false, interactive = true, zoomControl = false}) {
  const lock = interactive ? '' : ',dragging:false,touchZoom:false,doubleClickZoom:false,scrollWheelZoom:false,boxZoom:false,keyboard:false,tap:false';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>html,body,#map{height:100%;margin:0;padding:0}.leaflet-control-attribution{font-size:9px}
.pin{width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.pin span{display:block;transform:rotate(45deg);color:#fff;font:bold 13px sans-serif;text-align:center;line-height:24px}
.me{width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)}</style>
</head><body><div id="map"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
var send=function(o){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o))};
var map=L.map('map',{zoomControl:${zoomControl && interactive ? 'true' : 'false'},attributionControl:true${lock}}).setView([${center.lat},${center.lng}],${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var trackLayer=L.layerGroup().addTo(map), layer=L.layerGroup().addTo(map), me=null, picker=null;
function icon(color,label){return L.divIcon({className:'',iconSize:[30,30],iconAnchor:[15,30],html:'<div class="pin" style="background:'+color+'"><span>'+(label||'')+'</span></div>'})}
window.setMarkers=function(list,fit){layer.clearLayers();var b=[];
 (list||[]).forEach(function(m){
  if(m.approximate){L.circle([m.lat,m.lng],{radius:300,color:m.color,weight:1,fillOpacity:.12}).addTo(layer)}
  var mk=L.marker([m.lat,m.lng],{icon:icon(m.color,m.label)}).addTo(layer);
  mk.on('click',function(){send({type:'marker',id:m.id})});b.push([m.lat,m.lng]);});
 if(fit&&b.length>1){map.fitBounds(b,{padding:[40,40],maxZoom:16})}else if(fit&&b.length===1){map.setView(b[0],map.getZoom()>=15?map.getZoom():15)}};
window.setTrack=function(pts){trackLayer.clearLayers();if(pts&&pts.length>1){L.polyline(pts.map(function(p){return[p.lat,p.lng]}),{color:'#7C3AED',weight:3,opacity:.75,dashArray:'6 8'}).addTo(trackLayer)}};
window.setMe=function(p,c){if(!p)return;if(c&&!window._centered){window._centered=true;map.setView([p.lat,p.lng],14)}if(me){me.setLatLng([p.lat,p.lng])}else{me=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',iconSize:[16,16],html:'<div class="me"></div>'}),interactive:false}).addTo(map)}};
window.center=function(p,z){map.setView([p.lat,p.lng],z||map.getZoom())};
${
  pick && interactive
    ? `picker=L.marker([${center.lat},${center.lng}],{draggable:true,icon:icon('#7C3AED','')}).addTo(map);
picker.on('dragend',function(){var p=picker.getLatLng();send({type:'pick',lat:p.lat,lng:p.lng})});
map.on('click',function(e){picker.setLatLng(e.latlng);send({type:'pick',lat:e.latlng.lat,lng:e.latlng.lng})});
window.setPick=function(p){picker.setLatLng([p.lat,p.lng]);map.setView([p.lat,p.lng],17);send({type:'pick',lat:p.lat,lng:p.lng})};`
    : ''
}
map.on('moveend',function(){var c=map.getCenter();send({type:'move',lat:c.lat,lng:c.lng,zoom:map.getZoom()})});
send({type:'ready'});
</script></body></html>`;
}

export default function LeafletMap({center, zoom, markers, track, onMarkerPress, pick, onPick, onMove, userLocation, pickTo, centerOnUser = false, fit = true, interactive = true, zoomControl = false, style, testID}) {
  const WebView = getWebView();
  const ref = useRef(null);
  const ready = useRef(false);
  // O HTML só é montado uma vez (centro inicial); depois tudo muda por injectJavaScript
  const html = useMemo(() => buildMapHtml({center: center || {lat: -22.8859, lng: -48.4435}, zoom, pick, interactive, zoomControl}), []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = js => ready.current && ref.current?.injectJavaScript(`${js};true;`);

  useEffect(() => {
    if (markers) run(`setMarkers(${JSON.stringify(markers)}, ${fit ? 'true' : 'false'})`);
  }, [markers, fit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (track) run(`setTrack(${JSON.stringify(track)})`);
  }, [track]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (userLocation) run(`setMe(${JSON.stringify(userLocation)}, ${centerOnUser ? 'true' : 'false'})`);
  }, [userLocation?.lat, userLocation?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move o pino de escolha (ex.: "usar minha localização")
  useEffect(() => {
    if (pick && pickTo) run(`setPick(${JSON.stringify({lat: pickTo.lat, lng: pickTo.lng})})`);
  }, [pickTo?.lat, pickTo?.lng, pickTo?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = e => {
    let msg;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      ready.current = true;
      if (track) run(`setTrack(${JSON.stringify(track)})`);
      if (markers) run(`setMarkers(${JSON.stringify(markers)}, ${fit ? 'true' : 'false'})`);
      if (userLocation) run(`setMe(${JSON.stringify(userLocation)}, ${centerOnUser ? 'true' : 'false'})`);
    } else if (msg.type === 'marker') onMarkerPress?.(msg.id);
    else if (msg.type === 'pick') onPick?.({lat: Math.round(msg.lat * 1e6) / 1e6, lng: Math.round(msg.lng * 1e6) / 1e6});
    else if (msg.type === 'move') onMove?.(msg);
  };

  if (!WebView) return <View style={[styles.box, style]} testID={testID} />;
  return (
    <View style={[styles.box, style]} testID={testID} pointerEvents={interactive ? 'auto' : 'none'}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{html, baseUrl: 'https://ligadobem.app/'}}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        scrollEnabled={interactive}
        nestedScrollEnabled={interactive}
        style={{flex: 1}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {overflow: 'hidden', backgroundColor: '#E5E7EB'},
});
