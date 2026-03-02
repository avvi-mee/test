import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let _adminApp: App | null = null;

function ensureAdminApp(): App {
  if (!_adminApp) {
    if (getApps().length > 0) {
      _adminApp = getApps()[0];
    } else {
      // Primary: full service account JSON (JSON.parse handles newlines automatically)
      const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (jsonEnv) {
        const serviceAccount = JSON.parse(jsonEnv);
        _adminApp = initializeApp({ credential: cert(serviceAccount) });
      } else {
        // Fallback: individual env vars (strip wrapping quotes if present)
        _adminApp = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY
              ?.replace(/^"|"$/g, "")
              .replace(/\\n/g, "\n"),
          }),
        });
      }
    }
  }
  return _adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(ensureAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(ensureAdminApp());
}
