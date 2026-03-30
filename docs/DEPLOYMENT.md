# MedScribe Deployment Guide

## Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL (production) or SQLite (development)
- Anthropic API key for Claude integration

## Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env` in both root and frontend directories
3. Set all required environment variables (especially `SECRET_KEY` and `ANTHROPIC_API_KEY`)

## Backend Deployment (Render)

1. Create a new Web Service on Render
2. Connect to the GitHub repository
3. Set build command: `cd backend && pip install -r requirements.txt`
4. Set start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from `.env.example`
6. Enable auto-deploy from main branch

## Frontend Deployment (Netlify)

1. Create a new site on Netlify
2. Connect to the GitHub repository
3. Set build directory: `frontend`
4. Set build command: `npm run build`
5. Set publish directory: `frontend/dist`
6. Add environment variable: `VITE_API_BASE_URL=https://your-backend.onrender.com`

## Database

### Development
SQLite is used by default — no setup needed.

### Production
Set `DATABASE_URL` to your PostgreSQL connection string:
```
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/medscribe
```

Run the initialization script:
```bash
python scripts/init_db.py
```

## Security Checklist for Production

- [ ] Change `SECRET_KEY` to a random 64-character string
- [ ] Set `ENVIRONMENT=production`
- [ ] Set `DEBUG=false`
- [ ] Configure `CORS_ORIGINS` to only allow your frontend domain
- [ ] Enable HTTPS on both backend and frontend
- [ ] Set up PostgreSQL with encryption at rest
- [ ] Configure data retention policies
- [ ] Verify no PHI in application logs
- [ ] Test rate limiting on auth endpoints
- [ ] Run security dependency scan

## Termux Mobile Push Workflow

See Section 6.5 of the Implementation Specification for the complete
Termux-based GitHub push workflow for mobile development.
