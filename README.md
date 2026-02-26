# Resume from Job Description

Generate a tailored resume (text, Word, PDF) from a job description using your base resume and Claude (Anthropic).  
**Backend:** FastAPI · **Frontend:** React (Vite)

---

## Project structure

```
resume/
├── app/                          # Backend (FastAPI)
│   ├── main.py                   # App entry: CORS, router registration
│   ├── core/                     # Config, database
│   │   ├── config.py             # Paths, prompts, base templates
│   │   └── database.py           # SQLAlchemy engine, sessions
│   ├── models/                   # SQLAlchemy models
│   │   └── profile.py
│   ├── schemas/                  # Pydantic request/response models
│   ├── routers/                  # API routes
│   │   ├── health.py             # GET /api/health
│   │   ├── options.py            # GET /api/options
│   │   ├── profile.py            # Profiles CRUD
│   │   ├── analyze.py            # POST /api/analyze
│   │   └── generate.py           # POST /api/generate
│   ├── services/
│   │   ├── resume_service.py     # Generate + save logic
│   │   └── docx_builder.py       # Word document builder
│   ├── job_analyzer.py           # Remote/clearance detection
│   └── generation.py             # Claude resume tailoring (Anthropic)
├── scripts/                      # Standalone CLI scripts
│   └── fetch_jobs.py             # Greenhouse Harvest API (jobs/job descriptions)
├── frontend/                     # React (Vite) SPA
│   └── src/
│       ├── api/                  # API client
│       ├── lib/                  # Utilities
│       ├── hooks/                # useGenerateResume
│       └── features/ResumeGenerator/
├── data/                         # Runtime data (git-friendly)
│   ├── base/                     # base1.txt = base resume
│   └── <num>_<company>/         # Per job: jd.txt, context.txt, *.docx, *.pdf
├── .env                          # Secrets and config (see below)
├── run.py                        # Run backend + frontend: python run.py (from root)
├── requirements.txt
└── README.md
```

---

## Setup

### 1. Backend (Python)

From the **project root**:

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
```

### 2. Environment

Create a `.env` file in the project root:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | API key for Claude (resume generation) |
| `GENERATION_MODEL` | No | Default: `claude-opus-4-6` |
| `GENERATION_TEMPERATURE` | No | Default: `0.3` |
| `GENERATION_TOP_P` | No | Alternative to temperature |

Optional (for `scripts.fetch_jobs`): `GREENHOUSE_CLIENT_ID`, `GREENHOUSE_CLIENT_SECRET`, or `GREENHOUSE_API_KEY`.

### 3. Base resume templates

**Eligibility:** Only **remote** jobs with **no security clearance** are processed. Others return a 400 error.

**Tech stack → template:** The app detects the major tech stack from the job description:

| Stack            | Trigger keywords |
|------------------|------------------|
| ai_ml            | ML, TensorFlow, PyTorch, NLP, LLM, generative AI |
| data_scientist   | Data science, pandas, scikit-learn, statistical modeling |
| python_full_stack| Python + React/Vue/Angular or full stack |
| python_backend   | Python, Django, Flask, FastAPI |
| node_full_stack  | Node.js + React/Vue/Angular or full stack |
| node_backend     | Node.js, Express, NestJS, TypeScript |
| react_frontend   | React/Vue/Angular + frontend |
| dotnet_full_stack| C#/.NET + React/frontend |
| dotnet_backend   | C#, .NET, ASP.NET, Blazor |
| java_full_stack  | Java + React/frontend |
| java_backend     | Java, Spring Boot, Kotlin, Scala |
| mobile           | iOS, Android, React Native, Flutter |
| devops           | DevOps, SRE, Kubernetes, Terraform |
| go_backend, php, ruby, rust | As indicated |

Place base templates in `data/base/`:

```
data/base/base1.txt   # Python stack (required)
data/base/base2.txt   # Java stack (optional)
data/base/base3.txt   # .NET stack (optional)
...
```

If a stack's base file doesn't exist, `base1.txt` is used. Use the exact structure expected by the app (name, title, contact, PROFILE, WORK EXPERIENCE, EDUCATION, CERTIFICATIONS).

### 4. Frontend (React)

```bash
cd frontend
npm install
```

---

## Run

**Important:** Always run commands from the **project root** (`D:\Work\Work\resume`), not from inside `app/`. If you get `ModuleNotFoundError: No module named 'app'` or `No module named 'app.routers'`, you are in the wrong directory—go back to the project root.

### Both backend and frontend (recommended)

From **project root** (with venv activated and `npm install` already run in `frontend/`):

```bash
python run.py
```

This starts:
- **Backend:** http://localhost:8000
- **Frontend:** http://localhost:5173 (proxies `/api` to the backend)

Press **Ctrl+C** to stop both.

If `frontend/package.json` is missing, only the backend is started.

### Backend only

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API base: `http://localhost:8000`
- Endpoints:
  - `GET /api/health` — health check
  - `POST /api/generate` — body: `{ "job_description": "..." }` → resume text + base64 docx/pdf + filenames

### Frontend only

From **project root** (second terminal):

```bash
cd frontend
npm run dev
```

- App: `http://localhost:5173`
- Start the backend first so the proxy works.

**If you previously ran `pip install app`:** uninstall it so the local `app` package is used: `pip uninstall app -y`

---

## Data layout (per job)

For each “Generate resume” run, the backend creates a directory:

```
data/<number>_<company>/
├── jd.txt                        # Job description
├── context.txt                   # Tailored resume (plain text)
├── <Firstname>_<Lastname>_resume.docx
└── <Firstname>_<Lastname>_resume.pdf   # If Word is available (e.g. Windows)
```

`<number>` is the next free id; `<company>` is derived from the job description (e.g. “At Acme Corp” → `Acme_Corp`).

---

## Scripts (optional)

Run from **project root** with the same venv.

### Resume generation (CLI, no API)

Generate `data/1/context.txt` from `data/base/base1.txt` and `data/1/jd.txt`:

```bash
python -m app.generation
```

Build `data/1/resume.docx` from `data/1/context.txt`:

```bash
python -m app.services.docx_builder
```

### Greenhouse job fetch

Requires Greenhouse credentials in `.env`:

```bash
python -m scripts.fetch_jobs              # Fetch jobs
python -m scripts.fetch_jobs descriptions  # Fetch job descriptions
python -m scripts.fetch_jobs posts        # Same as descriptions
```

---

## Best practices used

- **Backend:** Single `app` package; config vs routes vs services vs schemas; Pydantic for API contracts; all resume logic under `app/`.
- **Frontend:** API layer, shared lib, custom hook, feature-based UI with CSS modules.
- **Scripts:** Under `scripts/` with `.env` loaded from project root; run via `python -m scripts.<name>`.
- **Data:** Under `data/` at project root; no secrets in repo; one directory per job with predictable names.
