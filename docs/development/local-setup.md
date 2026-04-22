# Local Setup

## Requirements

- Python 3.11+
- Node.js 18+
- PostgreSQL
- Redis recommended

## Steps

1. Copy `.env.example` to `.env`
2. Configure local values for database, auth, Gmail, Telegram, and AI settings
3. Install backend dependencies:
   - `pip install -r requirements.txt`
4. Install frontend dependencies:
   - `cd frontend && npm install`
5. Start the backend:
   - `uvicorn app.main:app --reload`
6. Start the frontend:
   - `cd frontend && npm run dev`

## Local URLs

- frontend dev server: `http://localhost:5173`
- backend dev server: `http://127.0.0.1:8000`

## First-Run Notes

- database tables are initialized by backend startup
- admin user is created from configured admin credentials if missing
- Gmail OAuth requires local credentials configuration before full testing
