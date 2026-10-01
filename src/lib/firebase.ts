import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let _db: ReturnType<typeof getFirestore> | null = null
let _auth: ReturnType<typeof getAuth> | null = null

export function getDb() {
  if (!_db) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    _db = getFirestore(app)
  }
  return _db
}

export function getAuthInstance() {
  if (!_auth) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    _auth = getAuth(app)
  }
  return _auth
}

// For backward compatibility - these will be initialized on first use
export const db = {
  get current() { return getDb() }
}
export const auth = {
  get current() { return getAuthInstance() }
}
