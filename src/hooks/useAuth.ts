import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface FirebaseError {
  code: string;
  message: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    const initializeAuth = async () => {
      try {
    
        
        // Import Firebase modules
        const { getFirebaseAuth, getFirebaseDB, isFirebaseInitialized, getFirebaseInitializationError } = await import('@/lib/firebase');
        
        // Check if Firebase is properly initialized
                 if (!isFirebaseInitialized()) {
           const initError = getFirebaseInitializationError();
          
          // Show a more user-friendly error message
          if (initError?.message.includes('Essential Firebase configuration missing')) {
            setError('Firebase configuration is missing. Please check your environment variables.');
          } else {
            setError('Authentication service is unavailable. Please try again later.');
          }
          
          setFirebaseInitialized(false);
          setLoading(false);
          return;
        }
        
        
        setFirebaseInitialized(true);
        setError(null); // Clear any previous errors
        
        // Get Firebase instances
        const auth = getFirebaseAuth();
        const db = getFirebaseDB();
        
        if (!auth || !db) {
          throw new Error('Firebase Auth or Firestore not initialized');
        }

        // Set up auth state listener
        unsubscribe = onAuthStateChanged(auth, async (user) => {
  
          setUser(user);
          
          if (user) {
            // Fetch user data from Firestore
            try {
              const userDoc = await getDoc(doc(db, 'users', user.uid));
              if (userDoc.exists()) {
                setUserData(userDoc.data());
              }
                         } catch {
               // Don't set this as a critical error since auth still works
             }
          } else {
            setUserData(null);
          }
          
          setLoading(false);
                 }, () => {
           setError('Authentication error occurred');
           setLoading(false);
         });
        
             } catch {
         setError('Failed to initialize authentication service');
         setFirebaseInitialized(false);
         setLoading(false);
       }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signup = async (email: string, password: string, name: string) => {
    if (!firebaseInitialized) {
      throw new Error('Authentication service not available');
    }

    try {
      setError(null);
      setLoading(true);
      
      const { getFirebaseAuth, getFirebaseDB } = await import('@/lib/firebase');
      
      const auth = getFirebaseAuth();
      const db = getFirebaseDB();
      
      if (!auth || !db) {
        throw new Error('Firebase Auth or Firestore not initialized');
      }
      
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save additional user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name,
        email,
        createdAt: new Date().toISOString(),
        role: 'user'
      });

      return user;
    } catch (err: unknown) {
      const authError = err as FirebaseError;
      let errorMessage = 'An error occurred during signup';
      
      switch (authError.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address';
          break;
        default:
          errorMessage = authError.message;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    if (!firebaseInitialized) {
      throw new Error('Authentication service not available');
    }

    try {
      setError(null);
      setLoading(true);
      
      const { getFirebaseAuth } = await import('@/lib/firebase');
      
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error('Firebase Auth not initialized');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (err: unknown) {
      const authError = err as FirebaseError;
      let errorMessage = 'An error occurred during login';
      
      switch (authError.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later';
          break;
        default:
          errorMessage = authError.message;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!firebaseInitialized) {
      throw new Error('Authentication service not available');
    }

    try {
      const { getFirebaseAuth } = await import('@/lib/firebase');
      
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error('Firebase Auth not initialized');
      }
      await signOut(auth);
    } catch (err: unknown) {
      setError('Error logging out');
      throw err;
    }
  };

  const getUserData = async (uid: string) => {
    if (!firebaseInitialized) {
      return null;
    }

    try {
      const { getFirebaseDB } = await import('@/lib/firebase');
      
      const db = getFirebaseDB();
      if (!db) {
        throw new Error('Firebase Firestore not initialized');
      }
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
         } catch {
       return null;
     }
  };

  return {
    user,
    userData,
    loading,
    error,
    firebaseInitialized,
    signup,
    login,
    logout,
    getUserData
  };
}; 