import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function getFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0]

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set')

  const serviceAccount: ServiceAccount = JSON.parse(raw)
  return initializeApp({ credential: cert(serviceAccount) })
}

export function getFCM() {
  return getMessaging(getFirebaseAdmin())
}
