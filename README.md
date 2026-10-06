# SmartBuild — AI-Powered PC Advisor & Decision Support System

SmartBuild is an intelligent, machine-learning-driven decision support system designed to architect optimized, fully compatible custom PC builds tailored to user budgets, workloads, and preferences in the Philippine market.

Powered by a **Random Forest (v4)** model trained on live Philippine component catalog data and reinforced with an algorithmic 7-rule cascading compatibility engine, SmartBuild eliminates guesswork, socket mismatches, and bottlenecking for first-time builders and technician professionals alike.

---

## 🌟 Key Features

### 1. Dual Build Experiences
- **One-Tap Quick Build**: Generates a complete, optimized PC build in under two seconds based on budget, primary/secondary workloads, thermal preference, and target display resolution/refresh rate.
- **Guided Interactive Builder (`/guided-builder`)**: A step-by-step 9-category guided assembly path (CPU, Motherboard, RAM, GPU, Storage, PSU, Case, CPU Cooler, Case Fan). At each step, users are presented with 3 compatible, curated options (**Value**, **Recommended**, and **Performance**) with live technical specifications and tradeoff difference analyses.

### 2. Triple Build Comparison (`/build-result`)
- **Centerpiece Layout**: Displays the user's custom selection highlighted in the center, flanked by an **AI Value Alternative** (budget-optimized) on the left and an **AI Performance Alternative** (maximum compute throughput) on the right.
- **Side-by-Side Hardware Matrix**: Full component-level comparison table across all 3 configurations.
- **Descriptive Comparison Narrative**: AI-generated breakdown of architectural strengths, trade-offs, and clear verdict guidance.
- **Interactive Component Swapping**: All 3 builds allow users to swap any component to compatible alternative picks with real-time price and compatibility re-calculation.
- **Thermal Mismatch Advisory**: Automatic thermal throttling warning if an Air Cooler is paired with high-TDP (≥125W) CPUs, providing a 1-click swap to a recommended Liquid/AIO cooler.

### 3. Build Verification & Reliability Metrics
Evaluates builds across three essential performance parameters:
- **Budget Fit**: Adherence to the specified budget envelope with real-time utilization scoring.
- **Intended-Use Alignment**: Demand-weighted hardware score matching user workload intensity (e.g., Gaming, 3D Rendering, Machine Learning, Office).
- **Compatibility Reliability**: 100% pass verification against all physical and electrical constraints.

### 4. In-Store Reservation & Ticket System
- Generate verifiable store tickets with 6-character alphanumeric reference codes for local brick-and-mortar PC shops.
- Client-side PDF export with complete parts breakdown and hardware specifications (`html2canvas` + `jsPDF`).

### 5. Admin Portal (`/admin`)
- Secure token-based staff authentication.
- Real-time ticket management workflow (`PENDING`, `CONFIRMED`, `FULFILLED`, `CANCELLED`).
- Component catalog manager with live stock tracking and Supabase synchronization.

---

## ⚙️ Cascading Compatibility Engine

Every build is validated against 7 strict hardware rules:
1. **CPU ↔ Motherboard Socket**: Guarantees identical socket standard (e.g., AM4, AM5, LGA1700, LGA1200).
2. **RAM DDR Generation ↔ Motherboard**: Enforces DDR4 vs. DDR5 compatibility.
3. **RAM Capacity ↔ Motherboard Max Memory**: Ensures total installed memory does not exceed motherboard capacity limits.
4. **Motherboard Form Factor ↔ PC Case**: Verifies case clearance for ATX, Micro-ATX, Mini-ITX, and E-ATX standards.
5. **GPU Length Clearance**: Ensures graphics card length (mm) fits within maximum case GPU clearance.
6. **PSU Wattage & Headroom**: Calculates estimated system power draw `(CPU TDP + GPU Wattage) × 1.20 buffer` and requires adequate wattage rating.
7. **CPU Cooler Socket & Thermal Clearance**: Checks socket mounting compatibility and warns on thermal mismatch for high-heat chips.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python 3.11+), Uvicorn, Pydantic
- **Machine Learning**: Scikit-learn (Random Forest Regressor/Classifier v4), Pandas, NumPy
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Export & Utility**: jsPDF, html2canvas

---

## 📁 Project Structure

```text
SmartBuild/
├── backend/
│   ├── main.py                     # FastAPI application entrypoint & REST routes
│   ├── config.py                   # Global constants, hardware weights & Supabase keys
│   ├── model/
│   │   ├── train_model_v4.py       # Current Random Forest training script & scorers
│   │   ├── smartbuild_model.pkl    # Serialized model artifact
│   │   └── tier_boundaries.json    # Price-to-tier boundary mappings
│   ├── routers/
│   │   └── admin.py                # Admin portal tickets & inventory management endpoints
│   ├── services/
│   │   ├── builder_service.py      # Guided builder options, alternatives & comparison logic
│   │   ├── recommender.py          # Random Forest recommendation pipeline
│   │   ├── selector.py             # Component scoring & top-picks selection
│   │   ├── compatibility.py        # 7-rule hardware compatibility validator
│   │   └── supabase_service.py     # Live database queries & CRUD operations
│   └── requirements.txt
├── client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── user-input/         # 5-step preference & workload wizard
│   │   │   ├── guided-builder/     # 9-step interactive custom PC builder
│   │   │   ├── build-result/       # Triple configuration comparison & reservation modal
│   │   │   └── admin/              # Staff portal & inventory dashboard
│   │   └── lib/                    # API clients & session utilities
│   └── package.json
└── data/                           # Cleaned CSV component catalog datasets
```

---

## 🚀 Getting Started

### Prerequisites
- **Python**: 3.11 or newer
- **Node.js**: 18.x or newer
- **npm** or **yarn**

---

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables (`backend/.env`):
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-anon-or-service-role-key
   ADMIN_SECRET_KEY=your-jwt-or-admin-secret-key
   ```

5. (Optional) Retrain or verify model against live database:
   ```bash
   python model/train_model_v4.py
   ```

6. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   - API Root: `http://localhost:8000/`
   - Swagger Documentation: `http://localhost:8000/docs`

---

### 2. Frontend Setup

1. In a new terminal, navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure client environment variables (`client/.env.local`):
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. Launch Next.js development server:
   ```bash
   npm run dev
   ```
   - Application URL: `http://localhost:3000/`

---

## 🧭 Core Application Routes

| Route | Description |
|---|---|
| `/` | Landing page highlighting system capabilities, parts coverage, and user process. |
| `/user-input` | 5-step intake wizard (Budget range, Primary workload, Secondary workload, Preferred CPU cooling type, Target display). |
| `/guided-builder` | 9-step component selector with compatibility filtering and 3 tailored options per step. |
| `/build-result` | Triple configuration comparison page with component swapper and PDF export. |
| `/admin/login` | Secure administrator and staff portal sign-in. |
| `/admin` | Store reservation ticket manager and live hardware inventory table. |

---

## 🔌 Primary API Endpoints

- `POST /generate-build`: Generates full quick-recommendation build along with Value and Performance side comparisons.
- `POST /builder/category-options`: Fetches 3 filtered, compatible candidate options for a specific component category.
- `POST /builder/finalize-build`: Finalizes a custom guided build, attaches compatible swap alternatives, and produces side comparisons.
- `GET /api/admin/tickets`: Retrieves all customer store reservation tickets.
- `PATCH /api/admin/tickets/{ticket_id}`: Updates reservation status (`CONFIRMED`, `FULFILLED`, `CANCELLED`).
- `GET /api/admin/inventory`: Fetches live inventory levels across all 9 component categories.

---

## 📦 Production Build

To compile and optimize the frontend for production:
```bash
cd client
npm run build
npm start
```