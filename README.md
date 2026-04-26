# SmartBuild

## Project Overview
SmartBuild is a project designed to provide compatibility and recommendation services. It includes a backend built with FastAPI and a frontend for user interaction.

---

## Prerequisites
Before setting up the project, ensure you have the following installed:

1. **Python 3.11**
   - Download and install Python from [python.org](https://www.python.org/downloads/).
   - Ensure `pip` is installed along with Python.

2. **Git**
   - Download and install Git from [git-scm.com](https://git-scm.com/).

3. **Virtual Environment (venv)**
   - Python's built-in `venv` module is used to create isolated environments.

4. **Node.js and npm** (if the frontend requires additional setup)
   - Download and install Node.js from [nodejs.org](https://nodejs.org/).

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd SmartBuild
```

### 2. Create and Activate a Virtual Environment
#### On Windows:
```bash
python -m venv smartbuild-env
smartbuild-env\Scripts\activate
```

#### On macOS/Linux:
```bash
python3 -m venv smartbuild-env
source smartbuild-env/bin/activate
```

### 3. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 4. Install Frontend Dependencies (if applicable)
Navigate to the `frontend` directory and install dependencies:
```bash
cd frontend
npm install
```

### 5. Run the Backend Server
Navigate to the `backend` directory and start the FastAPI server:
```bash
cd backend
uvicorn main:app --reload
```

### 6. Access the Application
- Open your browser and navigate to `http://127.0.0.1:8000` for the backend API.
- If the frontend is set up, navigate to the appropriate URL for the frontend.

---

## Dependencies

### Python Packages
The following Python packages are required and will be installed via `pip`:
- `fastapi`
- `uvicorn`
- `pandas`
- `numpy`
- `scikit-learn`
- `joblib`
- `scipy`
- `pydantic`

### Node.js Packages
If the frontend requires additional setup, dependencies will be managed via `npm`.

---

## Notes
- Ensure your virtual environment is activated before running any Python commands.
- For any issues, refer to the documentation of the respective tools or libraries.