@echo off
echo ========================================================
echo Starting AutomataX Backend Server (FastAPI + Uvicorn)...
echo ========================================================
cd /d %~dp0\backend
venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
