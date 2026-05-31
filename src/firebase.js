import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBMrGDqwru9eJYQgjDV268oOgUQ-Gisu2U",
  authDomain: "serviceteam-d2649.firebaseapp.com",
  projectId: "serviceteam-d2649",
  storageBucket: "serviceteam-d2649.firebasestorage.app",
  messagingSenderId: "427057704026",
  appId: "1:427057704026:web:67a39c5139dd7299fa7c63",
  measurementId: "G-1NEYP0THDR"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
