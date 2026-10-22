@echo off
setlocal
cd /d "%~dp0"

if defined JAVA_HOME if not exist "%JAVA_HOME%\bin\java.exe" set "JAVA_HOME="

if not defined JAVA_HOME if exist "%ProgramFiles%\Java\jdk-17\bin\java.exe" (
  set "JAVA_HOME=%ProgramFiles%\Java\jdk-17"
)

if defined JAVA_HOME (
  set "PATH=%JAVA_HOME%\bin;%PATH%"
) else if not exist "%ProgramFiles%\Java\jdk-17\bin\java.exe" (
  where java > nul 2>&1
  if errorlevel 1 (
    echo Java 17 or newer was not found. Install a JDK and set JAVA_HOME before starting VSTMS.
    exit /b 1
  )
)

java -version > nul 2>&1
if errorlevel 1 (
  echo Java could not be started. Check JAVA_HOME and PATH.
  exit /b 1
)
for /f "tokens=2,3" %%A in ('java -version 2^>^&1 ^| findstr /i "version"') do if "%%B"=="" (set "JAVA_VERSION=%%~A") else set "JAVA_VERSION=%%~B"
for /f "tokens=1 delims=." %%V in ("%JAVA_VERSION%") do set "JAVA_MAJOR=%%~V"
if not defined JAVA_MAJOR (
  echo Could not determine the Java version. Install JDK 17 or newer.
  exit /b 1
)
if %JAVA_MAJOR% LSS 17 (
  echo Java 17 or newer is required. Detected Java %JAVA_MAJOR%.
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

if defined GOOGLE_APPLICATION_CREDENTIALS (
  if not exist "%GOOGLE_APPLICATION_CREDENTIALS%" (
    echo GOOGLE_APPLICATION_CREDENTIALS points to a file that does not exist.
    exit /b 1
  )
) else if not exist "%APPDATA%\gcloud\application_default_credentials.json" (
  echo Firebase Admin verification needs Google Application Default Credentials.
  echo Run: gcloud auth application-default login
  exit /b 1
)

if not defined FIREBASE_PROJECT_ID for /f "usebackq tokens=1,* delims==" %%A in ("frontend\.env.local") do if "%%A"=="VITE_FIREBASE_PROJECT_ID" set "FIREBASE_PROJECT_ID=%%B"
if not defined FIREBASE_PROJECT_ID (
  echo VITE_FIREBASE_PROJECT_ID is missing from frontend\.env.local.
  exit /b 1
)

set "GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbwmKqM-u7oaj-GlYY-y709_3AbzbQshadqsCS95MuiPkWNbkhPkE1sTyeLbk_Fvml5Qmw/exec"
set "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,https://dstransformers.github.io"

curl.exe -fsS --max-time 2 http://localhost:8082/api/health > nul
if errorlevel 1 (
  echo Starting VSTMS backend on http://localhost:8082
  start "VSTMS Backend" /D "%~dp0backend" cmd /k mvnw.cmd spring-boot:run
  set "WAIT_COUNT=0"
  goto wait_for_backend
) else (
  echo VSTMS backend is already running on http://localhost:8082
)
goto backend_ready

:wait_for_backend
set /a WAIT_COUNT+=1
curl.exe -fsS --max-time 2 http://localhost:8082/api/health > nul 2>&1
if not errorlevel 1 goto backend_ready
if %WAIT_COUNT% GEQ 30 (
  echo Backend did not become ready. Check the VSTMS Backend window for errors.
  exit /b 1
)
timeout /t 2 /nobreak > nul
goto wait_for_backend

:backend_ready
curl.exe -fsS --max-time 2 http://127.0.0.1:5174/ > nul
if errorlevel 1 (
  echo Starting VSTMS frontend on http://localhost:5174
  start "VSTMS Frontend" /D "%~dp0frontend" cmd /k npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
  set "WAIT_COUNT=0"
  goto wait_for_frontend
) else (
  echo VSTMS frontend is already running on http://localhost:5174
)
goto frontend_ready

:wait_for_frontend
set /a WAIT_COUNT+=1
curl.exe -fsS --max-time 2 http://127.0.0.1:5174/ > nul 2>&1
if not errorlevel 1 goto frontend_ready
if %WAIT_COUNT% GEQ 30 (
  echo Frontend did not become ready. Check the VSTMS Frontend window for errors.
  exit /b 1
)
timeout /t 2 /nobreak > nul
goto wait_for_frontend

:frontend_ready
start "" http://localhost:5174

echo Local app: http://localhost:5174
echo Local API health: http://localhost:8082/api/health
echo Local backend writes go to the configured Google Sheet.
echo If Apps Script requires its shared secret, set GOOGLE_APPS_SCRIPT_SHARED_SECRET before running this file.
