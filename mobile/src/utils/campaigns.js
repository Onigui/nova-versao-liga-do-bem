/** Vaquinhas: busca pública (sem login). Separado das telas para não puxar a navegação. */
import {API_BASE_PATH} from '../config/apiConfig';

export async function fetchCampaigns(fetchImpl = fetch, query = '') {
  const res = await fetchImpl(`${API_BASE_PATH}/campaigns${query}`, {headers: {'Content-Type': 'application/json'}});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.campaigns || [];
}
