import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Lazy initialization variables
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let initializationError: Error | null = null;
let isInitialized = false;

// Firebase configuration
const getFirebaseConfig = () => ({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
});



// Initialize Firebase only when needed
const initializeFirebase = () => {
  if (isInitialized) {
    return { app, auth, db, storage, error: initializationError };
  }

  try {
    // Only initialize if we're in the browser (not during build)
    if (typeof window === 'undefined') {
      return { app: null, auth: null, db: null, storage: null, error: null };
    }

    // Check if essential config is available
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      throw new Error('Essential Firebase configuration missing. Please check your environment variables.');
    }

    // Initialize Firebase
    app = initializeApp(getFirebaseConfig());

    // Initialize Firebase Authentication
    auth = getAuth(app);

    // Initialize Cloud Firestore
    db = getFirestore(app);

    // Initialize Firebase Storage
    storage = getStorage(app);

    isInitialized = true;
    initializationError = null;

  } catch (error) {
    // Store the error for later use
    initializationError = error instanceof Error ? error : new Error('Unknown Firebase initialization error');
  }

  return { app, auth, db, storage, error: initializationError };
};

// Export functions to get Firebase instances
export const getFirebaseApp = () => {
  const { app } = initializeFirebase();
  return app;
};

export const getFirebaseAuth = () => {
  const { auth } = initializeFirebase();
  return auth;
};

export const getFirebaseDB = () => {
  const { db } = initializeFirebase();
  return db;
};

export const getFirebaseStorage = () => {
  const { storage } = initializeFirebase();
  return storage;
};

// Export a function to check if Firebase is initialized
export const isFirebaseInitialized = () => {
  const { error } = initializeFirebase();
  return !error && isInitialized;
};

// Export a function to get the initialization error
export const getFirebaseInitializationError = () => {
  const { error } = initializeFirebase();
  return error;
};

// Export default app for backward compatibility
export default getFirebaseApp(); 