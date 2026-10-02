@echo off
echo Starting VSTMS Application...
echo.
echo Starting backend server...
start "Backend" cmd /k "cd backend && mvnw.cmd spring-boot:run"
timeout /t 10 /nobreak > nul
echo Starting frontend server...
start "Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo Application started successfully!
echo Backend: http://localhost:8082
echo Frontend: http://localhost:5173
echo.
pause