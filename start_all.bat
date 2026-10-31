@echo off
echo ========================================================
echo Starting AutomataX Laboratory (Backend + Frontend)...
echo ========================================================
start "AutomataX Backend" cmd /k "call %~dp0start_backend.bat"
start "AutomataX Frontend" cmd /k "call %~dp0start_frontend.bat"
echo.
echo AutomataX services are launching!
echo Frontend will be accessible at: http://127.0.0.1:5173
echo Backend API docs available at:  http://127.0.0.1:8000/docs
echo ========================================================

