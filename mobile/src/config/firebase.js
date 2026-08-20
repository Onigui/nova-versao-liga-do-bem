// Configurações do Firebase para o app móvel
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDorHZ_EA9VIRRaVLvxWtwguJ0j_wYdPhU",
  authDomain: "liga-do-bem-botucatu-4c696.firebaseapp.com",
  projectId: "liga-do-bem-botucatu-4c696",
  storageBucket: "liga-do-bem-botucatu-4c696.firebasestorage.app",
  messagingSenderId: "398857279152",
  appId: "1:398857279152:android:24398742fe38ed32578d75",
};

// Configurações específicas para notificações push
export const NOTIFICATION_CONFIG = {
  // Canal de notificação padrão
  defaultChannel: {
    id: 'liga-do-bem-default',
    name: 'Liga do Bem',
    description: 'Notificações gerais da Liga do Bem',
    importance: 'high',
  },
  
  // Canais específicos
  channels: {
    adoption: {
      id: 'liga-do-bem-adoption',
      name: 'Adoções',
      description: 'Notificações sobre adoções',
      importance: 'high',
    },
    donation: {
      id: 'liga-do-bem-donation',
      name: 'Doações',
      description: 'Notificações sobre doações',
      importance: 'medium',
    },
    events: {
      id: 'liga-do-bem-events',
      name: 'Eventos',
      description: 'Notificações sobre eventos',
      importance: 'medium',
    },
    partners: {
      id: 'liga-do-bem-partners',
      name: 'Parceiros',
      description: 'Notificações sobre parceiros',
      importance: 'low',
    },
  }
};

// Configurações de deep linking
export const DEEP_LINKING_CONFIG = {
  scheme: 'ligadobem',
  hostname: 'app.ligadobem.com',
  paths: {
    adoption: '/adoption/:id',
    donation: '/donation/:id',
    partner: '/partner/:id',
    event: '/event/:id',
  }
};

export default {
  FIREBASE_CONFIG,
  NOTIFICATION_CONFIG,
  DEEP_LINKING_CONFIG,
};
