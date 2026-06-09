import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
   apiKey: "AIzaSyC7sa-fm-Si2gR-89yUhe2vcX0738K5yu4",
  authDomain: "wmsm-fa410.firebaseapp.com",
  projectId: "wmsm-fa410",
  storageBucket: "wmsm-fa410.firebasestorage.app",
  messagingSenderId: "586214969813",
  appId: "1:586214969813:web:a4f01b703c511403f6ad5c",
  measurementId: "G-2EDDJELRV9"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };