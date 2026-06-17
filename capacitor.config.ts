import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sisgo.app',
  appName: 'SISGO',
  webDir: 'out',
  server: {
    url: 'https://www.sisgomission.com/login',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#15343B',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#15343B',
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#15343B',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#15343B',
    preferredContentMode: 'mobile',
    scheme: 'SISGO',
  },
}

export default config
