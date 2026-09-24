
const isLocalFrontend = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
window.RESQ_API_BASE = window.RESQ_API_BASE || (
    isLocalFrontend && window.location.port ? window.location.origin : 'http://[::1]:3002'
);

function initializeResponsiveNavigation() {
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('primary-nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
        const collapsed = links.classList.toggle('nav-collapsed');
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.querySelector('span').textContent = collapsed ? 'Open menu' : 'Close menu';
        toggle.querySelector('[aria-hidden="true"]').textContent = collapsed ? '☰' : '✕';
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeResponsiveNavigation);
} else {
    initializeResponsiveNavigation();
}

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


let globalIncidents = [];


db.collection("incidents").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
    globalIncidents = [];
    snapshot.forEach((doc) => {
        globalIncidents.push(doc.data());
    });
    
    // Auto-refresh UI functions if they exist on the current page
    if (typeof renderIncidents === "function") renderIncidents();
    if (typeof loadIncidents === "function") loadIncidents();
    if (typeof window.renderIncidentMap === "function") window.renderIncidentMap();
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


document.addEventListener("DOMContentLoaded", () => {
    // Prevent duplicates
    const existing = document.getElementById('resq-ai-chat');
    if (existing) existing.remove();

    const chatHTML = `
    <div id="resq-ai-chat" class="fixed bottom-5 right-5 z-50 font-sans">
        <button onclick="toggleChat()" class="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 text-xl">
            ❄️
        </button>

        <div id="chat-window" class="hidden absolute bottom-16 right-0 w-80 md:w-96 bg-slate-800 border border-blue-500/50 rounded-xl shadow-2xl flex flex-col h-[450px] overflow-hidden text-left">
            <div class="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
                <div><h3 class="font-bold text-white flex items-center gap-2">❄️ Snowflake AI assistant</h3><p id="chat-backend-status" class="text-xs text-slate-400 mt-1">Checking assistant…</p></div>
                <button onclick="toggleChat()" class="text-slate-400 hover:text-white font-bold">✖</button>
            </div>

            <div id="chat-messages" class="flex-1 p-4 overflow-y-auto space-y-3 text-sm text-slate-300">
                <div class="bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <p>Ask about emergency response and safety guidance. Use the status above to check availability.</p>
                </div>
            </div>

            <div class="p-3 bg-slate-900 border-t border-slate-700 flex gap-2">
                <input type="text" id="chat-input" placeholder="Ask the Snowflake assistant…" class="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500" onkeypress="handleKeyPress(event)">
                <button onclick="sendAIChatMessage()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">Send</button>
            </div>
        </div>
    </div>`;

    const div = document.createElement('div');
    div.innerHTML = chatHTML;
    document.body.appendChild(div);
    checkAIBackend();
});

async function checkAIBackend() {
    const status = document.getElementById('chat-backend-status');
    if (!status) return;
    try {
        const response = await fetch(`${window.RESQ_API_BASE}/api/health`);
        const data = await response.json();
        if (response.ok && data.status === 'connected') {
            status.textContent = 'Snowflake connected · Cortex ready';
            status.className = 'text-xs text-emerald-400 mt-1';
        } else {
            status.textContent = data.status === 'not_configured'
                ? `Snowflake settings required · ${data.error || ''}`
                : `Snowflake unavailable · ${data.error || 'connection failed'}`;
            status.className = 'text-xs text-amber-300 mt-1';
        }
    } catch (_error) {
        status.textContent = 'Backend offline · run npm start';
        status.className = 'text-xs text-red-300 mt-1';
    }
}

function toggleChat() {
    const win = document.getElementById('chat-window');
    if (win) win.classList.toggle('hidden');
}

function handleKeyPress(e) {
    if (e.key === 'Enter') sendAIChatMessage();
}

// Send requests to the Snowflake Cortex backend.
async function sendAIChatMessage() {
    const inputField = document.getElementById('chat-input');
    if (!inputField) return;
    const userText = inputField.value.trim();
    if (!userText) return;

    const messagesContainer = document.getElementById('chat-messages');

    // 1. Display user message in your chat box UI immediately
    messagesContainer.innerHTML += `
        <div class="bg-blue-900/40 border border-blue-800 p-3 rounded-lg ml-auto max-w-[85%] text-white text-xs">
            <p>${escapeAIHtml(userText)}</p>
        </div>
    `;
    inputField.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show loading state
    const loadingId = 'loading-' + Date.now();
    messagesContainer.innerHTML += `
        <div id="${loadingId}" class="bg-slate-900 border border-slate-700 p-3 rounded-lg mr-auto max-w-[85%] text-slate-400 italic text-xs">
            ❄️ Snowflake assistant is thinking…
        </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        // The server calls Snowflake Cortex using its private connection settings.
        const response = await fetch(`${window.RESQ_API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userText })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Chat request failed (${response.status}).`);
        }
        
        // Remove loading state
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        // 3. Display Snowflake's actual AI reply in your chat box UI
        messagesContainer.innerHTML += `
            <div class="bg-slate-900 border border-slate-700 p-3 rounded-lg mr-auto max-w-[85%] text-slate-200 text-xs leading-relaxed">
                ❄️ <strong>Snowflake AI:</strong><br>${escapeAIHtml(data.reply).replace(/\n/g, '<br>')}
            </div>
        `;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

    } catch (error) {
        console.error('Error connecting to chat backend:', error);
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        
        messagesContainer.innerHTML += `
            <div class="bg-red-900/50 p-3 rounded-lg mr-auto max-w-[85%] text-white text-xs">
                ⚠️ ${escapeAIHtml(error.message || 'Could not reach the assistant. Make sure the server is running.')}
            </div>
        `;
    }
}

function escapeAIHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}
