import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sisgo.app',
  appName: 'SISGO',
  webDir: 'out',
  server: {
    url: 'https://www.sisgomission.com/login',
    cleartext: false,
    allowNavigation: [
      'www.sisgomission.com',
      'sisgomission.com',
      'accounts.google.com',
      '*.google.com',
      '*.supabase.co',
    ],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#15343B',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      overlaysWebView: true,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#F9FAFB',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#F9FAFB',
    preferredContentMode: 'mobile',
    scheme: 'SISGO',
  },
}

export default config
