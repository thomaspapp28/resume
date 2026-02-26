"""
Run both backend (FastAPI) and frontend (React) from project root.

  python run.py

- Backend: http://localhost:8000
- Frontend: http://localhost:5173 (proxies /api to backend)

Press Ctrl+C to stop both.
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

_BACKEND_PORT = 8000
_FRONTEND_PORT = 5173

_processes: list[subprocess.Popen] = []


def _kill_children(*args, **kwargs):
    for p in _processes:
        try:
            p.terminate()
            p.wait(timeout=5)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass
    sys.exit(0)


def main():
    global _processes

    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        str(_BACKEND_PORT),
        "--reload",
    ]
    frontend_dir = _ROOT / "frontend"
    if not (frontend_dir / "package.json").exists():
        print("Frontend not found (missing frontend/package.json). Running backend only.")
        import uvicorn
        uvicorn.run("app.main:app", host="0.0.0.0", port=_BACKEND_PORT, reload=True)
        return

    print("Starting backend (FastAPI) and frontend (React)...")
    print(f"  Backend:  http://localhost:{_BACKEND_PORT}")
    print(f"  Frontend: http://localhost:{_FRONTEND_PORT}")
    print("Press Ctrl+C to stop both.\n")

    # Start backend
    backend = subprocess.Popen(
        backend_cmd,
        cwd=str(_ROOT),
        stdout=sys.stdout,
        stderr=sys.stderr,
        env={**os.environ},
    )
    _processes.append(backend)
    time.sleep(1.5)

    # Start frontend (npm run dev) — use one string on Windows so shell finds npm
    frontend_cmd = "npm run dev" if os.name == "nt" else ["npm", "run", "dev"]
    frontend = subprocess.Popen(
        frontend_cmd,
        cwd=str(frontend_dir),
        shell=(os.name == "nt"),
        stdout=sys.stdout,
        stderr=sys.stderr,
        env={**os.environ},
    )
    _processes.append(frontend)
    time.sleep(2)
    if frontend.poll() is not None:
        print("\nFrontend failed to start (e.g. run 'cd frontend && npm install' first). Backend is still running.")

    signal.signal(signal.SIGINT, _kill_children)
    signal.signal(signal.SIGTERM, _kill_children)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, _kill_children)

    try:
        while True:
            if backend.poll() is not None:
                print("\nBackend exited. Stopping frontend...")
                break
            if frontend.poll() is not None:
                print("\nFrontend exited. Stopping backend...")
                break
            time.sleep(0.5)
    finally:
        _kill_children()


if __name__ == "__main__":
    main()
