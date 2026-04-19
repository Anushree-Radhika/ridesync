import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDkd4lWOiSYmE66lhd2KM6GS4YGmQl_V3Y",
  authDomain: "ridesync-73af5.firebaseapp.com",
  projectId: "ridesync-73af5",
  storageBucket: "ridesync-73af5.firebasestorage.app",
  messagingSenderId: "529417597615",
  appId: "1:529417597615:web:0d14210447cff0e7089a5a",
  measurementId: "G-9TVY7D99MK"
};

// Prevent re-initializing on hot reload in dev
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize analytics only on client side where supported
let analytics;
if (typeof window !== "undefined") {
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}
export { analytics };
export default app;