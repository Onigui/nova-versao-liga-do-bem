// Configurações do Firebase para o app móvel
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAHo6rKmHo-ydUylkaX-UkoVFA1i4Qc20c",
  authDomain: "liga-do-bem-botucatu.firebaseapp.com",
  projectId: "liga-do-bem-botucatu",
  storageBucket: "liga-do-bem-botucatu.firebasestorage.app",
  messagingSenderId: "1004948170161",
  appId: "1:1004948170161:android:dae383b5e49d3fe8f5c990",
  measurementId: "G-XXXXXXXXXX"
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
