# Secure deployment: GitHub Pages and Google Cloud Run

The management app is published at `https://dstransformers.github.io/`. The public business website remains available at `/staticpage/`. The Spring API runs as a Cloud Run service. Only health checks and public enquiry submissions are anonymous. All management endpoints require a verified Firebase ID token whose email is on the server-side `ADMIN_EMAILS` allowlist.

## 1. Configure Firebase Authentication

1. In Firebase Console, create or select a project and register a Web app.
2. Enable **Authentication → Sign-in method → Google** (and **Email/Password** if password login is also needed).
3. Under **Authentication → Settings → Authorized domains**, add `dstransformers.github.io` and `localhost` for local development.
4. Create/allow each administrator Google account and ensure its email matches the backend `ADMIN_EMAILS` allowlist. The backend requires the email to be verified.
5. Copy the Web app's API key, auth domain, project ID, and app ID into `frontend/.env.production` using `frontend/.env.example` as the template.

Firebase web configuration is public client configuration, not a server secret. Restrict its API key to the required Firebase APIs and HTTP referrers in Google Cloud Console. The API independently enforces the administrator allowlist.

## 2. Deploy the API to Cloud Run

Install and authenticate the Google Cloud CLI, select a project with billing enabled, and enable Cloud Run / Cloud Build:

```powershell
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

Deploy from the repository root. Replace the project ID, administrator email(s), and Apps Script URL with the values for the production environment:

```powershell
gcloud run deploy vstms-api `
  --source .\backend `
  --region asia-south1 `
  --allow-unauthenticated `
  --min 0 `
  --max 3 `
  --memory 1Gi `
  --cpu 1 `
  --set-env-vars "FIREBASE_PROJECT_ID=YOUR_GCP_PROJECT_ID,ADMIN_EMAILS=admin@example.com,GOOGLE_APPS_SCRIPT_URL=YOUR_APPS_SCRIPT_WEB_APP_URL,CORS_ALLOWED_ORIGINS=https://dstransformers.github.io,http://localhost:5173,http://127.0.0.1:5173"
```

`--allow-unauthenticated` allows the browser to reach the API; it does **not** grant access to management data. Firebase ID tokens and the backend allowlist protect those endpoints. The health check and `POST /api/enquiries` are intentionally public. Never put admin passwords or service-account keys in frontend files, Git, or build arguments.

Copy the Cloud Run service URL printed by the deploy command. Verify `https://YOUR_CLOUD_RUN_URL/api/health` returns `{"status":"UP",...}`. A request to a protected endpoint without a Firebase token must return HTTP 401.

Cloud Run requires a billing-enabled project. Set a billing budget/alerts in Google Cloud Billing; the free tier is usage-based and does not prevent charges after its allowance is exceeded.

## 3. Build and publish the management app

Set the Firebase Web app values and Cloud Run URL in `frontend/.env.production`:

```dotenv
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-gcp-project-id
VITE_FIREBASE_APP_ID=your-firebase-web-app-id
VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_URL
```

Then from `frontend/`:

```powershell
npm ci
npm run build:pages
```

The build script copies the generated app to the repository root. Commit and push the updated root bundle and source changes to `main`; GitHub Pages will publish the management UI at `/`. The public business website remains available at `/staticpage/`, and `/admin/` redirects to `/`. Rebuild after any frontend change. Do not commit `.env.production`.

## Local development

Copy `frontend/.env.example` to `frontend/.env.local` and set the Firebase web configuration. Set the backend's `FIREBASE_PROJECT_ID` and `ADMIN_EMAILS` environment variables, and authenticate local Firebase Admin SDK verification with Application Default Credentials (`gcloud auth application-default login`). Continue to use the Vite API proxy for local calls by leaving `VITE_API_BASE_URL` unset.
