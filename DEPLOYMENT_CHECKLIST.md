# VSTMS Deployment Checklist

## Phase 1: Google Apps Script Setup ✅

- [x] Google Apps Script code written (VSTMS_GoogleAppsScript.gs)
- [x] 5 Google Sheets created with headers:
  - [x] Enquiries Sheet
  - [x] Services Sheet  
  - [x] Jobs Sheet
  - [x] Transformers Sheet
  - [x] Bills Sheet

**REQUIRED ACTION:**
```
1. Open Google Sheet used for VSTMS
2. Click: Extensions → Apps Script
3. Replace code with VSTMS_GoogleAppsScript.gs content
4. In Apps Script, open Project Settings and enable "Show appsscript.json
   manifest file in editor". Replace the manifest with this repository's
   `appsscript.json`, then save both files. Its OAuth scopes are required for
   Sheets, Drive, Slides, and external requests.
5. In the Apps Script editor, select `authorizeVstmsAccess` and click Run.
   Sign in as the account that will own and execute the web app deployment
   and approve the requested Sheets and Drive scopes. This is a one-time
   authorization for the deployment account, not each VSTMS application user.
   The function saves the bound spreadsheet ID in script properties and opens
   it by ID to verify the Sheets permission required by web-app requests.
   This check also creates a uniquely named temporary text file in Drive and
   immediately trashes it to verify file creation permission.
6. Create a cryptographically random secret of at least 32 characters. Store it
   in Apps Script **Project Settings → Script Properties** as
   `VSTMS_BACKEND_SHARED_SECRET`. Store the same value in the backend's
   `GOOGLE_APPS_SCRIPT_SHARED_SECRET` environment variable or Secret Manager.
   Never put the secret in frontend code, a URL, or a committed file.
7. Deploy as Web App:
   - Click "Deploy" → "Manage deployments" → Edit → New version
   - Type: "Web app"
   - Execute as: "Me" (the account that authorized the script)
   - Who has access: "Anyone" (the Apps Script validates the backend secret;
     direct GET requests and unauthenticated POST requests do not access data)
8. Copy deployment URL
9. Verify URL matches application.properties:
   https://script.google.com/macros/s/AKfycbwmKqM-u7oaj-GlYY-y709_3AbzbQshadqsCS95MuiPkWNbkhPkE1sTyeLbk_Fvml5Qmw/exec
10. Verify a direct GET returns no sheet data and a POST without
    `integrationSecret` returns `Unauthorized request`.
11. Retire the legacy Apps Script deployment previously embedded in the public
    site (`AKfycbzrWX_cP6X7vh52AHN0pqz-njTVtPJFd4V7kkpc728I2kNcnnp-Hs7TxJRDPgEfLgCV`).
    The public site now sends enquiries to Spring; disable that old deployment
    after confirming it has no other consumers.
```

If the authorization error remains, confirm the deployed web app is configured
to execute as the same account that granted the scopes, and that the request URL
is the deployment whose new version was just created. Running the dropdown action
in the editor alone does not change an existing web-app deployment.
VSTMS users authenticate to the application; they do not grant Google Sheets
scopes. The Apps Script deployment must execute as the authorized deployment
owner. Reauthorization is only needed if the deployment owner changes, the
owner's spreadsheet access is revoked, or the script requests additional scopes.
If the deployed API still reports that `openById` is unauthorized after this
function completes successfully, the deployment is either running as a different
Google account or its authorization has not been granted under the account shown
in Apps Script. Verify the account, then create and deploy a new web-app version.

---

## Phase 2: Backend Configuration ✅

### Java Classes Created:
- [x] GoogleSheetsService.java (40+ methods)
- [x] EnquiryController.java (6 endpoints)
- [x] ServiceController.java (3 endpoints)
- [x] JobsController.java (3 endpoints)
- [x] TransformerController.java (2 endpoints)
- [x] BillController.java (3 endpoints)

### Configuration Files:
- [x] application.properties updated with Google Apps Script URL

**Location:** `backend/src/main/resources/application.properties`
```properties
google.apps.script.url=https://script.google.com/macros/s/AKfycbwmKqM-u7oaj-GlYY-y709_3AbzbQshadqsCS95MuiPkWNbkhPkE1sTyeLbk_Fvml5Qmw/exec
google.apps.script.shared-secret=${GOOGLE_APPS_SCRIPT_SHARED_SECRET}
```

Set `GOOGLE_APPS_SCRIPT_SHARED_SECRET` securely for the backend runtime. The
same secret must be configured in the Apps Script project's Script Properties.
For the public business website, set the `vstms-api-base-url` meta tag in
`staticpage/index.html` to the deployed Cloud Run service URL; its enquiry form
uses the public `POST /api/enquiries` endpoint and no longer calls Apps Script.

### Build & Run:
```bash
cd backend
mvn clean install
mvn spring-boot:run
```

**Verify:** Backend runs on `http://localhost:8082`

---

## Phase 3: API Verification

### Test Endpoints:

#### 1. Services (Must work first to initialize data)
```bash
# Initialize services
curl -X POST http://localhost:8082/api/services/init

# Get all services
curl http://localhost:8082/api/services
```

**Expected Response:**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "ServiceID": 1,
      "ServiceName": "Oil Leakage Rectification",
      "Description": "Fix oil leakage and restore seals",
      "Icon": "🛠"
    }
  ],
  "count": 8
}
```

#### 2. Submit Enquiry
```bash
curl -X POST http://localhost:8082/api/enquiries \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "9876543210",
    "customerEmail": "test@example.com",
    "servicesRequired": "Oil Leakage Rectification",
    "transformerLocation": "Site A"
  }'
```

**Expected Response:**
```json
{
  "status": "SUCCESS",
  "message": "Enquiry added successfully",
  "id": 1
}
```

#### 3. Get All Enquiries
```bash
curl http://localhost:8082/api/enquiries
```

#### 4. Create Job
```bash
curl -X POST http://localhost:8082/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "enquiryId": 1,
    "transformerId": 101,
    "status": "PENDING",
    "technician": "John Smith"
  }'
```

#### 5. Create Bill
```bash
curl -X POST http://localhost:8082/api/bills \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": 1,
    "amount": 5000,
    "tax": 900,
    "status": "PENDING"
  }'
```

---

## Phase 4: Frontend Integration ⏳

### React Components to Create:
- [ ] EnquiryForm.jsx - Submit new enquiry
- [ ] EnquiryList.jsx - Display all enquiries
- [ ] JobManagement.jsx - Create and track jobs
- [ ] BillTracker.jsx - View bills and payments

### API Integration:
- [ ] Update `frontend/src/services/api.js` with backend URL
- [ ] Connect forms to `/api/enquiries` endpoint
- [ ] Connect job tracker to `/api/jobs` endpoints

### Frontend Build & Run:
```bash
cd frontend
npm run dev
```

**Verify:** Frontend runs on `http://localhost:5173`

---

## Phase 5: End-to-End Testing

### User Flow:
1. [ ] User fills enquiry form on frontend
2. [ ] Frontend POSTs to `/api/enquiries`
3. [ ] Backend calls GoogleSheetsService
4. [ ] GoogleSheetsService POSTs to Google Apps Script
5. [ ] Data stored in Enquiries sheet
6. [ ] User sees success message
7. [ ] Admin views enquiry in list
8. [ ] Admin creates job
9. [ ] Admin creates bill
10. [ ] Finance tracks payment

---

## Phase 6: Production Deployment

### Prerequisites:
- [ ] Google Sheet shared with production Google account
- [ ] Google Apps Script deployed to production environment
- [ ] Backend deployed to production server
- [ ] Frontend deployed to CDN/hosting
- [ ] CORS configured for production domain

### Production Configuration:
```bash
# backend/src/main/resources/application-prod.properties
google.apps.script.url=https://script.google.com/macros/s/[PROD_URL]/exec
server.port=8082
```

### Launch:
```bash
mvn clean install -Pprod
```

---

## Troubleshooting

### Issue: 404 Not Found on API Endpoints
**Solution:** Verify backend is running on port 8082
```bash
netstat -ano | find "8082"
```

### Issue: Google Apps Script returns an unauthorized response
**Solution:** Verify `GOOGLE_APPS_SCRIPT_SHARED_SECRET` matches the
`VSTMS_BACKEND_SHARED_SECRET` Script Property, is at least 32 characters, and
the latest Apps Script version is deployed.

### Issue: CORS errors in browser
**Solution:** Controllers already have `@CrossOrigin(origins = "*")`
- Verify browser is accessing `http://localhost:5173`
- Verify backend is accessible at `http://localhost:8082`

### Issue: Data not saving to Google Sheets
**Solution:** 
1. Check Google Apps Script logs: Extensions → Apps Script → Executions
2. Verify sheet names match: "Enquiries", "Services", "Jobs", "Transformers", "Bills"
3. Test function in Apps Script: Run → testAddEnquiry()

---

## Quick Reference

| Task | Command | Port |
|------|---------|------|
| Run Backend | `mvn spring-boot:run` | 8082 |
| Run Frontend | `npm run dev` | 5173 |
| Test Services | `curl http://localhost:8082/api/services` | - |
| Test Enquiry | `curl -X POST http://localhost:8082/api/enquiries` | - |
| View Logs | Check backend/logs or browser console | - |

---

## Git Workflow

### Commit Changes:
```bash
git add .
git commit -m "feat: Add Google Sheets integration"
git push origin feature/vstms
```

### Create Pull Request:
- Push to GitHub
- Create PR from `feature/vstms` to `main`
- Request review
- Merge after approval

---

## Performance Optimization

### Google Sheets Considerations:
- **Rate Limit:** Google Apps Script has execution time limits (~6 minutes)
- **Optimization:** Cache frequently accessed data (services list)
- **Recommended:** Limit batch operations to <1000 rows at a time

### Monitoring:
- Enable Apps Script logging: Logger.log()
- Monitor quota: Dashboard in Google Cloud Console
- Track API response times

---

## Security Checklist

- [ ] Google Sheet shared only with authorized users
- [ ] API keys not exposed in frontend code
- [ ] CORS restricted if needed (currently open for dev)
- [ ] Input validation on backend (phone, email, etc.)
- [ ] HTTPS enforced in production
- [ ] Rate limiting configured
- [ ] SQL injection prevention (using Google Sheets API, not direct SQL)

---

## Support & Documentation

- **API Docs:** See API_DOCUMENTATION.md
- **Architecture:** See INTEGRATION_ANALYSIS.md
- **Setup Guide:** See GOOGLE_SHEETS_INTEGRATION.md
- **Database Schema:** See DATABASE_STRUCTURE_COMPARISON.md

---

**Status:** Ready for frontend integration and end-to-end testing
**Last Updated:** Oct 2, 2026
