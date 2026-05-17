import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kalkaninfo.app',
  appName: 'Kalkan Info',
  webDir: '.',
  server: {
    url: 'https://kalkaninfo.com',
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'kalkaninfo.com',
      'www.kalkaninfo.com',
      '*.supabase.co',
      'plausible.io'
    ]
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#072136',
    limitsNavigationsToAppBoundDomains: true
  },
  android: {
    backgroundColor: '#072136',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#072136',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#072136'
    },
    App: {
      launchUrl: 'https://kalkaninfo.com'
    }
  }
};

export default config;
