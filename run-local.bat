@echo off
setlocal
cd /d "%~dp0"

if exist "%ProgramFiles%\Java\jdk-17\bin\java.exe" (
  set "JAVA_HOME=%ProgramFiles%\Java\jdk-17"
  set "PATH=%JAVA_HOME%\bin;%PATH%"
) else (
  echo Java 17 was not found at %ProgramFiles%\Java\jdk-17. Install JDK 17 before starting VSTMS.
  exit /b 1
)

if not exist "frontend\.env.local" (
  echo Missing frontend\.env.local. Add Firebase web settings before starting VSTMS.
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo Frontend dependencies are missing. Run: cd frontend ^&^& npm ci
  exit /b 1
)

if not exist "frontend\.env.development.local" (
  > "frontend\.env.development.local" echo VITE_API_BASE_URL=
)

if not exist "%APPDATA%\gcloud\application_default_credentials.json" (
  echo Firebase admin verification needs Google Application Default Credentials.
  echo Run: gcloud auth application-default login
  exit /b 1
)

set "FIREBASE_PROJECT_ID=vs-transformers-quotation"
set "ADMIN_EMAILS=ds.transformerelectrical@gmail.com"

set "GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbwmKqM-u7oaj-GlYY-y709_3AbzbQshadqsCS95MuiPkWNbkhPkE1sTyeLbk_Fvml5Qmw/exec"
set "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,https://dstransformers.github.io"

curl.exe -fsS --max-time 2 http://localhost:8082/api/health > nul
if errorlevel 1 (
  echo Starting VSTMS backend on http://localhost:8082
  start "VSTMS Backend" /D "%~dp0backend" cmd /k mvnw.cmd spring-boot:run
) else (
  echo VSTMS backend is already running on http://localhost:8082
)

timeout /t 5 /nobreak > nul

curl.exe -fsS --max-time 2 http://127.0.0.1:5174/ > nul
if errorlevel 1 (
  echo Starting VSTMS frontend on http://localhost:5174
  start "VSTMS Frontend" /D "%~dp0frontend" cmd /k npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
) else (
  echo VSTMS frontend is already running on http://localhost:5174
)

echo Local app: http://localhost:5174
echo Local API health: http://localhost:8082/api/health
echo Local backend writes go to the live Google Sheet.
