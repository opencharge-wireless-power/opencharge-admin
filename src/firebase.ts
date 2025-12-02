// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCdf2Dd3K1hmhJYlbMm9eM_Lz_IeDrTnKk",
  authDomain: "chargeanalitiks.firebaseapp.com",
  databaseURL: "https://chargeanalitiks.firebaseio.com",
  projectId: "chargeanalitiks",
  storageBucket: "chargeanalitiks.appspot.com",
  messagingSenderId: "859988295141",
  appId: "1:859988295141:web:641a47bd892cefcd93830c",
  measurementId: "G-3H36EGZ9EQ"
};

// TODO: later we can move these values into environment variables (VITE_FIREBASE_...)

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);