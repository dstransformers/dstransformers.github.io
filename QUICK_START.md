# VSTMS Quick Start Guide

## 1. Prerequisites

### Required Software:
- **Java 17+** - [Download](https://adoptopenjdk.net/)
- **Maven 3.8+** - [Download](https://maven.apache.org/download.cgi)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **Google Account** - For Sheets and Apps Script

### Project Structure:
```
dstransformers.github.io/
├── backend/           # Spring Boot application
├── frontend/          # React application
├── staticpage/        # Static D.S. Transformers website
└── docs/              # Documentation
```

---

## 2. Clone & Setup

### Clone Repository:
```bash
git clone https://github.com/dstransformers/dstransformers.github.io.git
cd dstransformers.github.io
git checkout feature/vstms
```

### Verify Directory:
```bash
ls -la
# Output should show: backend/, frontend/, staticpage/, docs/, etc.
```

---

## 3. Backend Setup (Spring Boot + Google Sheets)

### Navigate to Backend:
```bash
cd backend
```

### Install Dependencies:
```bash
mvn clean install
```

### Configure Google Apps Script URL:
**File:** `src/main/resources/application.properties`

```properties
# Should already contain:
google.apps.script.url=https://script.google.com/macros/s/AKfycbwmKqM-u7oaj-GlYY-y709_3AbzbQshadqsCS95MuiPkWNbkhPkE1sTyeLbk_Fvml5Qmw/exec
```

### Run Backend Server:
```bash
mvn spring-boot:run
```

**Expected Output:**
```
Tomcat started on port(s): 8082 (http)
```

**Verify Backend:**
```bash
curl http://localhost:8082/api/services
```

---

## 4. Frontend Setup (React + Vite)

### Navigate to Frontend:
```bash
cd frontend
```

### Install Dependencies:
```bash
npm install
```

### Configure Backend URL:
**File:** `src/services/api.js` or `.env`

```javascript
const BACKEND_URL = 'http://localhost:8082';
```

### Run Frontend Server:
```bash
npm run dev
```

**Expected Output:**
```
  VITE v8.0.4  ready in 123 ms

  ➜  Local:   http://localhost:5173/
```

**Open Browser:**
```
http://localhost:5173
```

---

## 5. Initialize Data

### Initialize Services (One-Time Setup):
```bash
# Option 1: Using cURL
curl -X POST http://localhost:8082/api/services/init

# Option 2: Using browser
# Navigate to: http://localhost:5173
# Click "Initialize Services" button
```

**Expected Response:**
```json
{
  "status": "SUCCESS",
  "message": "Services initialized with default data",
  "count": 8
}
```

---

## 6. Test API Endpoints

### List All Services:
```bash
curl http://localhost:8082/api/services
```

### Submit Test Enquiry:
```bash
curl -X POST http://localhost:8082/api/enquiries \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Customer",
    "customerPhone": "9876543210",
    "customerEmail": "test@example.com",
    "servicesRequired": "Oil Leakage Rectification",
    "transformerLocation": "Site A"
  }'
```

### Get All Enquiries:
```bash
curl http://localhost:8082/api/enquiries
```

### Get Enquiry by ID:
```bash
curl http://localhost:8082/api/enquiries/1
```

---

## 7. Project Structure Details

### Backend Structure:
```
backend/
├── src/main/java/com/vstms/backend/
│   ├── GoogleSheetsService.java      # Main service for Google Sheets
│   ├── EnquiryController.java         # Enquiry endpoints
│   ├── ServiceController.java         # Service endpoints
│   ├── JobsController.java            # Job endpoints
│   ├── TransformerController.java     # Transformer endpoints
│   └── BillController.java            # Bill endpoints
├── src/main/resources/
│   └── application.properties         # Configuration
└── pom.xml                            # Maven dependencies
```

### Frontend Structure:
```
frontend/
├── src/
│   ├── components/                    # React components
│   ├── pages/                         # Page components
│   ├── services/                      # API services
│   ├── App.jsx                        # Main app component
│   └── main.jsx                       # Entry point
├── public/                            # Static assets
├── package.json                       # Dependencies
└── vite.config.js                     # Vite configuration
```

---

## 8. Common Commands

### Backend Commands:
```bash
# Build only
mvn clean compile

# Run tests
mvn test

# Build JAR
mvn clean package

# Run server
mvn spring-boot:run

# View dependencies
mvn dependency:tree
```

### Frontend Commands:
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Git Commands:
```bash
# Check status
git status

# Add changes
git add .

# Commit
git commit -m "feat: Your message here"

# Push to feature branch
git push origin feature/vstms

# View logs
git log --oneline -10
```

---

## 9. Debugging Tips

### Backend Debugging:

**Check if port 8082 is in use:**
```bash
# Windows
netstat -ano | find "8082"

# Linux/Mac
lsof -i :8082
```

**View application logs:**
```bash
# Enable debug logging in application.properties
logging.level.com.vstms=DEBUG
logging.level.root=INFO
```

**Test Google Apps Script:**
```bash
# Check if URL is accessible
curl https://script.google.com/macros/s/AKfycbwmKqM-u7oaj-GlYY-y709_3AbzbQshadqsCS95MuiPkWNbkhPkE1sTyeLbk_Fvml5Qmw/exec
```

### Frontend Debugging:

**Browser Console:**
- Press F12 to open DevTools
- Check Network tab for API calls
- Check Console tab for JavaScript errors

**Clear Cache:**
```bash
# Hard refresh in browser
Ctrl + Shift + R
```

---

## 10. Database (Google Sheets)

### View Data in Google Sheets:

**Enquiries Sheet:**
- ID, Date, CustomerName, CustomerPhone, CustomerEmail, ServicesRequired, etc.

**Services Sheet:**
- ServiceID, ServiceName, Description, Icon

**Jobs Sheet:**
- JobID, EnquiryID, TransformerID, Status, StartDate, EndDate, etc.

**Transformers Sheet:**
- TransformerID, Capacity, Voltage, Location, Condition, Status, etc.

**Bills Sheet:**
- BillID, JobID, Amount, Tax, Total, Status, IssuedDate, DueDate, etc.

---

## 11. API Base URL & Endpoints

### Development:
```
Base URL: http://localhost:8082

Endpoints:
- POST   /api/enquiries                 - Submit enquiry
- GET    /api/enquiries                 - Get all enquiries
- GET    /api/enquiries/{id}            - Get enquiry by ID
- PUT    /api/enquiries/{id}/status     - Update status

- GET    /api/services                  - Get all services
- POST   /api/services/init             - Initialize services

- POST   /api/jobs                      - Create job
- GET    /api/jobs                      - Get all jobs

- POST   /api/transformers              - Add transformer
- GET    /api/transformers              - Get all transformers

- POST   /api/bills                     - Create bill
- GET    /api/bills                     - Get all bills
- GET    /api/bills/pending             - Get pending bills
```

---

## 12. Environment Variables

### Backend (application.properties):
```properties
spring.application.name=backend
server.port=8082
google.apps.script.url=https://script.google.com/macros/s/...
logging.level.root=INFO
```

### Frontend (.env):
```
VITE_API_URL=http://localhost:8082
VITE_API_TIMEOUT=5000
```

---

## 13. Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 8082 already in use | Kill process or change port in application.properties |
| npm install fails | Delete node_modules and package-lock.json, then retry |
| CORS errors | Ensure backend has @CrossOrigin(origins = "*") |
| API returns 404 | Check backend is running on correct port |
| Frontend not loading | Clear browser cache (Ctrl+Shift+R) |
| Data not saving to Sheets | Verify Google Apps Script URL is correct |

---

## 14. Next Steps

1. ✅ **Backend Setup:** Complete
2. ✅ **Frontend Setup:** Complete
3. ⏳ **Test APIs:** Run the commands in section 6
4. ⏳ **Create Frontend Components:** Migrate HTML to React
5. ⏳ **Connect Form to Backend:** Update API calls
6. ⏳ **Deploy to Production:** Follow deployment guide

---

## 15. Documentation

- [API Documentation](API_DOCUMENTATION.md) - Complete API reference
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) - Production deployment steps
- [Integration Analysis](INTEGRATION_ANALYSIS.md) - Architecture and design
- [Google Sheets Setup](GOOGLE_SHEETS_INTEGRATION.md) - Initial setup guide

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API_DOCUMENTATION.md for endpoint details
3. Check backend logs: `mvn spring-boot:run` console output
4. Check frontend console: F12 → Console tab

---

**Last Updated:** Oct 2, 2026  
**Version:** 1.0.0
