import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean)
export const auth = firebaseConfigured
  ? getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

let currentUser = firebaseConfigured ? undefined : null
const authListeners = new Set()

if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user
    authListeners.forEach((listener) => listener())
  })
}

export function subscribeToAuth(listener) {
  authListeners.add(listener)
  return () => authListeners.delete(listener)
}

export function getAuthSnapshot() {
  return currentUser
}
