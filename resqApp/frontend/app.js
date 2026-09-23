// ==========================================
// 1. YOUR FIREBASE CONFIG (Get this from Firebase Console -> Project Settings -> General -> Your Apps)
// ==========================================
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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// 2. GLOBAL DATA & REAL-TIME CLOUD LISTENER
// ==========================================
let globalIncidents = [];

// This listens to the database live. When a citizen reports an emergency, 
// it downloads the new list automatically without refreshing the page!
db.collection("incidents").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
    globalIncidents = [];
    snapshot.forEach((doc) => {
        globalIncidents.push(doc.data());
    });
    
    // Auto-refresh UI functions if they exist on the current page
    if (typeof renderIncidents === "function") renderIncidents();
    if (typeof loadIncidents === "function") loadIncidents();
    if (typeof updateDashboardStats === "function") updateDashboardStats();
});

// Fetch all incidents
function getIncidents() {
    return globalIncidents;
}

// Add a new incident (Called from report.html)
function addIncident(incident) {
    incident.timestamp = firebase.firestore.FieldValue.serverTimestamp(); 
    
    // Save to Firestore cloud database using the unique RESQ ID as document name
    db.collection("incidents").doc(incident.id).set(incident)
    .then(() => console.log("Saved to cloud!"))
    .catch(err => console.error("Error saving:", err));
}

// Update incident status (Called from responder.html)
function updateStatus(id, newStatus) {
    db.collection("incidents").doc(id).update({
        status: newStatus
    })
    .then(() => console.log("Status updated!"))
    .catch(err => console.error("Error updating:", err));
}

// ==========================================
// 3. ROLE SECURITY & SYSTEM RESET
// ==========================================
function enforceRoleAccess() {
    const role = localStorage.getItem('resq_role') || 'citizen'; 
    const responderLink = document.getElementById('nav-responder');
    const reportLink = document.getElementById('nav-report');
    
    if (role === 'citizen') {
        if (responderLink) responderLink.style.display = 'none';
        if (window.location.pathname.includes('responder.html')) {
            window.location.href = 'index.html';
        }
    } 
    else if (role === 'responder') {
        if (reportLink) reportLink.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', enforceRoleAccess);

// Optional: Wipe cloud database if needed
async function clearSystemData() {
    if(confirm("⚠️ Delete all cloud records permanently?")) {
        const snapshot = await db.collection('incidents').get();
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        alert("Cloud Database Cleared!");
        window.location.href = 'index.html';
    }
}