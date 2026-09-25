
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
let incidentSnapshotInitialized = false;
let responderAudioContext = null;
let responseAlarmInterval = null;
let activeResponseAlarmMode = null;
let responseAlarmSoundTimer = null;

async function playResponderAlert(preview = false) {
    if (!preview && localStorage.getItem('resq_alert_sound') !== 'on') return false;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;
        if (!responderAudioContext || responderAudioContext.state === 'closed') {
            responderAudioContext = new AudioContextClass();
        }
        if (responderAudioContext.state !== 'running') await responderAudioContext.resume();

        const context = responderAudioContext;
        const playTone = (frequency, startAt, duration) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0.0001, startAt);
            gain.gain.exponentialRampToValueAtTime(0.28, startAt + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(startAt);
            oscillator.stop(startAt + duration + 0.02);
        };
        const startAt = context.currentTime + 0.02;
        playTone(880, startAt, 0.22);
        playTone(660, startAt + 0.28, 0.34);
        return true;
    } catch (error) {
        console.warn('Responder alert sound could not play.', error);
        return false;
    }
}

async function playResponseAlarm(isCritical) {
    if (localStorage.getItem('resq_alert_sound') !== 'on') return false;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;
        if (!responderAudioContext || responderAudioContext.state === 'closed') {
            responderAudioContext = new AudioContextClass();
        }
        if (responderAudioContext.state !== 'running') await responderAudioContext.resume();
        const context = responderAudioContext;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const duration = isCritical ? 0.48 : 0.32;
        oscillator.type = 'square';
        oscillator.frequency.value = isCritical ? 1046 : 740;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(isCritical ? 0.32 : 0.2, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration + 0.02);
        return true;
    } catch (error) {
        console.warn('Response escalation alarm could not play.', error);
        return false;
    }
}

function incidentCreatedAt(incident) {
    const value = incident.timestamp;
    const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function refreshResponseAlarms() {
    if (localStorage.getItem('resq_role') !== 'responder') return;
    const now = Date.now();
    const waiting = globalIncidents.filter(incident => !['Responding', 'Arrived', 'Resolved'].includes(incident.status))
        .map(incident => {
            const createdAt = incidentCreatedAt(incident);
            if (!createdAt) return null;
            const critical = incident.severity === 'Critical';
            const thresholdMs = 5000;
            return { incident, critical, overdue: now - createdAt.getTime() >= thresholdMs };
        })
        .filter(Boolean);
    const overdue = waiting.filter(item => item.overdue);
    const banner = document.getElementById('response-alarm-banner');
    const bannerText = document.getElementById('response-alarm-text');
    const bannerHelp = document.getElementById('response-alarm-help');
    if (banner) {
        const criticalCount = overdue.filter(item => item.critical).length;
        banner.classList.toggle('hidden', overdue.length === 0);
        banner.classList.toggle('response-alarm-critical', criticalCount > 0);
        banner.classList.toggle('response-alarm-standard', overdue.length > 0 && criticalCount === 0);
        if (bannerText) {
            bannerText.textContent = criticalCount
                ? `URGENT: ${criticalCount} critical report${criticalCount === 1 ? '' : 's'} unacknowledged after 5 seconds.`
                : `${overdue.length} report${overdue.length === 1 ? '' : 's'} unacknowledged after 5 seconds.`;
        }
        if (bannerHelp && overdue.length) {
            bannerHelp.textContent = localStorage.getItem('resq_alert_sound') === 'on'
                ? 'Accept the incident to acknowledge it and stop the repeating alarm.'
                : 'Accept the incident to acknowledge it. Enable sound alerts above to hear the repeating beep.';
        }
    }

    document.querySelectorAll('[data-incident-id]').forEach(card => {
        card.classList.remove('response-critical-overdue');
        const id = card.getAttribute('data-incident-id');
        if (overdue.some(item => item.critical && String(item.incident.id) === id)) {
            card.classList.add('response-critical-overdue');
        }
    });

    const alarmMode = overdue.some(item => item.critical) ? 'critical' : overdue.length ? 'standard' : null;
    if (alarmMode === activeResponseAlarmMode) return;
    activeResponseAlarmMode = alarmMode;
    if (responseAlarmSoundTimer) {
        clearInterval(responseAlarmSoundTimer);
        responseAlarmSoundTimer = null;
    }
    if (alarmMode && localStorage.getItem('resq_alert_sound') === 'on') {
        const isCritical = alarmMode === 'critical';
        playResponseAlarm(isCritical).then(playing => {
            if (playing && activeResponseAlarmMode === alarmMode && localStorage.getItem('resq_alert_sound') === 'on') {
                responseAlarmSoundTimer = setInterval(() => playResponseAlarm(isCritical), isCritical ? 1200 : 2400);
            }
        });
    }
}

window.toggleResponderAlerts = async function(button) {
    const enabled = localStorage.getItem('resq_alert_sound') === 'on';
    const audioUnlocked = responderAudioContext && responderAudioContext.state === 'running';
    if (enabled && audioUnlocked) {
        localStorage.setItem('resq_alert_sound', 'off');
        const alertStatus = document.getElementById('responder-alert-status');
        if (alertStatus) alertStatus.textContent = 'Sound alerts are off';
        if (responseAlarmSoundTimer) {
            clearInterval(responseAlarmSoundTimer);
            responseAlarmSoundTimer = null;
        }
    } else {
        localStorage.setItem('resq_alert_sound', 'on');
        const played = await playResponderAlert(true);
        const alertStatus = document.getElementById('responder-alert-status');
        if (alertStatus) alertStatus.textContent = played ? 'Sound enabled · test tone played' : 'Sound could not start · check browser audio settings';
        if (button) button.textContent = played ? '🔔 Sound alerts on' : '🔔 Retry sound setup';
        activeResponseAlarmMode = null;
        refreshResponseAlarms();
    }
    if (button) {
        const active = localStorage.getItem('resq_alert_sound') === 'on';
        button.textContent = active
            ? responderAudioContext?.state === 'running' ? '🔔 Sound alerts on' : '🔔 Retry sound setup'
            : '🔕 Enable sound alerts';
        button.setAttribute('aria-pressed', String(active));
    }
};


db.collection("incidents").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
    const newUrgentReports = incidentSnapshotInitialized && localStorage.getItem('resq_role') === 'responder'
        ? snapshot.docChanges().filter(change => {
            if (change.type === 'added') return change.doc.data().status !== 'Resolved';
            if (change.type !== 'modified') return false;
            const previous = globalIncidents.find(incident => incident.id === change.doc.id);
            return previous && Number(change.doc.data().reporterCount || 1) > Number(previous.reporterCount || 1);
        })
        : [];
    globalIncidents = [];
    snapshot.forEach((doc) => {
        globalIncidents.push({ ...doc.data(), id: doc.id });
    });

    if (newUrgentReports.length) {
        playResponderAlert();
        const alertStatus = document.getElementById('responder-alert-status');
        if (alertStatus) alertStatus.textContent = `${newUrgentReports.length} new report${newUrgentReports.length === 1 ? '' : 's'} · sorted by urgency`;
    }
    incidentSnapshotInitialized = true;
    
    // Auto-refresh UI functions if they exist on the current page
    if (typeof renderIncidents === "function") renderIncidents();
    if (typeof loadIncidents === "function") loadIncidents();
    if (typeof window.renderIncidentMap === "function") window.renderIncidentMap();
    if (typeof window.renderAnalytics === "function") window.renderAnalytics();
    refreshResponseAlarms();
    const feedStatus = document.getElementById('incident-feed-status');
    if (feedStatus) feedStatus.textContent = `Live updates connected · ${globalIncidents.length} report${globalIncidents.length === 1 ? '' : 's'} loaded`;
}, (error) => {
    console.error('Could not load incident reports:', error);
    const feedStatus = document.getElementById('incident-feed-status');
    const incidentList = document.getElementById('incident-list');
    if (feedStatus) feedStatus.textContent = `Incident feed unavailable: ${error.message || 'Could not connect to Firestore.'}`;
    if (incidentList) incidentList.innerHTML = '<p class="text-red-300 bg-red-950/40 border border-red-800 rounded-lg p-4">Could not load reports. Check your connection and Firestore access, then refresh this page.</p>';
});

if (!responseAlarmInterval) responseAlarmInterval = setInterval(refreshResponseAlarms, 1000);

// Fetch all incidents
function getIncidents() {
    return globalIncidents;
}

function normalizeIncidentValue(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

function sameIncidentLocation(first, second) {
    const firstHasCoordinates = Number.isFinite(Number(first.latitude)) && Number.isFinite(Number(first.longitude));
    const secondHasCoordinates = Number.isFinite(Number(second.latitude)) && Number.isFinite(Number(second.longitude));

    if (firstHasCoordinates && secondHasCoordinates) {
        const radians = (degrees) => degrees * Math.PI / 180;
        const latDifference = radians(Number(second.latitude) - Number(first.latitude));
        const lngDifference = radians(Number(second.longitude) - Number(first.longitude));
        const lat1 = radians(Number(first.latitude));
        const lat2 = radians(Number(second.latitude));
        const value = Math.sin(latDifference / 2) ** 2
            + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDifference / 2) ** 2;
        const distanceMeters = 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
        return distanceMeters <= 100;
    }

    const firstLocation = normalizeIncidentValue(first.location);
    return Boolean(firstLocation && firstLocation === normalizeIncidentValue(second.location));
}

async function findActiveDuplicateIncident(incident) {
    const snapshot = await db.collection('incidents').where('type', '==', incident.type).get();
    const normalizedType = normalizeIncidentValue(incident.type);
    const existing = snapshot.docs
        .map((doc) => ({ ...doc.data(), docRef: doc.ref }))
        .find((item) => item.status !== 'Resolved'
            && normalizeIncidentValue(item.type) === normalizedType
            && sameIncidentLocation(item, incident));

    return existing || null;
}

async function createReporterIdentity(name, phone) {
    const phoneDigits = String(phone ?? '').replace(/\D/g, '');
    const identity = phoneDigits.length >= 7
        ? `phone:${phoneDigits}`
        : `name:${normalizeIncidentValue(name)}`;
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function addReporterToIncident(incident, reporterId, report) {
    const originalReporterId = await createReporterIdentity(incident.reporterName, incident.reporterPhone);
    return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(incident.docRef);
        if (!snapshot.exists || snapshot.data().status === 'Resolved') {
            return { resolved: true };
        }

        const data = snapshot.data();
        const reporterIds = new Set(Array.isArray(data.reporterIds) ? data.reporterIds : []);
        if (reporterIds.size === 0) reporterIds.add(originalReporterId);

        const currentCount = Math.max(Number(data.reporterCount) || 1, reporterIds.size);
        if (reporterIds.has(reporterId)) {
            return { count: currentCount, alreadyReported: true };
        }

        reporterIds.add(reporterId);
        const count = currentCount + 1;
        const description = String(report.description || '').trim();
        const additionalReports = Array.isArray(data.additionalReports) ? data.additionalReports : [];
        const update = {
            reporterIds: Array.from(reporterIds),
            reporterCount: count,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (description) {
            update.additionalReports = [...additionalReports, {
                description,
                reporterName: String(report.reporterName || 'Anonymous').trim() || 'Anonymous',
                createdAt: new Date().toISOString()
            }];
        }
        transaction.update(incident.docRef, {
            ...update
        });
        return { count, alreadyReported: false };
    });
}

// Add a new incident (Called from report.html)
function addIncident(incident) {
    incident.timestamp = firebase.firestore.FieldValue.serverTimestamp(); 
    
    // Save to Firestore cloud database using the unique RESQ ID as document name
    return db.collection("incidents").doc(incident.id).set(incident);
}

// Update incident status (Called from responder.html)
function updateStatus(id, newStatus) {
    return db.collection("incidents").doc(id).update({
        status: newStatus
    })
    .catch(err => {
        console.error("Error updating incident status:", err);
        throw err;
    });
}

function enforceRoleAccess() {
    const role = localStorage.getItem('resq_role') || 'citizen'; 
    const responderLink = document.getElementById('nav-responder');
    const reportLink = document.getElementById('nav-report');
    const analyticsLink = document.getElementById('nav-analytics');
    const page = window.location.pathname.split('/').pop();
    
    if (role === 'citizen') {
        if (responderLink) responderLink.style.display = 'none';
        if (analyticsLink) analyticsLink.style.display = 'none';
        if (page === 'responder.html' || page === 'analytics.html') {
            window.location.href = 'index.html';
        }
    } 
    else if (role === 'responder') {
        if (reportLink) reportLink.style.display = 'none';
        if (page === 'responder.html' || page === 'analytics.html') return;
        if (page === 'index.html' || page === '') {
            window.location.href = 'responder.html';
            return;
        }
        if (page === 'report.html') window.location.href = 'responder.html';
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
