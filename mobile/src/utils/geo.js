/** Distância em linha reta (km) entre dois pontos; null se faltar coordenada. */
export function distanceKm(a, b) {
  const n = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const lat1 = n(a?.latitude);
  const lon1 = n(a?.longitude);
  const lat2 = n(b?.latitude);
  const lon2 = n(b?.longitude);
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** 350 m · 2,4 km · 18 km */
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
