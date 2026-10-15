/**
 * Navega para qualquer tela, inclusive as abas da barra inferior.
 * De uma tela da pilha (ex.: Todos os serviços), navigate('Pets') não acha a aba:
 * é preciso entrar pelo navegador das abas → navigate('MainTabs', {screen: 'Pets'}).
 */
export const TAB_ROUTES = ['Home', 'Parceiros', 'Cartão', 'Pets', 'Perfil'];

export function tabTarget(screen, params) {
  return TAB_ROUTES.includes(screen) ? {name: 'MainTabs', params: {screen, params}} : {name: screen, params};
}

export default function navigateTo(navigation, screen, params) {
  const t = tabTarget(screen, params);
  navigation.navigate(t.name, t.params);
}
