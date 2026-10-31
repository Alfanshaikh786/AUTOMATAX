@echo off
echo ========================================================
echo Starting AutomataX Frontend (React + Vite + Tailwind)...
echo ========================================================
cd /d %~dp0\frontend
npm run dev -- --host 127.0.0.1
