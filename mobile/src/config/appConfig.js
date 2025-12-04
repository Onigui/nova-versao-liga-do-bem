// App Configuration
export const APP_CONFIG = {
  // Logo da aplicação
  // Opção 1: Use uma URL do logo hospedado (RECOMENDADO)
  // Para usar: substitua null abaixo pela URL do seu logo hospedado
  // Você pode hospedar em: Imgur, Cloudinary, GitHub, ou qualquer serviço de hospedagem
  // Exemplo: logoUrl: 'https://exemplo.com/logo.png',
  logoUrl: null, // SUBSTITUA pela URL do seu logo ou deixe null para usar texto
  
  // Opção 2: Use um asset local (descomente após adicionar o arquivo logo.png na pasta mobile/src/assets/images/)
  // IMPORTANTE: Adicione o arquivo logo.png na pasta mobile/src/assets/images/ antes de descomentar
  // Se usar logoLocal, comente ou remova a linha logoUrl acima
  // logoLocal: require('../assets/images/logo.png'),
  logoLocal: null,
  
  // Nome da aplicação (usado como fallback se logo não estiver configurado)
  appName: 'Liga do Bem',
  appSubtitle: 'Botucatu',
};

