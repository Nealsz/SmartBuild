# SmartBuild

SmartBuild is an AI/ML-based Random Forest decision support system for custom PC recommendation.  
It collects user requirements, generates a component list, and reports compatibility issues.

## Tech Stack

- Backend: FastAPI (Python)
- Frontend: React + TypeScript + Vite
- Model: Random Forest (served by backend)

## Prerequisites

- Python 3.11+
- Node.js + npm
- Git

## Setup

### 1) Clone repository

```bash
git clone <repository-url>
cd SmartBuild
```

### 2) Create and activate Python virtual environment

Windows:

```bash
python -m venv smartbuild-env
smartbuild-env\Scripts\activate
```

macOS/Linux:

```bash
python3 -m venv smartbuild-env
source smartbuild-env/bin/activate
```

### 3) Install backend dependencies

```bash
pip install -r requirements.txt
```

### 4) Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

## Run the Project

Run backend and frontend in separate terminals.

### Backend (FastAPI)

```bash
uvicorn backend.main:app --reload
```

Backend URLs:
- API root: `http://127.0.0.1:8000/`
- API docs: `http://127.0.0.1:8000/docs`

### Frontend (Vite)

```bash
cd frontend
npm run dev
```

Frontend URL:
- App: `http://127.0.0.1:5173/`

## Frontend Routes

- `/` - Landing page
- `/user-input` - User input form
- `/build-result` - Generated custom PC component list

## Current User Flow

1. Open landing page.
2. Click **Start recommendation**.
3. Fill required fields on **User Input**:
   - Minimum budget
   - Maximum budget
   - Usage
   - Priority components (at least one)
4. (Optional) Set brand preferences per component.
5. Click **Generate Build** to open `/build-result`.

## Build Frontend for Production

```bash
cd frontend
npm run build
```

Build output is generated in `frontend/dist`.