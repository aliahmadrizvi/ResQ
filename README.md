# 🚨 ResQ: Emergency Response & Coordination Platform

**"When things go wrong, know what to do next."**

ResQ is a modern, responsive frontend prototype built for hackathon problem statement **PS03 — When Things Go Wrong**. It bridges the critical gap between citizens experiencing emergencies and the dispatch responders managing them, ensuring rapid reporting, clear guidance, and seamless coordination. 

The core workflow is: **Report → Alert → Guide → Coordinate → Resolve**

---

## ✨ Key Features

*   **Role-Based Access Control (RBAC):** Two completely isolated interfaces. Open access for Citizens, and a secure, authenticated gateway for Responders.
*   **Fully Functional Local State:** Uses browser `localStorage` as a mock real-time database. Incidents reported by citizens instantly appear on the dispatcher's dashboard.
*   **Live Evidence Processing:** Upload photos as evidence. JavaScript `FileReader` converts images to Base64 strings, allowing them to be saved and viewed dynamically in the incident details modal.
*   **Dynamic Task Board:** Responders can filter emergencies, search by unique `RESQ-XXXX` IDs, and update incident statuses (Responding → Arrived → Resolved).
*   **Interactive Safety Guides:** Quick-access standard operating procedures (SOPs) for fires, accidents, medical crises, and floods.
*   **Location Intelligence:** Integrated Google Maps iframe for spatial awareness and one-click Google Maps routing to nearby hospitals and police stations.
*   **Responsive UI:** Built with Tailwind CSS to ensure a flawless experience on both desktop dashboards and mobile devices on the street.

---

## 🛠️ Tech Stack

This MVP is built to run instantly with zero backend dependencies or server setup, making it perfect for live hackathon judging.

*   **Frontend:** HTML5, Vanilla JavaScript (ES6+)
*   **Styling:** Tailwind CSS (via CDN)
*   **Data Management:** LocalStorage API (Mock Database)
*   **File Processing:** Base64 Encoding via FileReader API
*   **Icons:** Native Emojis (Zero-dependency fast loading)

---

## 🚀 How to Run the Demo

Because this project requires no backend or build tools, running it is instantaneous.

1.  Clone or download the repository.
2.  Ensure all 10 files are in the same folder.
3.  Open **`login.html`** in any modern web browser (Chrome, Edge, Firefox, Safari).

### Snowflake Cortex chat backend

The Cortex chat widget needs the Node.js bridge running separately. Copy `.env.example` to `.env`, enter your Snowflake connection values in `.env` (it is ignored by Git), then start the bridge from the repository root:

```powershell
Copy-Item .env.example .env
# Edit .env and fill in your Snowflake account, user, and password.
npm start
```

Optionally set `SNOWFLAKE_ROLE` and `SNOWFLAKE_CORTEX_MODEL`. The bridge exposes `/api/health` to report whether Snowflake is connected. The chat uses `http://localhost:3001` by default, so open the frontend on the same computer. Set `window.RESQ_API_BASE` before `app.js` if you use a different backend host or port.

### 🔐 Demo Credentials

To access the locked **Responder Portal** during the presentation, use the following credentials:
*   **Responder ID:** `admin`
*   **Password:** `admin123`

---

## 📁 File Structure

The architecture is divided into specialized views connected by a centralized state manager (`app.js`).

```text
/resq-app
│
├── app.js               # Central logic, local database initialization, and role security
├── login.html           # Authentication gateway and role selection (Start Here)
│
├── index.html           # Citizen Dashboard (Main landing page)
├── report.html          # Emergency reporting form with Base64 image upload
├── incidents.html       # Public feed of active incidents with search, filters, and modal gallery
├── guide.html           # Interactive safety protocols and standard operating procedures
├── map.html             # Embedded spatial map for situational awareness
├── nearby.html          # Quick-dial and GPS routing for nearby infrastructure
├── analytics.html       # Visual data dashboard for system metrics and resolution rates
│
└── responder.html       # Locked dispatcher board for incident management and status updates
