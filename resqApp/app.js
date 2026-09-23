// app.js

// Initialize mock data if nothing exists in localStorage
function initData() {
    if (!localStorage.getItem('resq_incidents')) {
        const mockIncidents = [
            {
                id: 'INC-1001',
                type: '🔥 Fire',
                location: 'Block B, 2nd Floor',
                time: '10 mins ago',
                severity: 'Critical',
                status: 'Responder Needed',
                description: 'Smoke reported coming from the chemistry lab.'
            },
            {
                id: 'INC-1002',
                type: '🏥 Medical',
                location: 'Library Ground Floor',
                time: '25 mins ago',
                severity: 'High',
                status: 'Responding',
                description: 'Student feeling dizzy and fainted.'
            }
        ];
        localStorage.setItem('resq_incidents', JSON.stringify(mockIncidents));
    }
}

// Get all incidents
function getIncidents() {
    return JSON.parse(localStorage.getItem('resq_incidents')) || [];
}

// Add a new incident (Used on report.html)
function addIncident(incident) {
    const incidents = getIncidents();
    incidents.unshift(incident); // Add to top
    localStorage.setItem('resq_incidents', JSON.stringify(incidents));
}

// Update status (Used on responder.html)
function updateStatus(id, newStatus) {
    const incidents = getIncidents();
    const index = incidents.findIndex(inc => inc.id === id);
    if (index !== -1) {
        incidents[index].status = newStatus;
        localStorage.setItem('resq_incidents', JSON.stringify(incidents));
    }
}
// Add this to the BOTTOM of your app.js file

function enforceRoleAccess() {
    const role = localStorage.getItem('resq_role') || 'citizen'; // Default to citizen
    
    // Grab the nav links by their IDs (we will add these IDs in Step 3)
    const responderLink = document.getElementById('nav-responder');
    const analyticsLink = document.getElementById('nav-analytics');
    const reportLink = document.getElementById('nav-report');
    
    if (role === 'citizen') {
        // Citizens cannot see Responder Panel or Analytics
        if (responderLink) responderLink.style.display = 'none';
        if (analyticsLink) analyticsLink.style.display = 'none';
        
        // Security check: If a citizen tries to type 'responder.html' in the URL, kick them out
        if (window.location.pathname.includes('responder.html') || window.location.pathname.includes('analytics.html')) {
            window.location.href = 'index.html';
        }
    } 
    else if (role === 'responder') {
        // Responders don't need to report emergencies 
        if (reportLink) reportLink.style.display = 'none';
    }
}

// Run this on every single page load
document.addEventListener('DOMContentLoaded', enforceRoleAccess);

// Run initialization on every page load
initData();

