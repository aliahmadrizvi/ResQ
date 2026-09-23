// Initialize mock data if nothing exists in localStorage
function initData() {
    if (!localStorage.getItem('resq_incidents')) {
        const mockIncidents = [
            {
                id: 'RESQ-9102',
                type: '🔥 Fire',
                location: 'Block B, 2nd Floor',
                time: '10 mins ago',
                severity: 'Critical',
                status: 'Responder Needed',
                description: 'Smoke reported coming from the chemistry lab.',
                reporterName: 'Ahad Rizvi',
                reporterPhone: '+91 9876543210',
                photos: []
            },
            {
                id: 'RESQ-4481',
                type: '🏥 Medical',
                location: 'Library Ground Floor',
                time: '25 mins ago',
                severity: 'High',
                status: 'Responding',
                description: 'Student feeling dizzy and fainted.',
                reporterName: 'Anonymous',
                reporterPhone: '',
                photos: []
            }
        ];
        localStorage.setItem('resq_incidents', JSON.stringify(mockIncidents));
    }
}

function getIncidents() {
    return JSON.parse(localStorage.getItem('resq_incidents')) || [];
}

function addIncident(incident) {
    const incidents = getIncidents();
    incidents.unshift(incident); // Add to top
    localStorage.setItem('resq_incidents', JSON.stringify(incidents));
}

function updateStatus(id, newStatus) {
    const incidents = getIncidents();
    const index = incidents.findIndex(inc => inc.id === id);
    if (index !== -1) {
        incidents[index].status = newStatus;
        localStorage.setItem('resq_incidents', JSON.stringify(incidents));
    }
}
// Add this to the very bottom of app.js

function clearSystemData() {
    if(confirm("⚠️ Hackathon Reset: Are you sure you want to delete all incidents and clear the storage?")) {
        localStorage.removeItem('resq_incidents');
        initData(); // Reload the 2 default fake incidents
        window.location.href = 'index.html'; // Kick back to dashboard
    }
}
// SECURITY & ROLE MANAGEMENT
function enforceRoleAccess() {
    const role = localStorage.getItem('resq_role') || 'citizen'; 
    
    const responderLink = document.getElementById('nav-responder');
    const reportLink = document.getElementById('nav-report');
    
    if (role === 'citizen') {
        if (responderLink) responderLink.style.display = 'none';
        
        // Kick citizen out of responder dashboard
        if (window.location.pathname.includes('responder.html')) {
            window.location.href = 'index.html';
        }
    } 
    else if (role === 'responder') {
        if (reportLink) reportLink.style.display = 'none';
    }
}

initData();
document.addEventListener('DOMContentLoaded', enforceRoleAccess);