// Firebase SDK initialization (CDN modules — compatible with Vite & production)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js';

export const firebaseConfig = {
  projectId: "imcsc-mart-ng",
  appId: "1:11955968335:web:6bd97807bf7dc64b950d3a",
  storageBucket: "imcsc-mart-ng.firebasestorage.app",
  apiKey: "AIzaSyAJHtvzCQJFPi5u60Piqpxkfycj9VPU4LA",
  authDomain: "imcsc-mart-ng.firebaseapp.com",
  messagingSenderId: "11955968335",
  projectNumber: "11955968335"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const ADMIN_EMAIL = 'ceoccyige@gmail.com';

// Re-export common helpers
export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  ref,
  uploadBytes,
  getDownloadURL
};