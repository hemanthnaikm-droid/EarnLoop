import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAokcoudIle7njfszGqXXA4NTDZfmeaTcA",
  authDomain: "earnloop-6f5ca.firebaseapp.com",
  projectId: "earnloop-6f5ca",
  storageBucket: "earnloop-6f5ca.firebasestorage.app",
  messagingSenderId: "956700552589",
  appId: "1:956700552589:web:5f9537c864747b7e4861c4",
  measurementId: "G-QQ86Q076TY"

};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
