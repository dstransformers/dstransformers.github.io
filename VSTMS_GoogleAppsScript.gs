// VSTMS Google Apps Script
// Deploy as Web App: Execute as Your account, Anyone can access
// This script handles all data persistence to Google Sheets

const SHEET_NAMES = {
  ENQUIRIES: 'Enquiries',
  SERVICES: 'Services',
  JOBS: 'Jobs',
  TRANSFORMERS: 'Transformers',
  BILLS: 'Bills'
};

const SHEET_HEADERS = {
  Enquiries: ['ID', 'Date', 'CustomerName', 'CustomerPhone', 'CustomerEmail', 'ServicesRequired', 'TransformerLocation', 'LeakageLocation', 'BreakdownTiming', 'SiteLocation', 'Status', 'Notes', 'CreatedAt', 'UpdatedAt'],
  Services: ['ServiceID', 'ServiceName', 'Description', 'Icon'],
  Jobs: ['JobID', 'EnquiryID', 'TransformerID', 'Status', 'StartDate', 'EndDate', 'Technician', 'Description', 'Cost', 'CreatedAt', 'UpdatedAt'],
  Transformers: ['TransformerID', 'Capacity', 'Voltage', 'Location', 'Condition', 'YearOfMfg', 'Status', 'CreatedAt', 'UpdatedAt'],
  Bills: ['BillID', 'JobID', 'Amount', 'Tax', 'Total', 'Status', 'IssuedDate', 'DueDate', 'PaidDate', 'CreatedAt', 'UpdatedAt']
};

const DEFAULT_SERVICES = [
  { ServiceName: 'Oil Leakage Rectification', Description: 'Fix oil leakage and restore seals', Icon: '🛠' },
  { ServiceName: 'Core Insulation Replacement', Description: 'Replace damaged core insulation', Icon: '🔧' },
  { ServiceName: 'Winding Repair', Description: 'Repair or rewind transformer windings', Icon: '⚙️' },
  { ServiceName: 'Cooling System Maintenance', Description: 'Service cooling fans and radiators', Icon: '❄️' },
  { ServiceName: 'Tap Changer Repair', Description: 'Repair or replace tap changer', Icon: '🔄' },
  { ServiceName: 'Bushing Replacement', Description: 'Replace damaged bushings', Icon: '📌' },
  { ServiceName: 'Oil Testing & Treatment', Description: 'Test and treat transformer oil', Icon: '🧪' },
  { ServiceName: 'Load Testing', Description: 'Perform load testing and diagnostics', Icon: '📊' }
];

/**
 * Initialize all sheets with headers
 */
function initializeAllSheets() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  for (const [name, headers] of Object.entries(SHEET_HEADERS)) {
    let sheetObj = sheet.getSheetByName(name);
    if (!sheetObj) {
      sheetObj = sheet.insertSheet(name);
    }
    if (sheetObj.getLastRow() === 0) {
      sheetObj.appendRow(headers);
    }
  }
  
  Logger.log('All sheets initialized');
}

/**
 * Initialize services with default data
 */
function initializeServices() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SERVICES);
  
  if (sheet.getLastRow() === 1) { // Only headers
    DEFAULT_SERVICES.forEach((service, index) => {
      const row = [index + 1, service.ServiceName, service.Description, service.Icon];
      sheet.appendRow(row);
    });
  }
  
  return { status: 'SUCCESS', message: 'Services initialized', count: DEFAULT_SERVICES.length };
}

/**
 * Add Enquiry
 */
function addEnquiry(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENQUIRIES);
  const id = sheet.getLastRow(); // Simple ID generation
  const now = new Date();
  
  const row = [
    id,
    now,
    data.customerName || '',
    data.customerPhone || '',
    data.customerEmail || '',
    data.servicesRequired || '',
    data.transformerLocation || '',
    data.leakageLocation || '',
    data.breakdownTiming || '',
    data.siteLocation || '',
    'NEW',
    '',
    now,
    now
  ];
  
  sheet.appendRow(row);
  return { status: 'SUCCESS', id: id };
}

/**
 * Get all enquiries
 */
function getAllEnquiries() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENQUIRIES);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { status: 'SUCCESS', data: [], count: 0 };
  }
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Get enquiry by ID
 */
function getEnquiryById(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENQUIRIES);
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = data[i][index];
      });
      return { status: 'SUCCESS', data: obj };
    }
  }
  
  return { status: 'NOT_FOUND', message: 'Enquiry not found' };
}

/**
 * Get enquiries by status
 */
function getEnquiriesByStatus(status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENQUIRIES);
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0];
  const statusIndex = headers.indexOf('Status');
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusIndex] === status) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = data[i][index];
      });
      rows.push(obj);
    }
  }
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Get enquiries by phone
 */
function getEnquiriesByPhone(phone) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENQUIRIES);
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0];
  const phoneIndex = headers.indexOf('CustomerPhone');
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][phoneIndex] === phone) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = data[i][index];
      });
      rows.push(obj);
    }
  }
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Update enquiry status
 */
function updateEnquiryStatus(id, newStatus, notes) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENQUIRIES);
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0];
  const statusIndex = headers.indexOf('Status');
  const notesIndex = headers.indexOf('Notes');
  const updateIndex = headers.indexOf('UpdatedAt');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      sheet.getRange(i + 1, statusIndex + 1).setValue(newStatus);
      if (notesIndex >= 0) sheet.getRange(i + 1, notesIndex + 1).setValue(notes || '');
      if (updateIndex >= 0) sheet.getRange(i + 1, updateIndex + 1).setValue(new Date());
      return { status: 'SUCCESS', message: 'Enquiry updated' };
    }
  }
  
  return { status: 'NOT_FOUND', message: 'Enquiry not found' };
}

/**
 * Add Job
 */
function addJob(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.JOBS);
  const id = sheet.getLastRow();
  const now = new Date();
  
  const row = [
    id,
    data.enquiryId || '',
    data.transformerId || '',
    data.status || 'PENDING',
    data.startDate || '',
    data.endDate || '',
    data.technician || '',
    data.description || '',
    data.cost || 0,
    now,
    now
  ];
  
  sheet.appendRow(row);
  return { status: 'SUCCESS', id: id };
}

/**
 * Get all jobs
 */
function getAllJobs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.JOBS);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { status: 'SUCCESS', data: [], count: 0 };
  }
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Get jobs by status
 */
function getJobsByStatus(status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.JOBS);
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0];
  const statusIndex = headers.indexOf('Status');
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusIndex] === status) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = data[i][index];
      });
      rows.push(obj);
    }
  }
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Add Transformer
 */
function addTransformer(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.TRANSFORMERS);
  const id = sheet.getLastRow();
  const now = new Date();
  
  const row = [
    id,
    data.capacity || '',
    data.voltage || '',
    data.location || '',
    data.condition || '',
    data.yearOfMfg || '',
    data.status || 'ACTIVE',
    now,
    now
  ];
  
  sheet.appendRow(row);
  return { status: 'SUCCESS', id: id };
}

/**
 * Get all transformers
 */
function getAllTransformers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.TRANSFORMERS);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { status: 'SUCCESS', data: [], count: 0 };
  }
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Add Bill
 */
function addBill(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.BILLS);
  const id = sheet.getLastRow();
  const now = new Date();
  const total = (parseFloat(data.amount) || 0) + (parseFloat(data.tax) || 0);
  
  const row = [
    id,
    data.jobId || '',
    data.amount || 0,
    data.tax || 0,
    total,
    data.status || 'PENDING',
    data.issuedDate || '',
    data.dueDate || '',
    data.paidDate || '',
    now,
    now
  ];
  
  sheet.appendRow(row);
  return { status: 'SUCCESS', id: id };
}

/**
 * Get all bills
 */
function getAllBills() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.BILLS);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { status: 'SUCCESS', data: [], count: 0 };
  }
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Get pending bills
 */
function getPendingBills() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.BILLS);
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0];
  const statusIndex = headers.indexOf('Status');
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusIndex] === 'PENDING') {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = data[i][index];
      });
      rows.push(obj);
    }
  }
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Get services
 */
function getServices() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SERVICES);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { status: 'SUCCESS', data: [], count: 0 };
  }
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return { status: 'SUCCESS', data: rows, count: rows.length };
}

/**
 * Get service by ID
 */
function getServiceById(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SERVICES);
  const data = sheet.getDataRange().getValues();
  
  const headers = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = data[i][index];
      });
      return { status: 'SUCCESS', data: obj };
    }
  }
  
  return { status: 'NOT_FOUND', message: 'Service not found' };
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result;
    switch (action) {
      case 'addEnquiry':
        result = addEnquiry(data);
        break;
      case 'getAllEnquiries':
        result = getAllEnquiries();
        break;
      case 'getEnquiryById':
        result = getEnquiryById(data.id);
        break;
      case 'getEnquiriesByStatus':
        result = getEnquiriesByStatus(data.status);
        break;
      case 'getEnquiriesByPhone':
        result = getEnquiriesByPhone(data.phone);
        break;
      case 'updateEnquiryStatus':
        result = updateEnquiryStatus(data.id, data.status, data.notes);
        break;
      case 'addJob':
        result = addJob(data);
        break;
      case 'getAllJobs':
        result = getAllJobs();
        break;
      case 'getJobsByStatus':
        result = getJobsByStatus(data.status);
        break;
      case 'addTransformer':
        result = addTransformer(data);
        break;
      case 'getAllTransformers':
        result = getAllTransformers();
        break;
      case 'addBill':
        result = addBill(data);
        break;
      case 'getAllBills':
        result = getAllBills();
        break;
      case 'getPendingBills':
        result = getPendingBills();
        break;
      case 'initializeServices':
        result = initializeServices();
        break;
      default:
        result = { status: 'ERROR', message: 'Unknown action: ' + action };
    }
    
    return respond(result);
  } catch (error) {
    return respond({ status: 'ERROR', message: error.toString() });
  }
}

/**
 * Handle GET requests
 */
function doGet(e) {
  const action = e.parameter.action;
  const id = e.parameter.id;
  
  try {
    let result;
    switch (action) {
      case 'getAllEnquiries':
        result = getAllEnquiries();
        break;
      case 'getEnquiryById':
        result = getEnquiryById(id);
        break;
      case 'getServices':
        result = getServices();
        break;
      case 'getServiceById':
        result = getServiceById(id);
        break;
      case 'getAllJobs':
        result = getAllJobs();
        break;
      case 'getAllTransformers':
        result = getAllTransformers();
        break;
      case 'getAllBills':
        result = getAllBills();
        break;
      default:
        result = { status: 'ERROR', message: 'Unknown action: ' + action };
    }
    
    return respond(result);
  } catch (error) {
    return respond({ status: 'ERROR', message: error.toString() });
  }
}

/**
 * Format response as JSON
 */
function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test functions
 */
function testAddEnquiry() {
  const data = {
    action: 'addEnquiry',
    customerName: 'Test User',
    customerPhone: '9876543210',
    customerEmail: 'test@example.com',
    servicesRequired: 'Oil Leakage Rectification'
  };
  Logger.log(addEnquiry(data));
}

function testGetEnquiries() {
  Logger.log(getAllEnquiries());
}

function testGetServices() {
  Logger.log(getServices());
}

function testInitializeAll() {
  initializeAllSheets();
  initializeServices();
  Logger.log('All initialized');
}
