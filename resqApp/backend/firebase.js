// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDSLAcJQQvdU9sF1JLTc8SjxiPtOcP12VE",
  authDomain: "resq-mvp-44900.firebaseapp.com",
  projectId: "resq-mvp-44900",
  storageBucket: "resq-mvp-44900.firebasestorage.app",
  messagingSenderId: "520324222721",
  appId: "1:520324222721:web:6a9af5ef8035490cc71500",
  measurementId: "G-PTFGNWH926"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);