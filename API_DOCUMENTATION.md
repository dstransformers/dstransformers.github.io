# VSTMS REST API Documentation

## Overview
VSTMS Backend API with Google Sheets Integration

**Base URL:** `http://localhost:8082`  
**Google Sheets Integration:** Connected via Google Apps Script  
**Data Storage:** Google Sheets (5 sheets: Enquiries, Services, Jobs, Transformers, Bills)

---

## Endpoints

### 1. ENQUIRIES Endpoints

#### Submit New Enquiry
```
POST /api/enquiries
Content-Type: application/json

{
  "customerName": "John Doe",
  "customerPhone": "9876543210",
  "customerEmail": "john@example.com",
  "servicesRequired": "Oil Leakage Rectification",
  "transformerLocation": "Site A",
  "leakageLocation": "Top",
  "breakdownTiming": "Immediate",
  "siteLocation": "Customer site"
}

Response (201):
{
  "status": "SUCCESS",
  "message": "Enquiry added successfully",
  "id": 1001,
  "data": {...}
}
```

#### Get All Enquiries
```
GET /api/enquiries

Response (200):
{
  "status": "SUCCESS",
  "data": [
    {
      "ID": 1001,
      "Date": "Oct 2, 2026 10:30:00",
      "CustomerName": "John Doe",
      "CustomerPhone": "9876543210",
      ...
    }
  ],
  "count": 5
}
```

#### Get Enquiry by ID
```
GET /api/enquiries/{id}
GET /api/enquiries/1001

Response (200):
{
  "status": "SUCCESS",
  "data": {
    "ID": 1001,
    "CustomerName": "John Doe",
    ...
  }
}
```

#### Get Enquiries by Status
```
GET /api/enquiries/status/{status}
GET /api/enquiries/status/NEW

Response (200):
{
  "status": "SUCCESS",
  "data": [...],
  "count": 3
}
```

#### Get Enquiries by Phone
```
GET /api/enquiries/phone/{phone}
GET /api/enquiries/phone/9876543210

Response (200):
{
  "status": "SUCCESS",
  "data": [...],
  "count": 2
}
```

#### Update Enquiry Status
```
PUT /api/enquiries/{id}/status
PUT /api/enquiries/1001/status?status=COMPLETED&notes=Repair%20completed

Response (200):
{
  "status": "SUCCESS",
  "message": "Enquiry status updated",
  "id": 1001,
  "newStatus": "COMPLETED"
}
```

---

### 2. SERVICES Endpoints

#### Get All Services
```
GET /api/services

Response (200):
{
  "status": "SUCCESS",
  "data": [
    {
      "ServiceID": 1,
      "ServiceName": "Oil Leakage Rectification",
      "Description": "Fix oil leakage and restore seals",
      "Icon": "🛠"
    },
    ...
  ],
  "count": 8
}
```

#### Get Service by ID
```
GET /api/services/{id}
GET /api/services/1

Response (200):
{
  "status": "SUCCESS",
  "data": {
    "ServiceID": 1,
    "ServiceName": "Oil Leakage Rectification",
    ...
  }
}
```

#### Initialize Services (Load Defaults)
```
POST /api/services/init

Response (200):
{
  "status": "SUCCESS",
  "message": "Services initialized with default data",
  "count": 8
}
```

---

### 3. JOBS Endpoints

#### Create New Job
```
POST /api/jobs
Content-Type: application/json

{
  "enquiryId": 1001,
  "transformerId": 101,
  "status": "PENDING",
  "startDate": "2026-10-02",
  "endDate": "",
  "technician": "John Smith",
  "description": "Repairing oil leakage",
  "cost": 5000
}

Response (201):
{
  "status": "SUCCESS",
  "message": "Job created successfully",
  "id": 2001
}
```

#### Get All Jobs
```
GET /api/jobs

Response (200):
{
  "status": "SUCCESS",
  "data": [...],
  "count": 10
}
```

#### Get Jobs by Status
```
GET /api/jobs/status/{status}
GET /api/jobs/status/IN_PROGRESS

Response (200):
{
  "status": "SUCCESS",
  "data": [...],
  "count": 3
}
```

---

### 4. TRANSFORMERS Endpoints

#### Add New Transformer
```
POST /api/transformers
Content-Type: application/json

{
  "capacity": "500 kVA",
  "voltage": "11kV/433V",
  "location": "Substation A",
  "condition": "GOOD",
  "yearOfMfg": 2015,
  "status": "ACTIVE"
}

Response (201):
{
  "status": "SUCCESS",
  "message": "Transformer added successfully",
  "id": 101
}
```

#### Get All Transformers
```
GET /api/transformers

Response (200):
{
  "status": "SUCCESS",
  "data": [...],
  "count": 25
}
```

---

### 5. BILLS Endpoints

#### Create New Bill
```
POST /api/bills
Content-Type: application/json

{
  "jobId": 2001,
  "amount": 5000,
  "tax": 900,
  "status": "PENDING",
  "issuedDate": "2026-10-02",
  "dueDate": "2026-10-10",
  "paidDate": ""
}

Response (201):
{
  "status": "SUCCESS",
  "message": "Bill created successfully",
  "id": 3001
}
```

#### Get All Bills
```
GET /api/bills

Response (200):
{
  "status": "SUCCESS",
  "data": [...],
  "count": 50
}
```

#### Get Pending Bills
```
GET /api/bills/pending

Response (200):
{
  "status": "SUCCESS",
  "data": [...],
  "count": 12
}
```

---

## Response Formats

### Success Response
```json
{
  "status": "SUCCESS",
  "message": "Operation successful",
  "data": {...},
  "count": 5
}
```

### Error Response
```json
{
  "status": "ERROR",
  "message": "Detailed error message",
  "data": []
}
```

### Not Found Response
```json
{
  "status": "NOT_FOUND",
  "message": "Resource not found"
}
```

---

## Enquiry Statuses
- `NEW` - Newly submitted enquiry
- `PENDING` - Under review
- `IN_PROGRESS` - Being processed
- `COMPLETED` - Finished
- `CANCELLED` - Cancelled enquiry

## Job Statuses
- `PENDING` - Not yet started
- `IN_PROGRESS` - Currently being worked on
- `COMPLETED` - Finished
- `CANCELLED` - Cancelled

## Bill Statuses
- `PENDING` - Awaiting payment
- `PAID` - Payment received
- `CANCELLED` - Cancelled

---

## Integration Flow

### Create Enquiry → Create Job → Create Bill

```
1. Customer submits form
   POST /api/enquiries
   ↓
2. Admin creates repair job
   POST /api/jobs (with enquiryId)
   ↓
3. Technician updates job status
   PUT /api/jobs/{jobId}/status?status=COMPLETED
   ↓
4. System creates bill
   POST /api/bills (with jobId)
   ↓
5. Bill status tracked
   GET /api/bills/pending
```

---

## Error Handling

All errors return appropriate HTTP status codes:
- `200 OK` - Successful GET/POST/PUT
- `201 CREATED` - Resource created
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

**Error Response Example:**
```json
{
  "status": "ERROR",
  "message": "Failed to submit enquiry: Invalid phone number"
}
```

---

## CORS Configuration
- **Allowed Origins:** `*` (all origins)
- **Allowed Methods:** GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers:** Content-Type, Authorization

---

## Data Validation

### Phone Number
- Format: 10 digits starting with 6-9
- Example: `9876543210`

### Email
- Valid email format
- Example: `john@example.com`

### Cost/Amount
- Numeric values
- Decimal precision: 2 places
- Example: `5000.00`

---

## Testing with cURL

### Test Connection
```bash
curl http://localhost:8082/api/services
```

### Submit Enquiry
```bash
curl -X POST http://localhost:8082/api/enquiries \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerPhone": "9876543210",
    "customerEmail": "test@example.com",
    "servicesRequired": "Oil Leakage Rectification"
  }'
```

### Get Enquiries by Status
```bash
curl "http://localhost:8082/api/enquiries/status/NEW"
```

### Update Enquiry Status
```bash
curl -X PUT \
  "http://localhost:8082/api/enquiries/1001/status?status=COMPLETED&notes=Done"
```

---

## Backend Configuration

**File:** `backend/src/main/resources/application.properties`

```properties
spring.application.name=backend
server.port=8082

# Google Apps Script URL (already configured)
google.apps.script.url=https://script.google.com/macros/s/AKfycbwmKqM-u7oaj-GlYY-y709_3AbzbQshadqsCS95MuiPkWNbkhPkE1sTyeLbk_Fvml5Qmw/exec

# Logging
logging.level.root=INFO
logging.level.com.vstms=DEBUG
```

---

## Classes

- **GoogleSheetsService.java** - Core service for Google Sheets communication
- **EnquiryController.java** - Enquiry endpoints
- **ServiceController.java** - Service endpoints
- **JobsController.java** - Job endpoints
- **TransformerController.java** - Transformer endpoints
- **BillController.java** - Bill endpoints

---

## Next Steps

1. ✅ Google Apps Script deployed
2. ✅ Backend controllers created
3. ✅ API endpoints ready
4. ⏳ React frontend integration (in progress)
5. ⏳ End-to-end testing
6. ⏳ Production deployment

