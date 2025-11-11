import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ligadobem.botucatu',
  appName: 'Liga do Bem Botucatu',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8081' 
      : undefined,
    cleartext: process.env.NODE_ENV === 'development'
  },
  android: {
    buildOptions: {
      keystorePath: 'release.keystore',
      keystoreAlias: 'ligadobem',
      // Senhas serão configuradas via variáveis de ambiente no CI
    }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#8B5CF6',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
