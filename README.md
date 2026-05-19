# SmartBuild

SmartBuild is an AI/ML-based Random Forest decision support system for custom PC recommendation.  
It collects user requirements, generates a component list, and reports compatibility issues.

## Tech Stack

- Backend: FastAPI (Python)
- Frontend: React + Next.js (TypeScript)
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
cd backend
pip install -r requirements.txt
cd ..
```

### 4) Install frontend dependencies

```bash
cd client
npm install
cd ..
```

## Run the Project

Run backend and frontend in separate terminals. Ensure your Python virtual environment is activated in the backend terminal.

### Backend (FastAPI)

```bash
cd backend
uvicorn main:app --reload
```

Backend URLs:
- API root: `http://127.0.0.1:8000/`
- API docs: `http://127.0.0.1:8000/docs`

### Frontend (Next.js)

```bash
cd client
npm run dev
```

Frontend URL:
- App: `http://localhost:3000/`

## Frontend Routes

- `/` - Landing page
- `/user-input` - User input form
- `/build-result` - Generated custom PC component list

## Current User Flow

1. Open landing page (`http://localhost:3000/`).
2. Click **Start recommendation**.
3. Fill required fields on **User Input**:
   - Minimum budget & Maximum budget
   - Primary Activity (e.g., Gaming, Video Editing)
   - Secondary Activity (Optional)
   - Longevity expectation
   - Open to future upgrades (Yes/No)
4. Click **Generate Build** to calculate and open `/build-result`.
5. Review the recommended custom PC component list along with compatibility reports.

## Build Frontend for Production

```bash
cd client
npm run build
npm start
```