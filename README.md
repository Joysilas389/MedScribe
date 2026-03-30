# MedScribe — AI-Powered Ambient Clinical Documentation Platform

> **Transform clinical conversations into polished medical notes — automatically.**

MedScribe listens to doctor–patient conversations in real time, extracts clinically relevant content, filters noise and small talk, and generates structured, professional clinical notes that physicians can review, edit, approve, and export as PDF.

## ⚕️ What MedScribe Is

- An AI-powered **clinical documentation copilot**
- A tool that **documents** what is said during clinical encounters
- A system that places the **physician in full control** of the final output

## 🚫 What MedScribe Is NOT

- NOT a clinical decision-maker
- NOT a diagnostic tool
- NOT a treatment recommender

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React/TS)                    │
│  Splash → Login → Dashboard → Encounter → Review → PDF  │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTPS / WebSocket (TLS 1.2+)
┌─────────────────▼───────────────────────────────────────┐
│                  Backend (FastAPI/Python)                 │
│  Auth → Audio → Transcription → NLP → Claude → Export    │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│              Data Layer (SQLite/PostgreSQL)               │
│  Encounters │ Users │ Notes │ Audit Logs │ Consent        │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env      # configure your environment
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env      # configure API URL
npm run dev
```

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | React 18, TypeScript, Tailwind CSS, Vite|
| Backend    | Python 3.11+, FastAPI, SQLAlchemy       |
| AI Engine  | Anthropic Claude API                    |
| Audio      | Web Audio API, WebSocket streaming      |
| PDF Export | ReportLab                               |
| Auth       | JWT (access + refresh tokens), bcrypt   |
| Database   | SQLite (dev) / PostgreSQL (prod)        |

## Security

- HTTPS enforced on all connections
- JWT with 15-minute access tokens and refresh rotation
- bcrypt password hashing
- RBAC: Physician, Nurse, Admin, System roles
- No PHI in logs, errors, or telemetry
- TLS 1.2+ for all data in transit
- Encryption at rest for stored encounter data
- Append-only immutable audit logs

## License

Proprietary — For internal development use only.
