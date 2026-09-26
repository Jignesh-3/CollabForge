# ⚡ CollabForge

> High-performance squad recruitment and dossier management platform built for competitive hackathons.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org)
[![Firebase](https://img.shields.io/badge/Firebase-Admin%20%26%20Storage-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com)

[Live Demo](#) · [API Documentation](#) · [Report Bug](#)

---

## 📌 Problem & Solution

In rapid-fire hackathons, finding complementary technical teammates is inefficient and scattered across unorganized chat channels. 

**CollabForge** provides an end-to-end recruitment engine featuring cryptographic identity verification, real-time application pipelines, and dynamic candidate dossier matching.

---

## 🛠️ System Architecture & Engineering Highlights

```text
[ Vanilla JS Client / UI ] 
        │ 
        │ (1) Firebase Bearer ID Token
        ▼
[ FastAPI Application Layer ] ◄── (2) Cryptographic Verification (Firebase Admin SDK)
        │
        │ (3) Firebase Admin SDK / Data & Storage Engine
        ▼
[ Firebase Cloud Services ] (Auth, Firestore / Database, Firebase Storage)

Zero-Trust Backend Auth: Every mutating route cryptographically verifies Firebase ID tokens server-side using the Firebase Admin SDK. User identity is derived strictly from verified token claims, preventing client spoofing.

Unified Firebase Ecosystem: Seamless integration across Firebase Client and Admin SDKs, handling authentication, document persistence, and binary storage without complex standalone database infrastructure.

Race-Condition-Resilient Client: Centralized apiClient service layer queues requests and handles Bearer token injection, preventing duplicate token fetches on rapid actions.

Roster Lifecycle Management: Implements clean cascade behaviors for squad disbanding (DELETE /api/squads/{id}) and real-time application status workflows (pending ➔ accepted / rejected).

Onboarding Telemetry: Built-in empty-state evaluator monitors user profile completeness and squad participation to guide new operatives directly to uncompleted actions.

## 📡 Key API Endpoints

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/squads` | No | Fetch active squads with tech-stack filtering |
| `POST` | `/api/squads` | Yes (Bearer) | Initialize and deploy a new squad roster |
| `PATCH` | `/api/squads/{id}` | Yes (Lead only) | Update roster parameters and open roles |
| `DELETE` | `/api/squads/{id}` | Yes (Lead only) | Cascade disband squad and notify       members |
| `POST` | `/api/applications` | Yes (Bearer) | Submit candidate pitch for an open role |
| `POST` | `/api/applications/{id}/withdraw` | Yes (Applicant) | Withdraw pending squad pitch |

📁 Repository StructurePlaintext├── app/                  # FastAPI backend application
│   ├── routers/          # Modular API endpoints (squads, applications, profile)
│   ├── schemas/          # Pydantic validation models
│   ├── core/             # Auth middleware & Firebase Admin initialization
│   └── main.py           # Application entrypoint & CORS middleware
├── frontend/             # Client-side single-page application
│   ├── api.js            # Centralized API service & token manager
│   ├── app.js            # Session state controller & DOM renderers
│   ├── index.html        # Semantic dashboard layout
│   └── styles.css        # Cyberpunk tactical UI theme
├── requirements.txt      # Backend dependency manifest
├── .gitignore            # Secret & credential isolation rules
└── README.md

🚀 Local Development Setup

1. Prerequisites Python 3.10+Firebase project with Authentication & Storage enabled
2. Backend InstallationBash# Clone the repository
git clone [https://github.com/](https://github.com/)<Jignesh-3>/CollabForge.git
cd CollabForge

# Set up virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

3. Environment ConfigurationCreate a .env file in the project root:Code snippetFIREBASE_CREDENTIALS_PATH=firebase_credentials.json
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
SECRET_KEY=your_development_secret_key
Ensure your firebase_credentials.json service account file is placed in the root directory (enforced via .gitignore).

4. Run ApplicationBash# Start API server
uvicorn app.main:app --reload --port 8000

# In a new terminal, serve the frontend
cd frontend
python -m http.server 5500
Interactive Swagger documentation is available at: http://localhost:8000/docs.📄 LicenseDistributed under the MIT License.