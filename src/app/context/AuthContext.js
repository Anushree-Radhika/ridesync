"use client";

import { updateProfile } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          setUser({ ...firebaseUser, profile: userDoc.data() || {} });
        } catch (err) {
          // Firestore unreachable (network block / offline) — use Auth data as fallback
          console.warn("[AuthContext] Firestore unavailable, using Auth profile:", err.code);
          setUser({ ...firebaseUser, profile: {} });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const createUserDoc = async (firebaseUser, extraData = {}) => {
    try {
      const ref = doc(db, "users", firebaseUser.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: firebaseUser.uid,
          email: firebaseUser.email || null,
          displayName: firebaseUser.displayName || extraData.displayName || null,
          photoURL: firebaseUser.photoURL || null,
          createdAt: serverTimestamp(),
          role: "rider",
          ...extraData,
        });
      }
    } catch (err) {
      console.warn("[AuthContext] Could not write user doc to Firestore:", err.code);
    }
  };

  const signUpWithEmail = async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    // Reload so onAuthStateChanged sees the updated displayName, not the
    // stale snapshot that fired immediately after account creation.
    await result.user.reload();
    await createUserDoc(result.user, { displayName });
    return result;
  };

  const signInWithEmail = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await createUserDoc(result.user);
    return result;
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isLoggedIn: !!user,
      userName: user?.profile?.displayName || user?.displayName || "there",
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);