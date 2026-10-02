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
4. Deploy as Web App:
   - Click "Deploy" → "New Deployment"
   - Type: "Web app"
   - Execute as: "Your account"
   - Who has access: "Anyone can access"
5. Copy deployment URL
6. Verify URL matches application.properties:
   https://script.google.com/macros/s/AKfycbwmKqM-u7oaj-GlYY-y709_3AbzbQshadqsCS95MuiPkWNbkhPkE1sTyeLbk_Fvml5Qmw/exec
```

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
```

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

### Issue: Google Apps Script returns 403 Forbidden
**Solution:** Check deployment permissions
- Verify Google account has access to Google Sheet
- Verify Apps Script is deployed with "Anyone can access"
- Check URL in application.properties matches deployment

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
