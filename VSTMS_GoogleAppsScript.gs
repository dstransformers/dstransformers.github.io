/**
 * VSTMS Google Apps Script - Single Source of Truth
 *
 * Manages data in Google Sheets for the complete VSTMS application:
 * Sheets: Enquiries, Services, Jobs, Transformers, TNotes, DCs, Bills
 *
 * Deployment:
 * 1. Open Google Sheet > Extensions > Apps Script
 * 2. Replace all code with this file
 * 3. Click Deploy > Manage deployments > Edit > New version
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Authorize Google Drive, Google Slides, and external request access when prompted
 * 5. Enable the Google Slides API in the Apps Script project's linked Cloud project for PNG exports
 * 6. Keep the Web App URL in backend application.properties (google.apps.script.url)
 */

// ============ CONFIGURATION ============

const SHEET_NAMES = {
  ENQUIRIES: 'Enquiries',
  SERVICES: 'Services',
  JOBS: 'Jobs',
  TRANSFORMERS: 'Transformers',
  TNOTES: 'TNotes',
  DCS: 'DCs',
  BILLS: 'Bills',
  QUOTATIONS: 'Quotations',
  QUOTATION_FORM: 'Quotation_Form',
  QUOTATION_SETTINGS: 'Quotation Settings',
  QUOTATION_RATES: 'Quotation Rates'
};

const SHEET_HEADERS = {
  Enquiries: ['ID', 'Date', 'CustomerName', 'CustomerPhone', 'CustomerEmail', 'ServicesRequired', 'TransformerLocation', 'LeakageLocation', 'BreakdownTiming', 'SiteLocation', 'Status', 'Notes', 'CreatedAt', 'UpdatedAt', 'ContactPerson', 'TransformerCapacity', 'TransformerMake', 'TransformerStatus', 'ServicePriority', 'ProblemDescription', 'PhotoLinks'],
  Services: ['ServiceID', 'ServiceName', 'Description', 'Icon'],
  Jobs: ['JobID', 'EnquiryID', 'TransformerID', 'Status', 'StartDate', 'EndDate', 'Technician', 'Description', 'Cost', 'CreatedAt', 'UpdatedAt'],
  Transformers: ['ID', 'SpmCenter', 'DtrNo', 'SNo', 'Capacity', 'Type', 'OilCapacity', 'Status', 'TNoteID', 'DcNo', 'SapNo', 'CreatedAt', 'UpdatedAt'],
  TNotes: ['ID', 'Date', 'NumberOfTransformers', 'CreatedAt', 'UpdatedAt'],
  DCs: ['DcNo', 'Date', 'SpmCenter', 'TotalTransformers', 'CreatedAt', 'UpdatedAt'],
  Bills: ['SapNo', 'Date', 'SpmCenter', 'TotalTransformers', 'BillAmount', 'CreatedAt', 'UpdatedAt'],
  Quotations: ['QuotationNo', 'CustomerName', 'CustomerAddress', 'ContactPerson', 'Mobile', 'Email', 'TransformerMake', 'TransformerCapacity', 'TransformerSerialNo', 'TransformerLocation', 'QuotationDate', 'FinancialYear', 'LineItems', 'Subtotal', 'PdfUrl', 'FileUrl', 'FileId', 'OutputFormat', 'CreatedAt', 'UpdatedAt', 'DocumentType', 'GSTApplicable', 'GSTRate', 'GSTAmount', 'GrandTotal', 'WarrantyMonths', 'Terms'],
  Quotation_Form: ['QuotationNo', 'CustomerName', 'CustomerAddress', 'ContactPerson', 'Mobile', 'TransformerMake', 'TransformerCapacity', 'TransformerSerialNo', 'TransformerLocation', 'QuotationDate', 'FinancialYear', 'LineItems', 'OutputFormat', 'UpdatedAt', 'DocumentType', 'Subtotal', 'GSTApplicable', 'GSTRate', 'GSTAmount', 'GrandTotal', 'WarrantyMonths', 'Terms'],
  'Quotation Settings': ['Setting', 'Value'],
  'Quotation Rates': ['TransformerCapacity', 'Service', 'Rate']
};

const DEFAULT_QUOTATION_SETTINGS = [
  ['Business Name', 'M/s. D.S. TRANSFORMERS & ELECTRICAL CONTRACTOR'],
  ['Business Email', 'ds.transformerelectrical@gmail.com'],
  ['WhatsApp', '919949396530'],
  ['Financial Year', '26-27'],
  ['Starting Quotation Number', '710'],
  ['Letterhead Presentation ID', '1W7qyj0bRI5jbMlgc-RtXA-UYnbOvxBaqvBk-nrvF-5U'],
  ['Quotation Root Folder', 'DS Transformers'],
  ['Quotation Folder', 'Quotations'],
  ['Bill Folder', 'Service Bills']
];

const DEFAULT_QUOTATION_RATES = [
  ['100 kVA', 'Transformer Oil Filtration', 6000],
  ['250 kVA', 'Transformer Oil Filtration', 8000],
  ['315 kVA', 'Transformer Oil Filtration', 9000],
  ['500 kVA', 'Transformer Oil Filtration', 11000],
  ['630 kVA', 'Transformer Oil Filtration', 13000],
  ['1000 kVA', 'Transformer Oil Filtration', 15000],
  ['100 kVA', 'Gasket Changing', 4000],
  ['250 kVA', 'Gasket Changing', 5500],
  ['315 kVA', 'Gasket Changing', 6000],
  ['500 kVA', 'Gasket Changing', 7000],
  ['630 kVA', 'Gasket Changing', 8000],
  ['1000 kVA', 'Gasket Changing', 9000],
  ['100 kVA', 'Repair & Servicing of Sick DTR', 15000],
  ['250 kVA', 'Repair & Servicing of Sick DTR', 22000],
  ['315 kVA', 'Repair & Servicing of Sick DTR', 26000],
  ['500 kVA', 'Repair & Servicing of Sick DTR', 32000],
  ['630 kVA', 'Repair & Servicing of Sick DTR', 38000],
  ['1000 kVA', 'Repair & Servicing of Sick DTR', 45000],
  ['100 kVA', 'New Breather', 2500],
  ['250 kVA', 'New Breather', 3500],
  ['315 kVA', 'New Breather', 4000],
  ['500 kVA', 'New Breather', 4500],
  ['630 kVA', 'New Breather', 5000],
  ['1000 kVA', 'New Breather', 5500],
  ['100 kVA', 'Transformer Painting', 6000],
  ['250 kVA', 'Transformer Painting', 8500],
  ['315 kVA', 'Transformer Painting', 10000],
  ['500 kVA', 'Transformer Painting', 12000],
  ['630 kVA', 'Transformer Painting', 14000],
  ['1000 kVA', 'Transformer Painting', 16000],
  ['100 kVA', 'Transformer Rewinding', 35000],
  ['250 kVA', 'Transformer Rewinding', 55000],
  ['315 kVA', 'Transformer Rewinding', 65000],
  ['500 kVA', 'Transformer Rewinding', 80000],
  ['630 kVA', 'Transformer Rewinding', 95000],
  ['1000 kVA', 'Transformer Rewinding', 120000],
  ['25 kVA', 'New Transformer Oil', 1200],
  ['63 kVA', 'New Transformer Oil', 1200],
  ['100 kVA', 'New Transformer Oil', 1200],
  ['160 kVA', 'New Transformer Oil', 1200],
  ['250 kVA', 'New Transformer Oil', 1200],
  ['315 kVA', 'New Transformer Oil', 1200],
  ['500 kVA', 'New Transformer Oil', 1200],
  ['630 kVA', 'New Transformer Oil', 1200],
  ['1000 kVA', 'New Transformer Oil', 1200],
  ['25 kVA', 'Earth Pit Testing', 2000],
  ['63 kVA', 'Earth Pit Testing', 2000],
  ['100 kVA', 'Earth Pit Testing', 2000],
  ['160 kVA', 'Earth Pit Testing', 2000],
  ['250 kVA', 'Earth Pit Testing', 2000],
  ['315 kVA', 'Earth Pit Testing', 2000],
  ['500 kVA', 'Earth Pit Testing', 2000],
  ['630 kVA', 'Earth Pit Testing', 2000],
  ['1000 kVA', 'Earth Pit Testing', 2000]
];

const QUOTATION_CAPACITIES = ['25 kVA', '63 kVA', '100 kVA', '160 kVA', '250 kVA', '315 kVA', '500 kVA', '630 kVA', '1000 kVA'];
const QUOTATION_SERVICES = [
  'Transformer Oil Filtration',
  'Gasket Changing',
  'Repair & Servicing of Sick DTR',
  'New Breather',
  'Transformer Painting',
  'Transformer Rewinding',
  'Transformer Assembly',
  'Oven / Drying Charges',
  'New Transformer Oil',
  'Earth Pit Testing',
  'Oil Leakage Rectification',
  'Transformer Inspection / Fault Assessment',
  'Emergency Breakdown Support'
];

const DEFAULT_SERVICES = [
  { ServiceName: 'Oil Leakage Rectification', Description: 'Fix oil leakage and restore seals', Icon: '🛠' },
  { ServiceName: 'Transformer Breakdown Repair', Description: 'Complete transformer repair', Icon: '🔧' },
  { ServiceName: 'Coil Rewinding', Description: 'Professional coil rewinding', Icon: '⚡' },
  { ServiceName: 'Oil Filtration', Description: 'Oil purification service', Icon: '💧' },
  { ServiceName: 'Gasket Replacement', Description: 'Replace damaged gaskets', Icon: '🔩' },
  { ServiceName: 'Testing & Diagnostics', Description: 'Comprehensive testing', Icon: '🔍' },
  { ServiceName: 'Annual Maintenance', Description: 'Scheduled maintenance', Icon: '📋' },
  { ServiceName: 'Custom Repairs', Description: 'Custom repair solutions', Icon: '🎯' }
];

const STATUS_ORDER = ['Recieved', 'Assesment', 'Repair In Progress', 'Repaired', 'Delivered', 'Billed'];

// ============ UTILITY FUNCTIONS ============

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function initializeSheet(sheetName, headers) {
  const sheet = getOrCreateSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else if (headers.length > 0) {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const missingHeaders = headers.filter(header => !existingHeaders.includes(header));
    if (missingHeaders.length > 0) {
      sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  }
  return sheet;
}

function getSheetData(sheetName) {
  const headers = SHEET_HEADERS[sheetName] || [];
  const sheet = initializeSheet(sheetName, headers);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const colHeaders = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    colHeaders.forEach((header, index) => {
      row[header] = data[i][index];
    });
    rows.push(row);
  }
  return rows;
}

function findRowByValue(sheetName, columnName, value) {
  const headers = SHEET_HEADERS[sheetName] || [];
  const sheet = initializeSheet(sheetName, headers);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;

  const colHeaders = data[0];
  const colIndex = colHeaders.indexOf(columnName);
  if (colIndex === -1) return null;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) {
      return { rowIndex: i + 1, data: data[i], headers: colHeaders };
    }
  }
  return null;
}

function getNextNumericId(sheetName, idColumnName) {
  const data = getSheetData(sheetName);
  if (data.length === 0) return 1;
  const ids = data.map(row => parseInt(row[idColumnName]) || 0);
  return Math.max(...ids) + 1;
}

function getTimestamp() {
  return new Date().toISOString();
}

function dateOnly_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw new Error('Invalid date value in spreadsheet.');
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) throw new Error(`Invalid date value in spreadsheet: ${text}`);
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ============ ENQUIRY FUNCTIONS ============

function saveEnquiryPhotos(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  if (attachments.length > 5) throw new Error('Please upload no more than 5 photos.');

  const folderName = 'D.S. Transformer Enquiry Photos';
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const maxPhotoSize = 2 * 1024 * 1024;

  return attachments.map(attachment => {
    if (!attachment || typeof attachment.dataUrl !== 'string' || attachment.size > maxPhotoSize) {
      throw new Error('Each uploaded photo must be 2 MB or smaller.');
    }

    const match = attachment.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    const allowedImageType = /^image\/(jpeg|png|gif|webp|bmp|heic|heif|avif)$/i;
    if (!match || !allowedImageType.test(match[1]) || (attachment.type && attachment.type !== match[1])) {
      throw new Error('An uploaded file is not a valid image.');
    }
    if (match[2].length > Math.ceil(maxPhotoSize * 4 / 3) + 4) {
      throw new Error('Each uploaded photo must be 2 MB or smaller.');
    }

    const safeName = String(attachment.name || 'transformer-photo')
      .replace(/[^\w.-]/g, '_')
      .slice(0, 120);
    const filename = `${Utilities.getUuid()}_${safeName}`;
    const bytes = Utilities.base64Decode(match[2]);
    if (bytes.length > maxPhotoSize) throw new Error('Each uploaded photo must be 2 MB or smaller.');
    const blob = Utilities.newBlob(bytes, match[1], filename);
    return folder.createFile(blob).getUrl();
  });
}

function addEnquiry(data) {
  const sheet = initializeSheet(SHEET_NAMES.ENQUIRIES, SHEET_HEADERS.Enquiries);
  const customerPhone = String(data.customerPhone || '').trim();
  if (!/^[6-9]\d{9}$/.test(customerPhone)) {
    throw new Error('A valid 10-digit Indian mobile number is required.');
  }

  const photoLinks = saveEnquiryPhotos(data.attachments);
  const id = getNextNumericId(SHEET_NAMES.ENQUIRIES, 'ID');
  const now = getTimestamp();
  const values = {
    ID: id,
    Date: new Date().toLocaleDateString(),
    CustomerName: data.customerName || '',
    CustomerPhone: customerPhone,
    CustomerEmail: '',
    ServicesRequired: data.servicesRequired || '',
    TransformerLocation: '',
    LeakageLocation: '',
    BreakdownTiming: '',
    SiteLocation: '',
    Status: data.status || 'NEW',
    Notes: data.problemDescription || '',
    CreatedAt: now,
    UpdatedAt: now,
    ContactPerson: data.contactPerson || '',
    TransformerCapacity: data.transformerCapacity || '',
    TransformerMake: data.transformerMake || '',
    TransformerStatus: data.transformerStatus || '',
    ServicePriority: data.servicePriority || '',
    ProblemDescription: data.problemDescription || '',
    PhotoLinks: photoLinks.join('\n')
  };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(header => values[header] || ''));
  return { status: 'SUCCESS', message: 'Enquiry added successfully', id: id, data: { ID: id, ...data } };
}

function getAllEnquiries() {
  const data = getSheetData(SHEET_NAMES.ENQUIRIES);
  return { status: 'SUCCESS', data: data, count: data.length };
}

function getEnquiryById(id) {
  const row = findRowByValue(SHEET_NAMES.ENQUIRIES, 'ID', id);
  if (!row) return { status: 'NOT_FOUND', message: 'Enquiry not found' };
  const obj = {};
  row.headers.forEach((h, idx) => { obj[h] = row.data[idx]; });
  return { status: 'SUCCESS', data: obj };
}

function getEnquiriesByStatus(status) {
  const data = getSheetData(SHEET_NAMES.ENQUIRIES);
  const filtered = data.filter(e => String(e.Status).toUpperCase() === String(status).toUpperCase());
  return { status: 'SUCCESS', data: filtered, count: filtered.length };
}

function getEnquiriesByPhone(phone) {
  const data = getSheetData(SHEET_NAMES.ENQUIRIES);
  const filtered = data.filter(e => String(e.CustomerPhone).includes(String(phone)));
  return { status: 'SUCCESS', data: filtered, count: filtered.length };
}

function updateEnquiryStatus(id, newStatus, notes) {
  const found = findRowByValue(SHEET_NAMES.ENQUIRIES, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Enquiry not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.ENQUIRIES);
  const statusIdx = found.headers.indexOf('Status') + 1;
  const notesIdx = found.headers.indexOf('Notes') + 1;
  const updatedIdx = found.headers.indexOf('UpdatedAt') + 1;

  if (statusIdx > 0 && newStatus) sheet.getRange(found.rowIndex, statusIdx).setValue(newStatus);
  if (notesIdx > 0 && notes !== undefined) sheet.getRange(found.rowIndex, notesIdx).setValue(notes);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return { status: 'SUCCESS', message: 'Enquiry status updated' };
}

// ============ SERVICE FUNCTIONS ============

function initializeServices() {
  const sheet = initializeSheet(SHEET_NAMES.SERVICES, SHEET_HEADERS.Services);
  const existing = getSheetData(SHEET_NAMES.SERVICES);
  if (existing.length === 0) {
    DEFAULT_SERVICES.forEach((service, index) => {
      sheet.appendRow([index + 1, service.ServiceName, service.Description, service.Icon]);
    });
  }
  return { status: 'SUCCESS', message: 'Services initialized', count: DEFAULT_SERVICES.length };
}

function getAllServices() {
  const data = getSheetData(SHEET_NAMES.SERVICES);
  return { status: 'SUCCESS', data: data, count: data.length };
}

function getServiceById(id) {
  const row = findRowByValue(SHEET_NAMES.SERVICES, 'ServiceID', id);
  if (!row) return { status: 'NOT_FOUND', message: 'Service not found' };
  const obj = {};
  row.headers.forEach((h, idx) => { obj[h] = row.data[idx]; });
  return { status: 'SUCCESS', data: obj };
}

// ============ JOB FUNCTIONS ============

function addJob(data) {
  const sheet = initializeSheet(SHEET_NAMES.JOBS, SHEET_HEADERS.Jobs);
  const id = getNextNumericId(SHEET_NAMES.JOBS, 'JobID');
  const now = getTimestamp();

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
  return { status: 'SUCCESS', id: id, data: { JobID: id, ...data } };
}

function getAllJobs() {
  const data = getSheetData(SHEET_NAMES.JOBS);
  return { status: 'SUCCESS', data: data, count: data.length };
}

function getJobsByStatus(status) {
  const data = getSheetData(SHEET_NAMES.JOBS);
  const filtered = data.filter(j => String(j.Status).toUpperCase() === String(status).toUpperCase());
  return { status: 'SUCCESS', data: filtered, count: filtered.length };
}

// ============ TRANSFORMER FUNCTIONS ============

function transformerRowToObj(row) {
  return {
    id: Number(row.ID),
    spmCenter: String(row.SpmCenter || ''),
    dtrNo: String(row.DtrNo || ''),
    sNo: String(row.SNo || ''),
    capacity: Number(row.Capacity || 0),
    type: String(row.Type || ''),
    oilCapacity: Number(row.OilCapacity || 0),
    status: String(row.Status || 'Recieved'),
    tNoteId: row.TNoteID ? Number(row.TNoteID) : null,
    dcNo: row.DcNo ? String(row.DcNo) : null,
    sapNo: row.SapNo ? String(row.SapNo) : null
  };
}

function getAllTransformers() {
  const data = getSheetData(SHEET_NAMES.TRANSFORMERS);
  const transformers = data.map(transformerRowToObj);
  return { status: 'SUCCESS', data: transformers, count: transformers.length };
}

function getTransformerById(id) {
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };
  const obj = {};
  found.headers.forEach((h, idx) => { obj[h] = found.data[idx]; });
  return { status: 'SUCCESS', data: transformerRowToObj(obj) };
}

function addTransformer(data) {
  const sheet = initializeSheet(SHEET_NAMES.TRANSFORMERS, SHEET_HEADERS.Transformers);
  const id = getNextNumericId(SHEET_NAMES.TRANSFORMERS, 'ID');
  const now = getTimestamp();

  const row = [
    id,
    data.spmCenter || '',
    data.dtrNo || '',
    data.sNo || '',
    data.capacity || 0,
    data.type || 'Distribution',
    data.oilCapacity || 0,
    data.status || 'Recieved',
    data.tNoteId || data.tNoteID || '',
    data.dcNo || '',
    data.sapNo || '',
    now,
    now
  ];
  sheet.appendRow(row);
  const created = transformerRowToObj({
    ID: id, SpmCenter: data.spmCenter, DtrNo: data.dtrNo, SNo: data.sNo,
    Capacity: data.capacity, Type: data.type, OilCapacity: data.oilCapacity,
    Status: data.status || 'Recieved', TNoteID: data.tNoteId, DcNo: data.dcNo, SapNo: data.sapNo
  });
  return { status: 'SUCCESS', data: created };
}

function updateTransformer(id, data) {
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
  const headers = found.headers;

  const setCol = (name, val) => {
    const idx = headers.indexOf(name) + 1;
    if (idx > 0 && val !== undefined) sheet.getRange(found.rowIndex, idx).setValue(val);
  };

  if (data.spmCenter !== undefined) setCol('SpmCenter', data.spmCenter);
  if (data.dtrNo !== undefined) setCol('DtrNo', data.dtrNo);
  if (data.sNo !== undefined) setCol('SNo', data.sNo);
  if (data.capacity !== undefined) setCol('Capacity', data.capacity);
  if (data.type !== undefined) setCol('Type', data.type);
  if (data.oilCapacity !== undefined) setCol('OilCapacity', data.oilCapacity);
  setCol('UpdatedAt', getTimestamp());

  return getTransformerById(id);
}

function updateTransformerStatus(id, newStatus) {
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
  const statusIdx = found.headers.indexOf('Status') + 1;
  const updatedIdx = found.headers.indexOf('UpdatedAt') + 1;

  sheet.getRange(found.rowIndex, statusIdx).setValue(newStatus);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getTransformerById(id);
}

function deliverTransformer(id, dcNo) {
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
  const statusIdx = found.headers.indexOf('Status') + 1;
  const dcIdx = found.headers.indexOf('DcNo') + 1;
  const updatedIdx = found.headers.indexOf('UpdatedAt') + 1;

  sheet.getRange(found.rowIndex, statusIdx).setValue('Delivered');
  sheet.getRange(found.rowIndex, dcIdx).setValue(dcNo);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getTransformerById(id);
}

function billTransformer(id, sapNo) {
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
  const statusIdx = found.headers.indexOf('Status') + 1;
  const sapIdx = found.headers.indexOf('SapNo') + 1;
  const updatedIdx = found.headers.indexOf('UpdatedAt') + 1;

  sheet.getRange(found.rowIndex, statusIdx).setValue('Billed');
  sheet.getRange(found.rowIndex, sapIdx).setValue(sapNo);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getTransformerById(id);
}

function getTransformersSummary() {
  const data = getSheetData(SHEET_NAMES.TRANSFORMERS);
  const counts = {
    recieve: 0,
    assesment: 0,
    repairInProgress: 0,
    repaired: 0,
    delivered: 0,
    billed: 0
  };

  data.forEach(t => {
    const s = String(t.Status || '').trim().toLowerCase();
    if (s === 'recieved' || s === 'receive') counts.recieve++;
    else if (s === 'assesment' || s === 'assessment') counts.assesment++;
    else if (s === 'repair in progress' || s === 'repair_in_progress') counts.repairInProgress++;
    else if (s === 'repaired') counts.repaired++;
    else if (s === 'delivered') counts.delivered++;
    else if (s === 'billed') counts.billed++;
  });

  return { status: 'SUCCESS', data: counts };
}

// ============ TNOTE FUNCTIONS ============

function getAllTNotes() {
  const tnotes = getSheetData(SHEET_NAMES.TNOTES);
  const transformers = getSheetData(SHEET_NAMES.TRANSFORMERS).map(transformerRowToObj);

  const result = tnotes.map(tnote => {
    const id = Number(tnote.ID);
    const attachedTransformers = transformers.filter(t => t.tNoteId === id);
    return {
      id: id,
      date: dateOnly_(tnote.Date),
      numberOfTransformers: Number(tnote.NumberOfTransformers || attachedTransformers.length),
      transformers: attachedTransformers
    };
  });

  return { status: 'SUCCESS', data: result };
}

function getTNoteById(id) {
  const found = findRowByValue(SHEET_NAMES.TNOTES, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'TNote not found' };

  const transformers = getSheetData(SHEET_NAMES.TRANSFORMERS)
    .map(transformerRowToObj)
    .filter(t => t.tNoteId === Number(id));

  const obj = {};
  found.headers.forEach((h, idx) => { obj[h] = found.data[idx]; });

  return {
    status: 'SUCCESS',
    data: {
      id: Number(obj.ID),
      date: dateOnly_(obj.Date),
      numberOfTransformers: Number(obj.NumberOfTransformers || transformers.length),
      transformers: transformers
    }
  };
}

function addTNote(data) {
  const sheet = initializeSheet(SHEET_NAMES.TNOTES, SHEET_HEADERS.TNotes);
  const id = getNextNumericId(SHEET_NAMES.TNOTES, 'ID');
  const now = getTimestamp();

  const row = [
    id,
    data.date || new Date().toISOString().split('T')[0],
    data.numberOfTransformers || 0,
    now,
    now
  ];
  sheet.appendRow(row);
  return { status: 'SUCCESS', data: { id: id, date: data.date, numberOfTransformers: data.numberOfTransformers, transformers: [] } };
}

function updateTNote(id, data) {
  const found = findRowByValue(SHEET_NAMES.TNOTES, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'TNote not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.TNOTES);
  const headers = found.headers;

  const dateIdx = headers.indexOf('Date') + 1;
  const countIdx = headers.indexOf('NumberOfTransformers') + 1;
  const updatedIdx = headers.indexOf('UpdatedAt') + 1;

  if (dateIdx > 0 && data.date) sheet.getRange(found.rowIndex, dateIdx).setValue(data.date);
  if (countIdx > 0 && data.numberOfTransformers !== undefined) sheet.getRange(found.rowIndex, countIdx).setValue(data.numberOfTransformers);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getTNoteById(id);
}

function deleteTNote(id) {
  const found = findRowByValue(SHEET_NAMES.TNOTES, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'TNote not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.TNOTES);
  sheet.deleteRow(found.rowIndex);
  return { status: 'SUCCESS', message: 'TNote deleted successfully' };
}

// ============ DC FUNCTIONS ============

function getAllDCs() {
  const data = getSheetData(SHEET_NAMES.DCS);
  const dcs = data.map(row => ({
    dcNo: String(row.DcNo || ''),
    date: dateOnly_(row.Date),
    spmCenter: String(row.SpmCenter || ''),
    totalTransformers: Number(row.TotalTransformers || 0)
  }));
  return { status: 'SUCCESS', data: dcs };
}

function getDCByNo(dcNo) {
  const found = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
  if (!found) return { status: 'NOT_FOUND', message: 'DC not found' };
  const obj = {};
  found.headers.forEach((h, idx) => { obj[h] = found.data[idx]; });
  return {
    status: 'SUCCESS',
    data: {
      dcNo: String(obj.DcNo),
      date: dateOnly_(obj.Date),
      spmCenter: String(obj.SpmCenter || ''),
      totalTransformers: Number(obj.TotalTransformers || 0)
    }
  };
}

function addDC(data) {
  const sheet = initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
  const now = getTimestamp();
  const dcNo = String(data.dcNo || `DC-${Date.now().toString().slice(-4)}`);

  const existing = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
  if (existing) {
    return updateDC(dcNo, data);
  }

  const row = [
    dcNo,
    data.date || new Date().toISOString().split('T')[0],
    data.spmCenter || '',
    data.totalTransformers || 0,
    now,
    now
  ];
  sheet.appendRow(row);
  return { status: 'SUCCESS', data: { dcNo: dcNo, date: data.date, spmCenter: data.spmCenter, totalTransformers: data.totalTransformers } };
}

function updateDC(dcNo, data) {
  const found = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
  if (!found) return { status: 'NOT_FOUND', message: 'DC not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.DCS);
  const headers = found.headers;

  const dateIdx = headers.indexOf('Date') + 1;
  const spmIdx = headers.indexOf('SpmCenter') + 1;
  const countIdx = headers.indexOf('TotalTransformers') + 1;
  const updatedIdx = headers.indexOf('UpdatedAt') + 1;

  if (dateIdx > 0 && data.date) sheet.getRange(found.rowIndex, dateIdx).setValue(data.date);
  if (spmIdx > 0 && data.spmCenter !== undefined) sheet.getRange(found.rowIndex, spmIdx).setValue(data.spmCenter);
  if (countIdx > 0 && data.totalTransformers !== undefined) sheet.getRange(found.rowIndex, countIdx).setValue(data.totalTransformers);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getDCByNo(dcNo);
}

function deleteDC(dcNo) {
  const found = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
  if (!found) return { status: 'NOT_FOUND', message: 'DC not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.DCS);
  sheet.deleteRow(found.rowIndex);
  return { status: 'SUCCESS', message: 'DC deleted successfully' };
}

// ============ BILL FUNCTIONS ============

function getAllBills() {
  const data = getSheetData(SHEET_NAMES.BILLS);
  const bills = data.map(row => ({
    sapNo: String(row.SapNo || ''),
    date: dateOnly_(row.Date),
    spmCenter: String(row.SpmCenter || ''),
    totalTransformers: Number(row.TotalTransformers || 0),
    billAmount: Number(row.BillAmount || 0)
  }));
  return { status: 'SUCCESS', data: bills };
}

function getBillBySapNo(sapNo) {
  const found = findRowByValue(SHEET_NAMES.BILLS, 'SapNo', sapNo);
  if (!found) return { status: 'NOT_FOUND', message: 'Bill not found' };
  const obj = {};
  found.headers.forEach((h, idx) => { obj[h] = found.data[idx]; });
  return {
    status: 'SUCCESS',
    data: {
      sapNo: String(obj.SapNo),
      date: dateOnly_(obj.Date),
      spmCenter: String(obj.SpmCenter || ''),
      totalTransformers: Number(obj.TotalTransformers || 0),
      billAmount: Number(obj.BillAmount || 0)
    }
  };
}

function addBill(data) {
  const sheet = initializeSheet(SHEET_NAMES.BILLS, SHEET_HEADERS.Bills);
  const now = getTimestamp();
  const sapNo = String(data.sapNo || `SAP-${Date.now().toString().slice(-4)}`);

  const existing = findRowByValue(SHEET_NAMES.BILLS, 'SapNo', sapNo);
  if (existing) {
    return updateBill(sapNo, data);
  }

  const row = [
    sapNo,
    data.date || new Date().toISOString().split('T')[0],
    data.spmCenter || '',
    data.totalTransformers || 0,
    data.billAmount || 0,
    now,
    now
  ];
  sheet.appendRow(row);
  return { status: 'SUCCESS', data: { sapNo: sapNo, date: data.date, spmCenter: data.spmCenter, totalTransformers: data.totalTransformers, billAmount: data.billAmount } };
}

function updateBill(sapNo, data) {
  const found = findRowByValue(SHEET_NAMES.BILLS, 'SapNo', sapNo);
  if (!found) return { status: 'NOT_FOUND', message: 'Bill not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.BILLS);
  const headers = found.headers;

  const dateIdx = headers.indexOf('Date') + 1;
  const spmIdx = headers.indexOf('SpmCenter') + 1;
  const countIdx = headers.indexOf('TotalTransformers') + 1;
  const amtIdx = headers.indexOf('BillAmount') + 1;
  const updatedIdx = headers.indexOf('UpdatedAt') + 1;

  if (dateIdx > 0 && data.date) sheet.getRange(found.rowIndex, dateIdx).setValue(data.date);
  if (spmIdx > 0 && data.spmCenter !== undefined) sheet.getRange(found.rowIndex, spmIdx).setValue(data.spmCenter);
  if (countIdx > 0 && data.totalTransformers !== undefined) sheet.getRange(found.rowIndex, countIdx).setValue(data.totalTransformers);
  if (amtIdx > 0 && data.billAmount !== undefined) sheet.getRange(found.rowIndex, amtIdx).setValue(data.billAmount);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getBillBySapNo(sapNo);
}

function deleteBill(sapNo) {
  const found = findRowByValue(SHEET_NAMES.BILLS, 'SapNo', sapNo);
  if (!found) return { status: 'NOT_FOUND', message: 'Bill not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.BILLS);
  sheet.deleteRow(found.rowIndex);
  return { status: 'SUCCESS', message: 'Bill deleted successfully' };
}

// ============ QUOTATION FUNCTIONS ============

function initializeQuotationSheets() {
  const settingsSheet = initializeSheet(SHEET_NAMES.QUOTATION_SETTINGS, SHEET_HEADERS['Quotation Settings']);
  const configuredSettings = {};
  getSheetData(SHEET_NAMES.QUOTATION_SETTINGS).forEach(row => {
    configuredSettings[String(row.Setting || '')] = row;
  });
  DEFAULT_QUOTATION_SETTINGS.forEach(([setting, value]) => {
    const current = configuredSettings[setting];
    if (!current) {
      settingsSheet.appendRow([setting, value]);
    } else if (String(current.Value || '') === '') {
      const rowIndex = findRowByValue(SHEET_NAMES.QUOTATION_SETTINGS, 'Setting', setting).rowIndex;
      settingsSheet.getRange(rowIndex, 2).setValue(value);
    }
  });

  const ratesSheet = initializeSheet(SHEET_NAMES.QUOTATION_RATES, SHEET_HEADERS['Quotation Rates']);
  if (ratesSheet.getLastRow() === 1) {
    const defaultRateMap = {};
    DEFAULT_QUOTATION_RATES.forEach(row => {
      if (!defaultRateMap[row[0]]) defaultRateMap[row[0]] = {};
      defaultRateMap[row[0]][row[1]] = row[2];
    });
    const initialRates = [];
    QUOTATION_CAPACITIES.forEach(capacity => {
      QUOTATION_SERVICES.forEach(service => {
        const rate = defaultRateMap[capacity] && defaultRateMap[capacity][service] !== undefined
          ? defaultRateMap[capacity][service]
          : '';
        initialRates.push([capacity, service, rate]);
      });
    });
    ratesSheet.getRange(2, 1, initialRates.length, 3).setValues(initialRates);
  }

  initializeSheet(SHEET_NAMES.QUOTATIONS, SHEET_HEADERS.Quotations);
  initializeSheet(SHEET_NAMES.QUOTATION_FORM, SHEET_HEADERS.Quotation_Form);
}

function getQuotationConfig() {
  initializeQuotationSheets();
  const settings = {};
  getSheetData(SHEET_NAMES.QUOTATION_SETTINGS).forEach(row => {
    if (row.Setting) settings[String(row.Setting)] = String(row.Value || '');
  });

  const rates = {};
  getSheetData(SHEET_NAMES.QUOTATION_RATES).forEach(row => {
    const capacity = String(row.TransformerCapacity || '');
    const service = String(row.Service || '');
    if (!capacity || !service) return;
    if (!rates[capacity]) rates[capacity] = {};
    const rate = row.Rate === '' || row.Rate === null ? '' : Number(row.Rate);
    rates[capacity][service] = Number.isFinite(rate) ? rate : '';
  });

  return {
    status: 'SUCCESS',
    data: {
      settings,
      capacities: QUOTATION_CAPACITIES,
      services: QUOTATION_SERVICES,
      rates
    }
  };
}

function getAllQuotations() {
  initializeQuotationSheets();
  const quotations = getSheetData(SHEET_NAMES.QUOTATIONS).map(row => {
    let lineItems = [];
    try {
      lineItems = row.LineItems ? JSON.parse(row.LineItems) : [];
    } catch (error) {
      throw new Error(`Quotation ${row.QuotationNo} has invalid saved line items.`);
    }

    return {
      quotationNo: String(row.QuotationNo || ''),
      documentType: String(row.DocumentType || 'QUOTATION').toUpperCase(),
      customerName: String(row.CustomerName || ''),
      customerAddress: String(row.CustomerAddress || ''),
      contactPerson: String(row.ContactPerson || ''),
      mobile: String(row.Mobile || ''),
      email: String(row.Email || ''),
      transformerMake: String(row.TransformerMake || ''),
      transformerCapacity: String(row.TransformerCapacity || ''),
      transformerSerialNo: String(row.TransformerSerialNo || ''),
      transformerLocation: String(row.TransformerLocation || ''),
      quotationDate: dateOnly_(row.QuotationDate),
      financialYear: String(row.FinancialYear || ''),
      lineItems,
      subtotal: Number(row.Subtotal || 0),
      gstApplicable: String(row.GSTApplicable || '').toLowerCase() === 'true',
      gstRate: Number(row.GSTRate || 19),
      gstAmount: Number(row.GSTAmount || 0),
      grandTotal: Number(row.GrandTotal || 0),
      warrantyMonths: String(row.WarrantyMonths || ''),
      terms: String(row.Terms || ''),
      outputFormat: String(row.OutputFormat || 'PDF').toUpperCase(),
      fileUrl: String(row.FileUrl || row.PdfUrl || ''),
      fileId: String(row.FileId || ''),
      pdfUrl: String(row.PdfUrl || ''),
      createdAt: String(row.CreatedAt || ''),
      updatedAt: String(row.UpdatedAt || '')
    };
  });
  return { status: 'SUCCESS', data: quotations.reverse() };
}

function getQuotationByNo(quotationNo) {
  const result = getAllQuotations();
  const quotation = result.data.find(item => item.quotationNo === String(quotationNo));
  return quotation
    ? { status: 'SUCCESS', data: quotation }
    : { status: 'NOT_FOUND', message: 'Quotation not found.' };
}

function deleteQuotation(quotationNo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    initializeQuotationSheets();
    const found = findRowByValue(SHEET_NAMES.QUOTATIONS, 'QuotationNo', quotationNo);
    if (!found) return { status: 'NOT_FOUND', message: 'Quotation not found.' };

    const fileIdIndex = found.headers.indexOf('FileId');
    const fileUrlIndex = found.headers.indexOf('FileUrl');
    const pdfUrlIndex = found.headers.indexOf('PdfUrl');
    const storedFileId = fileIdIndex >= 0 ? String(found.data[fileIdIndex] || '') : '';
    const fileUrl = fileUrlIndex >= 0 ? found.data[fileUrlIndex] : '';
    const pdfUrl = pdfUrlIndex >= 0 ? found.data[pdfUrlIndex] : '';
    const fileId = storedFileId || quotationDriveFileId_(fileUrl || pdfUrl);
    if (fileId) DriveApp.getFileById(fileId).setTrashed(true);

    getOrCreateSheet(SHEET_NAMES.QUOTATIONS).deleteRow(found.rowIndex);
    return { status: 'SUCCESS', message: 'Quotation deleted successfully.' };
  } finally {
    lock.releaseLock();
  }
}

function quotationOutputFolder_(settings, documentType) {
  const rootName = settings['Quotation Root Folder'] || 'DS Transformers';
  const rootFolders = DriveApp.getRootFolder().getFoldersByName(rootName);
  const rootFolder = rootFolders.hasNext()
    ? rootFolders.next()
    : DriveApp.getRootFolder().createFolder(rootName);
  const folderName = documentType === 'BILL'
    ? settings['Bill Folder'] || 'Service Bills'
    : settings['Quotation Folder'] || 'Quotations';
  const quotationFolders = rootFolder.getFoldersByName(folderName);
  return quotationFolders.hasNext()
    ? quotationFolders.next()
    : rootFolder.createFolder(folderName);
}

function setQuotationText_(slide, text, left, top, width, height, size, bold, alignment) {
  const shape = slide.insertTextBox(String(text || ''), left, top, width, height);
  const range = shape.getText();
  range.getTextStyle()
    .setFontFamily('Arial')
    .setFontSize(size)
    .setForegroundColor('#172033')
    .setBold(Boolean(bold));
  if (alignment) range.getParagraphStyle().setParagraphAlignment(alignment);
  return shape;
}

function quotationDateLabel_(value) {
  const date = Utilities.parseDate(String(value), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function requireA4QuotationPresentation_(presentation) {
  const pointsPerMillimetre = 72 / 25.4;
  const a4Width = 210 * pointsPerMillimetre;
  const a4Height = 297 * pointsPerMillimetre;
  const width = presentation.getPageWidth();
  const height = presentation.getPageHeight();
  const tolerance = pointsPerMillimetre;

  if (Math.abs(width - a4Width) > tolerance || Math.abs(height - a4Height) > tolerance) {
    const widthCm = (width / 72 * 2.54).toFixed(2);
    const heightCm = (height / 72 * 2.54).toFixed(2);
    throw new Error(
      `The linked Google Slides template is ${widthCm} × ${heightCm} cm, not A4 portrait. ` +
      'Set the template page size to 21 × 29.7 cm (File > Page setup > Custom) and try again. ' +
      'Apps Script copies the template size and cannot change the presentation page size.'
    );
  }

  return { width, height };
}

function addQuotationSignatory_(slide, left, top, width, height) {
  const signatory = slide.insertTextBox(
    'Digitally Authorized Signatory\nM/s D.S. Transformers &\nElectrical Contractor',
    left,
    top,
    width,
    height
  );
  const text = signatory.getText();
  text.getTextStyle()
    .setFontFamily('Arial')
    .setFontSize(8)
    .setForegroundColor('#172033')
    .setBold(true);
  text.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
  return signatory;
}

function addQuotationInfoBox_(slide, heading, details, left, top, width, height) {
  const box = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, left, top, width, height);
  box.getFill().setSolidFill('#F8FAFC');
  box.getBorder().getLineFill().setSolidFill('#CBD5E1');
  box.getBorder().setWeight(1);

  setQuotationText_(slide, heading, left + 9, top + 7, width - 18, 15, 8, true);
  setQuotationText_(slide, details, left + 9, top + 25, width - 18, height - 32, 8, false);
}

function setQuotationTableColumnWidths_(presentationId, layout) {
  const requests = layout.columnWidths.map((width, columnIndex) => ({
    updateTableColumnProperties: {
      objectId: layout.tableObjectId,
      columnIndices: [columnIndex],
      tableColumnProperties: {
        columnWidth: { magnitude: width, unit: 'PT' }
      },
      fields: 'columnWidth'
    }
  }));
  const response = UrlFetchApp.fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
      payload: JSON.stringify({ requests }),
      muteHttpExceptions: true
    }
  );
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`Google Slides table layout update failed (${response.getResponseCode()}): ${response.getContentText()}`);
  }

  const presentationResponse = UrlFetchApp.fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}?fields=slides(objectId,pageElements(objectId,size,transform))`,
    {
      headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
      muteHttpExceptions: true
    }
  );
  if (presentationResponse.getResponseCode() < 200 || presentationResponse.getResponseCode() >= 300) {
    throw new Error(`Google Slides table layout verification failed (${presentationResponse.getResponseCode()}): ${presentationResponse.getContentText()}`);
  }

  const pages = JSON.parse(presentationResponse.getContentText()).slides || [];
  const pageElements = pages.reduce((all, page) => all.concat(page.pageElements || []), []);
  const tableElement = pageElements.find(element => element.objectId === layout.tableObjectId);
  if (!tableElement || !tableElement.size) {
    throw new Error('Google Slides could not verify the generated service table dimensions.');
  }
  const tableScaleY = Number((tableElement.transform || {}).scaleY || 1);
  const actualTableHeight = Number(tableElement.size.height.magnitude) * tableScaleY;
  const tableHeightDelta = actualTableHeight - layout.initialTableHeight * 12700;
  if (Math.abs(tableHeightDelta) < 1) return;

  const moveRequests = [];
  layout.belowTableObjectIds.forEach(objectId => {
    const element = pageElements.find(candidate => candidate.objectId === objectId);
    if (!element || !element.transform || !element.size) {
      throw new Error(`Google Slides could not verify generated bill layout element ${objectId}.`);
    }
    const transform = element.transform;
    const scaleY = Number(transform.scaleY || 1);
    const nextTranslateY = Number(transform.translateY || 0) + tableHeightDelta;
    const nextBottom = nextTranslateY + Number(element.size.height.magnitude) * scaleY;
    if (objectId === layout.signatoryObjectId && nextBottom > layout.maximumContentBottom) {
      throw new Error(layout.isBill
        ? 'The service table expanded beyond the available A4 bill layout. Shorten service descriptions or reduce service rows.'
        : 'The service table expanded beyond the available A4 quotation layout. Shorten service descriptions or reduce service rows.');
    }
    moveRequests.push({
      updatePageElementTransform: {
        objectId,
        applyMode: 'ABSOLUTE',
        transform: {
          scaleX: Number(transform.scaleX || 1),
          scaleY,
          shearX: Number(transform.shearX || 0),
          shearY: Number(transform.shearY || 0),
          translateX: Number(transform.translateX || 0),
          translateY: nextTranslateY,
          unit: transform.unit || 'EMU'
        }
      }
    });
  });
  if (moveRequests.length === 0) return;
  const moveResponse = UrlFetchApp.fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
      payload: JSON.stringify({ requests: moveRequests }),
      muteHttpExceptions: true
    }
  );
  if (moveResponse.getResponseCode() < 200 || moveResponse.getResponseCode() >= 300) {
    throw new Error(`Google Slides bill layout adjustment failed (${moveResponse.getResponseCode()}): ${moveResponse.getContentText()}`);
  }
}

function indianNumberWords_(value) {
  const number = Math.floor(Number(value));
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Bill total is outside the supported range for amount in words.');
  if (number === 0) return 'Zero';

  const underThousand = (part) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const words = [];
    if (part >= 100) {
      words.push(`${ones[Math.floor(part / 100)]} Hundred`);
      part %= 100;
    }
    if (part >= 20) {
      words.push(`${tens[Math.floor(part / 10)]}${part % 10 ? ` ${ones[part % 10]}` : ''}`);
    } else if (part >= 10) {
      words.push(teens[part - 10]);
    } else if (part > 0) {
      words.push(ones[part]);
    }
    return words.join(' ');
  };

  const scales = [
    [1e11, 'Kharab'],
    [1e9, 'Arab'],
    [1e7, 'Crore'],
    [1e5, 'Lakh'],
    [1e3, 'Thousand']
  ];
  let remainder = number;
  const words = [];
  scales.forEach(([divisor, label]) => {
    const part = Math.floor(remainder / divisor);
    if (part > 0) {
      words.push(`${part < 1000 ? underThousand(part) : indianNumberWords_(part)} ${label}`);
      remainder %= divisor;
    }
  });
  if (remainder > 0) words.push(underThousand(remainder));
  return words.join(' ');
}

function indianCurrencyWords_(amount) {
  const roundedPaise = Math.round(Number(amount) * 100);
  const rupees = Math.floor(roundedPaise / 100);
  const paise = roundedPaise % 100;
  const rupeeWords = `Rupees ${indianNumberWords_(rupees)}`;
  return paise ? `${rupeeWords} and ${indianNumberWords_(paise)} Paise Only` : `${rupeeWords} Only`;
}

function addQuotationSlideContent_(slide, presentation, quotation, settings) {
  const pageSize = requireA4QuotationPresentation_(presentation);
  const isBill = quotation.documentType === 'BILL';
  const pageWidth = pageSize.width;
  const pageHeight = pageSize.height;
  const margin = Math.min(42, pageWidth * 0.07);
  const contentWidth = pageWidth - margin * 2;
  const top = Math.min(140, pageHeight * 0.166);
  const signatoryHeight = Math.min(38, Math.max(32, pageHeight * 0.045));
  const termsHeight = Math.min(90, Math.max(65, pageHeight * 0.107));
  const closingGap = Math.min(6, pageHeight * 0.008);
  const bottomMargin = isBill
    ? 150
    : Math.min(90, Math.max(42, pageHeight * 0.107));
  const signatoryTop = pageHeight - bottomMargin - signatoryHeight;
  const termsTop = signatoryTop - closingGap - termsHeight;
  const date = quotationDateLabel_(quotation.quotationDate);
  const subject = `${isBill ? 'Bill' : 'Quotation'} for ${quotation.transformerCapacity} Transformer${quotation.transformerMake ? ` - ${quotation.transformerMake}` : ''}`;

  setQuotationText_(slide, isBill ? 'SERVICE BILL' : 'QUOTATION', margin, top, contentWidth, 26, 18, true, SlidesApp.ParagraphAlignment.CENTER);
  setQuotationText_(
    slide,
    `${isBill ? 'Bill' : 'Quotation'} No.: ${quotation.quotationNo}  |  Date: ${date}`,
    margin,
    top + 28,
    contentWidth,
    18,
    9,
    true,
    SlidesApp.ParagraphAlignment.CENTER
  );

  const subjectTop = top + 53;
  setQuotationText_(slide, subject, margin, subjectTop, contentWidth, 19, 10, true);
  const boxTop = subjectTop + 24;
  const boxGap = 12;
  const boxWidth = (contentWidth - boxGap) / 2;
  const boxHeight = Math.min(90, Math.max(74, pageHeight * 0.107));
  addQuotationInfoBox_(
    slide,
    'CUSTOMER DETAILS',
    [
      `Name: ${quotation.customerName}`,
      `Contact: ${quotation.contactPerson || '—'}`,
      `Mobile: ${quotation.mobile}`,
      `Email: ${quotation.email || '—'}`,
      `Address: ${quotation.customerAddress || '—'}`
    ].join('\n'),
    margin,
    boxTop,
    boxWidth,
    boxHeight
  );
  addQuotationInfoBox_(
    slide,
    'TRANSFORMER DETAILS',
    [
      `Make: ${quotation.transformerMake || '—'}`,
      `Capacity: ${quotation.transformerCapacity}`,
      `Serial No.: ${quotation.transformerSerialNo || '—'}`,
      `Location: ${quotation.transformerLocation || '—'}`
    ].join('\n'),
    margin + boxWidth + boxGap,
    boxTop,
    boxWidth,
    boxHeight
  );

  const serviceTop = boxTop + boxHeight + 11;
  setQuotationText_(slide, isBill ? 'SERVICE DETAILS' : 'SERVICES / RATES', margin, serviceTop, contentWidth, 18, 10, true);
  const tableTop = serviceTop + 21;
  const billTotalsHeight = 58;
  const billTableTotalsGap = 6;
  const tableReflowAllowance = 24;
  const billTermsGap = 8;
  const billHeadingAndWarrantyHeight = 43;
  const billTerms = isBill
    ? String(quotation.terms || '').trim() || [
      '1. This bill covers only the services and materials expressly listed above.',
      '2. Any work or materials outside the stated scope require prior written approval and may be charged separately.',
      '3. The customer shall provide safe access, required shutdowns, permits and site facilities for the agreed work.',
      '4. Warranty, if stated, applies only to the specified work and is subject to the agreed scope and exclusions.',
      '5. Any concern regarding this bill should be notified in writing within seven days of receipt.',
      '6. This document is subject to applicable laws and the jurisdiction agreed between the parties.'
    ].join('\n')
    : '';
  const termsLineCapacity = Math.max(40, Math.floor(contentWidth / 4));
  const termsLineCount = isBill
    ? billTerms.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / termsLineCapacity)), 0)
    : 0;
  const billTermsTextHeight = Math.max(18, termsLineCount * 9);
  const tableBottom = isBill
    ? signatoryTop - closingGap - billTermsTextHeight - billHeadingAndWarrantyHeight - billTermsGap - billTotalsHeight - billTableTotalsGap
    : termsTop - 10;
  const rowHeight = isBill ? 14.25 : 16.5;
  const tableHeight = (quotation.lineItems.length + 1) * rowHeight;
  if (tableTop + tableHeight > tableBottom) {
    throw new Error('There are too many service rows to fit above the warranty and signatory. Remove some services and try again.');
  }
  const table = slide.insertTable(quotation.lineItems.length + 1, isBill ? 6 : 3, margin, tableTop, contentWidth, tableHeight);
  const columnWidths = isBill
    ? [32, contentWidth - 257, 32, 36, 70, 87]
    : [32, contentWidth - 155, 123];

  const headers = isBill ? ['#', 'Description of Work / Service', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)'] : ['#', 'Description of Work / Service', 'Rate'];
  headers.forEach((header, column) => {
    const cell = table.getCell(0, column);
    cell.getText().setText(header);
    cell.getFill().setSolidFill('#1e3a5f');
    cell.getText().getTextStyle().setFontFamily('Arial').setFontSize(8).setForegroundColor('#ffffff').setBold(true);
    cell.getText().getParagraphStyle().setParagraphAlignment(isBill && column >= 4 ? SlidesApp.ParagraphAlignment.END : SlidesApp.ParagraphAlignment.START);
  });

  const subtotal = Math.round(quotation.lineItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0) * 100) / 100;
  const gstAmount = isBill && quotation.gstApplicable ? Math.round(subtotal * Number(quotation.gstRate || 19) * 100) / 100 : 0;
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;
  quotation.lineItems.forEach((item, index) => {
    const row = index + 1;
    const itemDescription = String(item.description || item.service);
    const description = itemDescription === item.service
      ? item.service
      : `${item.service}: ${itemDescription}`;
    const rateUnit = item.service === 'Transformer Oil Filtration' || item.service === 'New Transformer Oil'
      ? '/litre'
      : item.service === 'Earth Pit Testing' ? '/pit' : '';
    const rate = `₹${Number(item.rate).toLocaleString('en-IN')}${rateUnit}`;
    const values = isBill
      ? [String(index + 1), description, String(Number(item.quantity || 0)), String(item.unit || 'unit'), `₹${Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `₹${(Number(item.quantity || 0) * Number(item.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
      : [String(index + 1), description, rate];
    values.forEach((value, column) => {
      const cell = table.getCell(row, column);
      cell.getText().setText(value);
      cell.getText().getTextStyle().setFontFamily('Arial').setFontSize(7.5).setForegroundColor('#172033');
      cell.getText().getParagraphStyle().setParagraphAlignment(isBill && column >= 4 ? SlidesApp.ParagraphAlignment.END : SlidesApp.ParagraphAlignment.START);
    });
  });

  let billSignatoryTop = signatoryTop;
  const belowTableObjectIds = [];
  if (isBill) {
    const renderedTableHeight = table.getHeight();
    const totalsTop = tableTop + renderedTableHeight + billTableTotalsGap;
    const totalsPanel = slide.insertShape(
      SlidesApp.ShapeType.RECTANGLE,
      margin,
      totalsTop,
      contentWidth,
      billTotalsHeight
    );
    totalsPanel.getFill().setSolidFill('#F8FAFC');
    totalsPanel.getBorder().getLineFill().setSolidFill('#DBE3ED');
    totalsPanel.getBorder().setWeight(0.75);
    belowTableObjectIds.push(totalsPanel.getObjectId());
    const totals = [
      `Subtotal: ₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ...(quotation.gstApplicable ? [`GST (${Number(quotation.gstRate || 19)}%): ₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`] : []),
      `TOTAL AMOUNT: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ].join('\n');
    const totalsShape = setQuotationText_(
      slide,
      totals,
      margin + contentWidth * 0.55,
      totalsTop,
      contentWidth * 0.45,
      40,
      8,
      true,
      SlidesApp.ParagraphAlignment.END
    );
    belowTableObjectIds.push(totalsShape.getObjectId());
    const amountWordsShape = setQuotationText_(
      slide,
      `Amount in words: ${indianCurrencyWords_(grandTotal)}`,
      margin,
      totalsTop,
      contentWidth * 0.52,
      billTotalsHeight,
      7.5,
      true,
      SlidesApp.ParagraphAlignment.START
    );
    belowTableObjectIds.push(amountWordsShape.getObjectId());
    const warrantyHeadingTop = totalsTop + billTotalsHeight + billTermsGap;
    const panelPadding = 8;
    const warrantyTextTop = warrantyHeadingTop + 12;
    const termsHeadingTop = warrantyTextTop + 15;
    const termsTextTop = termsHeadingTop + 10;
    const termsTextHeight = billTermsTextHeight;
    const termsPanelTop = warrantyHeadingTop - 4;
    const termsPanelHeight = termsTextTop + termsTextHeight + panelPadding - termsPanelTop;
    const termsPanel = slide.insertShape(
      SlidesApp.ShapeType.RECTANGLE,
      margin,
      termsPanelTop,
      contentWidth,
      termsPanelHeight
    );
    termsPanel.getFill().setSolidFill('#FFFFFF');
    termsPanel.getBorder().getLineFill().setSolidFill('#DBE3ED');
    termsPanel.getBorder().setWeight(0.75);
    belowTableObjectIds.push(termsPanel.getObjectId());
    billSignatoryTop = termsPanelTop + termsPanelHeight + closingGap;
    if (tableTop + renderedTableHeight > tableBottom + tableReflowAllowance ||
        billSignatoryTop + signatoryHeight > pageHeight - bottomMargin) {
      throw new Error('There are too many service rows or terms to fit above the digital signatory. Reduce the service rows or shorten the terms.');
    }

    belowTableObjectIds.push(setQuotationText_(slide, 'WARRANTY', margin + panelPadding, warrantyHeadingTop, contentWidth - panelPadding * 2, 10, 7.5, true).getObjectId());
    belowTableObjectIds.push(setQuotationText_(
      slide,
      quotation.warrantyMonths
        ? `Warranty valid for ${quotation.warrantyMonths} months from completion / commissioning, limited to the specified work.`
        : 'Warranty, wherever applicable, will be as specified for the respective work.',
      margin + panelPadding,
      warrantyTextTop,
      contentWidth - panelPadding * 2,
      13,
      7.5,
      false
    ).getObjectId());
    belowTableObjectIds.push(setQuotationText_(slide, 'TERMS & CONDITIONS', margin + panelPadding, termsHeadingTop, contentWidth - panelPadding * 2, 10, 7.5, true).getObjectId());
    belowTableObjectIds.push(setQuotationText_(slide, billTerms, margin + panelPadding, termsTextTop, contentWidth - panelPadding * 2, termsTextHeight, 7.5, false).getObjectId());
  } else {
    const termsShape = setQuotationText_(
      slide,
      [
        'WARRANTY',
        'Warranty, wherever applicable, will be as specified for the respective work.',
        'TERMS & CONDITIONS',
        '1. This quotation is valid for 15 days from the date of issue.',
        '2. The scope of work shall be as specified in this quotation.',
        '3. Any additional work or materials required beyond the stated scope shall be quoted separately.',
        '4. Warranty, wherever applicable, shall be as specified for the respective work.',
        '5. Payment terms shall be as mutually agreed between the parties.'
      ].join('\n'),
      margin,
      termsTop,
      contentWidth,
      termsHeight,
      7.5,
      false
    );
    belowTableObjectIds.push(termsShape.getObjectId());
  }
  const signatory = addQuotationSignatory_(
    slide,
    margin + contentWidth * 0.48,
    billSignatoryTop,
    contentWidth * 0.52,
    signatoryHeight
  );
  belowTableObjectIds.push(signatory.getObjectId());
  return {
    tableObjectId: table.getObjectId(),
    columnWidths,
    initialTableHeight: table.getHeight(),
    belowTableObjectIds,
    signatoryObjectId: signatory.getObjectId(),
    isBill,
    maximumContentBottom: Math.min(
      pageHeight - 24,
      isBill ? pageHeight - bottomMargin + tableReflowAllowance : pageHeight - 24
    ) * 12700
  };
}

function exportSlidePng_(presentationId, slideId, fileName) {
  const thumbnailUrl = `https://slides.googleapis.com/v1/presentations/${presentationId}/pages/${slideId}/thumbnail?thumbnailProperties.mimeType=PNG&thumbnailProperties.thumbnailSize=LARGE`;
  const thumbnailResponse = UrlFetchApp.fetch(thumbnailUrl, {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true
  });
  if (thumbnailResponse.getResponseCode() < 200 || thumbnailResponse.getResponseCode() >= 300) {
    throw new Error(`Google Slides thumbnail export failed (${thumbnailResponse.getResponseCode()}): ${thumbnailResponse.getContentText()}`);
  }

  const thumbnail = JSON.parse(thumbnailResponse.getContentText());
  if (!thumbnail.contentUrl) throw new Error('Google Slides did not return a PNG thumbnail URL.');
  const imageResponse = UrlFetchApp.fetch(thumbnail.contentUrl, { muteHttpExceptions: true });
  if (imageResponse.getResponseCode() < 200 || imageResponse.getResponseCode() >= 300) {
    throw new Error(`Quotation PNG download failed (${imageResponse.getResponseCode()}).`);
  }
  return imageResponse.getBlob().setContentType(MimeType.PNG).setName(fileName);
}

function generateQuotationFile_(quotation, settings) {
  const format = String(quotation.outputFormat || 'PDF').toUpperCase();
  if (format !== 'PDF' && format !== 'PNG') throw new Error('Choose PDF or PNG as the quotation output format.');

  const templateId = settings['Letterhead Presentation ID'] || '1W7qyj0bRI5jbMlgc-RtXA-UYnbOvxBaqvBk-nrvF-5U';
  const templateFile = DriveApp.getFileById(templateId);
  const outputFolder = quotationOutputFolder_(settings, quotation.documentType);
  const safeName = quotation.quotationNo.replace(/[^A-Za-z0-9_-]/g, '_');
  const temporaryCopy = templateFile.makeCopy(`TEMP_${safeName}`);
  try {
    const presentation = SlidesApp.openById(temporaryCopy.getId());
    const slides = presentation.getSlides();
    if (slides.length === 0) throw new Error('The configured letterhead presentation has no slides.');
    slides.slice(1).forEach(slide => slide.remove());
    const tableLayout = addQuotationSlideContent_(slides[0], presentation, quotation, settings);
    presentation.saveAndClose();
    setQuotationTableColumnWidths_(temporaryCopy.getId(), tableLayout);

    const extension = format.toLowerCase();
    const fileName = `${safeName}.${extension}`;
    const outputBlob = format === 'PDF'
      ? temporaryCopy.getAs(MimeType.PDF).setName(fileName)
      : exportSlidePng_(temporaryCopy.getId(), slides[0].getObjectId(), fileName);
    const outputFile = outputFolder.createFile(outputBlob);
    return {
      format,
      fileId: outputFile.getId(),
      fileUrl: outputFile.getUrl(),
      pdfUrl: format === 'PDF' ? outputFile.getUrl() : ''
    };
  } finally {
    temporaryCopy.setTrashed(true);
  }
}

function writeQuotationForm_(quotation) {
  const sheet = initializeSheet(SHEET_NAMES.QUOTATION_FORM, SHEET_HEADERS.Quotation_Form);
  const row = {
    QuotationNo: quotation.quotationNo,
    CustomerName: quotation.customerName,
    CustomerAddress: quotation.customerAddress,
    ContactPerson: quotation.contactPerson,
    Mobile: quotation.mobile,
    TransformerMake: quotation.transformerMake,
    TransformerCapacity: quotation.transformerCapacity,
    TransformerSerialNo: quotation.transformerSerialNo,
    TransformerLocation: quotation.transformerLocation,
    QuotationDate: quotation.quotationDate,
    FinancialYear: quotation.financialYear,
    LineItems: JSON.stringify(quotation.lineItems),
    OutputFormat: quotation.outputFormat,
    DocumentType: quotation.documentType,
    Subtotal: quotation.subtotal,
    GSTApplicable: quotation.gstApplicable,
    GSTRate: quotation.gstRate,
    GSTAmount: quotation.gstAmount,
    GrandTotal: quotation.grandTotal,
    WarrantyMonths: quotation.warrantyMonths,
    Terms: quotation.terms,
    UpdatedAt: quotation.updatedAt
  };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.getRange(2, 1, 1, headers.length).setValues([headers.map(header => row[header] || '')]);
}

function quotationDriveFileId_(url) {
  const match = String(url || '').match(/(?:\/d\/|[?&]id=)([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}

function saveQuotation(data) {
  initializeQuotationSheets();
  const documentType = String(data && data.documentType || 'QUOTATION').toUpperCase();
  if (documentType !== 'QUOTATION' && documentType !== 'BILL') {
    throw new Error('Choose either a quotation or bill document.');
  }
  if (!data || !String(data.customerName || '').trim()) {
    throw new Error('Customer Name is required.');
  }
  if (!String(data.mobile || '').trim()) throw new Error('Mobile is required.');
  if (!QUOTATION_CAPACITIES.includes(String(data.transformerCapacity || ''))) {
    throw new Error('Select a valid transformer capacity.');
  }
  if (!Array.isArray(data.lineItems) || data.lineItems.length === 0) {
    throw new Error('Add at least one service to the quotation.');
  }

  const outputFormat = String(data.outputFormat || 'PDF').toUpperCase();
  if (outputFormat !== 'PDF' && outputFormat !== 'PNG') throw new Error('Choose PDF or PNG as the quotation output format.');

  const seenServices = {};
  const lineItems = data.lineItems.map(item => {
    const service = String(item.service || '');
    if (!QUOTATION_SERVICES.includes(service)) throw new Error(`Unknown quotation service: ${service}`);
    if (seenServices[service]) throw new Error(`${service} can only be added once.`);
    seenServices[service] = true;
    const rate = Number(item.rate);
    if (!Number.isFinite(rate) || rate < 0) throw new Error(`Enter a valid rate for ${service}.`);
    const lineItem = { service, description: String(item.description || service), rate };
    if (documentType === 'BILL') {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Enter a quantity greater than zero for ${service}.`);
      lineItem.quantity = quantity;
      lineItem.unit = String(item.unit || 'unit').trim();
      if (!lineItem.unit) throw new Error(`Enter a unit for ${service}.`);
    }
    return lineItem;
  });
  const subtotal = Math.round(lineItems.reduce((sum, item) => sum + (documentType === 'BILL' ? item.quantity : 1) * item.rate, 0) * 100) / 100;
  const gstApplicable = documentType === 'BILL' && (data.gstApplicable === true || String(data.gstApplicable).toLowerCase() === 'true');
  const gstRate = gstApplicable ? 19 : 0;
  const gstAmount = gstApplicable ? Math.round(subtotal * gstRate) / 100 : 0;
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;
  const warrantyMonths = documentType === 'BILL' && data.warrantyMonths !== '' && data.warrantyMonths != null
    ? Number(data.warrantyMonths)
    : 0;
  if (documentType === 'BILL' && (!Number.isInteger(warrantyMonths) || warrantyMonths < 0)) {
    throw new Error('Warranty period must be a whole number of months.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const settings = getQuotationConfig().data.settings;
    const sheet = initializeSheet(SHEET_NAMES.QUOTATIONS, SHEET_HEADERS.Quotations);
    const existingNo = String(data.quotationNo || '');
    const existing = existingNo ? findRowByValue(SHEET_NAMES.QUOTATIONS, 'QuotationNo', existingNo) : null;
    if (existingNo && !existing) throw new Error(`${documentType === 'BILL' ? 'Bill' : 'Quotation'} ${existingNo} was not found.`);
    if (existing) {
      const existingTypeIndex = existing.headers.indexOf('DocumentType');
      const existingType = existingTypeIndex >= 0 ? String(existing.data[existingTypeIndex] || 'QUOTATION').toUpperCase() : 'QUOTATION';
      if (existingType !== documentType) throw new Error('The document type cannot be changed after creation.');
    }
    const financialYear = String(data.financialYear || settings['Financial Year'] || '');
    if (!/^\d{2}-\d{2}$/.test(financialYear)) throw new Error('Financial Year must use the format YY-YY.');
    let quotationNo = existingNo;
    const now = getTimestamp();

    if (!existing) {
      const startingNumber = Number(settings['Starting Quotation Number'] || 1);
      const allRows = getSheetData(SHEET_NAMES.QUOTATIONS);
      const usedNumbers = allRows
        .filter(row => String(row.FinancialYear || '') === financialYear &&
          String(row.DocumentType || 'QUOTATION').toUpperCase() === documentType)
        .map(row => {
          const savedNumber = String(row.QuotationNo || '');
          const currentFormat = savedNumber.match(/^VST\/\d{2}-\d{2}\/\d{4}-(\d+)$/);
          const billFormat = savedNumber.match(/^BILL\/\d{2}-\d{2}\/\d{4}-(\d+)$/);
          const legacyFormat = savedNumber.match(/^(\d+)-\d{2}-\d{2}$/);
          return Number((documentType === 'BILL' ? billFormat : currentFormat || legacyFormat || [])[1] || 0);
        });
      let nextNumber = Math.max(startingNumber - 1, ...usedNumbers) + 1;
      const dateValue = String(data.quotationDate || new Date().toISOString().split('T')[0]);
      const date = Utilities.parseDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const dateCode = Utilities.formatDate(date, Session.getScriptTimeZone(), 'ddMM');
      quotationNo = `${documentType === 'BILL' ? 'BILL' : 'VST'}/${financialYear}/${dateCode}-${nextNumber}`;
      while (findRowByValue(SHEET_NAMES.QUOTATIONS, 'QuotationNo', quotationNo)) {
        nextNumber++;
        quotationNo = `${documentType === 'BILL' ? 'BILL' : 'VST'}/${financialYear}/${dateCode}-${nextNumber}`;
      }
    }

    const quotation = {
      quotationNo,
      documentType,
      customerName: String(data.customerName).trim(),
      customerAddress: String(data.customerAddress || '').trim(),
      contactPerson: String(data.contactPerson || '').trim(),
      mobile: String(data.mobile).trim(),
      email: String(data.email || '').trim(),
      transformerMake: String(data.transformerMake || '').trim(),
      transformerCapacity: String(data.transformerCapacity),
      transformerSerialNo: String(data.transformerSerialNo || '').trim(),
      transformerLocation: String(data.transformerLocation || '').trim(),
      quotationDate: String(data.quotationDate || new Date().toISOString().split('T')[0]),
      financialYear,
      outputFormat,
      lineItems,
      subtotal: documentType === 'BILL' ? subtotal : '',
      gstApplicable,
      gstRate,
      gstAmount,
      grandTotal: documentType === 'BILL' ? grandTotal : '',
      warrantyMonths: documentType === 'BILL' ? warrantyMonths : '',
      terms: documentType === 'BILL' ? String(data.terms || '').trim() : '',
      createdAt: existing ? String(existing.data[existing.headers.indexOf('CreatedAt')] || now) : now,
      updatedAt: now
    };
    writeQuotationForm_(quotation);
    const outputFile = generateQuotationFile_(quotation, settings);
    quotation.fileUrl = outputFile.fileUrl;
    quotation.fileId = outputFile.fileId;
    quotation.pdfUrl = outputFile.pdfUrl;

    const oldFileId = existing
      ? String(existing.data[existing.headers.indexOf('FileId')] || quotationDriveFileId_(
        existing.data[existing.headers.indexOf('PdfUrl')]
      ))
      : '';
    if (oldFileId && oldFileId !== quotation.fileId) DriveApp.getFileById(oldFileId).setTrashed(true);

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const rowValues = {
      QuotationNo: quotation.quotationNo,
      CustomerName: quotation.customerName,
      CustomerAddress: quotation.customerAddress,
      ContactPerson: quotation.contactPerson,
      Mobile: quotation.mobile,
      Email: quotation.email,
      TransformerMake: quotation.transformerMake,
      TransformerCapacity: quotation.transformerCapacity,
      TransformerSerialNo: quotation.transformerSerialNo,
      TransformerLocation: quotation.transformerLocation,
      QuotationDate: quotation.quotationDate,
      FinancialYear: quotation.financialYear,
      LineItems: JSON.stringify(quotation.lineItems),
      Subtotal: quotation.subtotal,
      DocumentType: quotation.documentType,
      GSTApplicable: quotation.gstApplicable,
      GSTRate: quotation.gstRate,
      GSTAmount: quotation.gstAmount,
      GrandTotal: quotation.grandTotal,
      WarrantyMonths: quotation.warrantyMonths,
      Terms: quotation.terms,
      PdfUrl: quotation.pdfUrl,
      FileUrl: quotation.fileUrl,
      FileId: quotation.fileId,
      OutputFormat: quotation.outputFormat,
      CreatedAt: quotation.createdAt,
      UpdatedAt: quotation.updatedAt
    };
    const values = headers.map(header => rowValues[header] === undefined ? '' : rowValues[header]);
    if (existing) {
      sheet.getRange(existing.rowIndex, 1, 1, values.length).setValues([values]);
    } else {
      sheet.appendRow(values);
    }
    return { status: 'SUCCESS', data: quotation };
  } finally {
    lock.releaseLock();
  }
}

// ============ SAMPLE DATA INITIALIZER ============

function initializeSampleData() {
  for (const [name, headers] of Object.entries(SHEET_HEADERS)) {
    initializeSheet(name, headers);
  }
  initializeServices();

  // Seed sample TNotes if empty
  const tnoteSheet = getOrCreateSheet(SHEET_NAMES.TNOTES);
  if (tnoteSheet.getLastRow() <= 1) {
    const today = new Date();
    const d1 = new Date(today); d1.setDate(d1.getDate() - 10);
    const d2 = new Date(today); d2.setDate(d2.getDate() - 5);
    const d3 = new Date(today); d3.setDate(d3.getDate() - 2);

    addTNote({ date: d1.toISOString().split('T')[0], numberOfTransformers: 10 });
    addTNote({ date: d2.toISOString().split('T')[0], numberOfTransformers: 20 });
    addTNote({ date: d3.toISOString().split('T')[0], numberOfTransformers: 20 });
  }

  // Seed sample Transformers if empty
  const transSheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
  if (transSheet.getLastRow() <= 1) {
    const spmCenters = ['Warangal', 'Salem', 'Rajahmundry', 'Mysuru', 'Karimnagar'];
    const types = ['Distribution', 'Power', 'Step-up', 'Step-down'];
    const statuses = ['Recieved', 'Assesment', 'Repair In Progress', 'Repaired', 'Delivered', 'Billed'];

    let count = 0;
    const tNoteIds = [1, 2, 3];
    const tNoteLimits = [10, 20, 20];

    tNoteIds.forEach((tNoteId, idx) => {
      const limit = tNoteLimits[idx];
      for (let i = 1; i <= limit && count < 50; i++, count++) {
        const status = statuses[count % statuses.length];
        addTransformer({
          spmCenter: spmCenters[count % spmCenters.size || count % spmCenters.length],
          dtrNo: `DTR-${2400 + count}`,
          sNo: `SN-${1000 + count}`,
          capacity: 100 + (count % 5) * 50,
          type: types[count % types.length],
          oilCapacity: 50.0 + (count % 3) * 10,
          status: status,
          tNoteId: tNoteId,
          dcNo: status === 'Delivered' || status === 'Billed' ? `DC-${1000 + (count % 5)}` : '',
          sapNo: status === 'Billed' ? `SAP-${1000 + (count % 5)}` : ''
        });
      }
    });
  }

  // Seed sample Bills if empty
  const billSheet = getOrCreateSheet(SHEET_NAMES.BILLS);
  if (billSheet.getLastRow() <= 1) {
    const centers = ['Warangal', 'Salem', 'Rajahmundry', 'Mysuru', 'Karimnagar'];
    for (let i = 0; i < 5; i++) {
      const d = new Date(); d.setDate(d.getDate() - (i * 3));
      addBill({
        sapNo: `SAP-${1000 + i}`,
        date: d.toISOString().split('T')[0],
        spmCenter: centers[i % centers.length],
        totalTransformers: 2 + i,
        billAmount: 150000 + (i * 25000)
      });
    }
  }

  // Seed sample DCs if empty
  const dcSheet = getOrCreateSheet(SHEET_NAMES.DCS);
  if (dcSheet.getLastRow() <= 1) {
    const centers = ['Warangal', 'Salem', 'Rajahmundry', 'Mysuru', 'Karimnagar'];
    for (let i = 0; i < 5; i++) {
      const d = new Date(); d.setDate(d.getDate() - (i * 4));
      addDC({
        dcNo: `DC-${1000 + i}`,
        date: d.toISOString().split('T')[0],
        spmCenter: centers[i % centers.length],
        totalTransformers: 3 + i
      });
    }
  }

  return { status: 'SUCCESS', message: 'All sheets and sample data initialized' };
}

// ============ POST & GET HANDLERS ============

function doPost(e) {
  try {
    const raw = JSON.parse(e.postData.contents);
    const action = String(raw.action || '').toUpperCase();
    const payload = raw.payload || raw;

    let result;
    switch (action) {
      // Enquiry
      case 'ADD_ENQUIRY':
      case 'ADDENQUIRY':
        result = addEnquiry(payload);
        break;
      case 'GET_ENQUIRIES':
      case 'GETALLENQUIRIES':
        result = getAllEnquiries();
        break;
      case 'GET_ENQUIRY_BY_ID':
      case 'GETENQUIRYBYID':
        result = getEnquiryById(payload.id || raw.id);
        break;
      case 'GET_ENQUIRIES_BY_STATUS':
      case 'GETENQUIRIESBYSTATUS':
        result = getEnquiriesByStatus(payload.status || raw.status);
        break;
      case 'GET_ENQUIRIES_BY_PHONE':
      case 'GETENQUIRIESBYPHONE':
        result = getEnquiriesByPhone(payload.phone || raw.phone);
        break;
      case 'UPDATE_ENQUIRY_STATUS':
      case 'UPDATEENQUIRYSTATUS':
        result = updateEnquiryStatus(payload.id || raw.id, payload.status || raw.status, payload.notes || raw.notes);
        break;

      // Quotations
      case 'GET_QUOTATION_CONFIG':
        result = getQuotationConfig();
        break;
      case 'GET_QUOTATIONS':
        result = getAllQuotations();
        break;
      case 'GET_QUOTATION_BY_NO':
        result = getQuotationByNo(payload.quotationNo || raw.quotationNo);
        break;
      case 'SAVE_QUOTATION':
        result = saveQuotation(payload);
        break;
      case 'DELETE_QUOTATION':
        result = deleteQuotation(payload.quotationNo || raw.quotationNo);
        break;

      // Service
      case 'INIT_SERVICES':
      case 'INITIALIZESERVICES':
        result = initializeServices();
        break;
      case 'GET_SERVICES':
      case 'GETSERVICES':
        result = getAllServices();
        break;
      case 'GET_SERVICE_BY_ID':
      case 'GETSERVICEBYID':
        result = getServiceById(payload.id || raw.id);
        break;

      // Jobs
      case 'ADD_JOB':
      case 'ADDJOB':
        result = addJob(payload);
        break;
      case 'GET_JOBS':
      case 'GETALLJOBS':
        result = getAllJobs();
        break;
      case 'GET_JOBS_BY_STATUS':
      case 'GETJOBSBYSTATUS':
        result = getJobsByStatus(payload.status || raw.status);
        break;

      // Transformers
      case 'GET_TRANSFORMERS':
      case 'GETALLTRANSFORMERS':
        result = getAllTransformers();
        break;
      case 'GET_TRANSFORMER_BY_ID':
      case 'GETTRANSFORMERBYID':
        result = getTransformerById(payload.id || raw.id);
        break;
      case 'ADD_TRANSFORMER':
      case 'ADDTRANSFORMER':
        result = addTransformer(payload);
        break;
      case 'UPDATE_TRANSFORMER':
      case 'UPDATETRANSFORMER':
        result = updateTransformer(payload.id || raw.id, payload);
        break;
      case 'UPDATE_TRANSFORMER_STATUS':
      case 'UPDATETRANSFORMERSTATUS':
        result = updateTransformerStatus(payload.id || raw.id, payload.status || raw.status);
        break;
      case 'DELIVER_TRANSFORMER':
      case 'DELIVERTRANSFORMER':
        result = deliverTransformer(payload.id || raw.id, payload.dcNo || raw.dcNo);
        break;
      case 'BILL_TRANSFORMER':
      case 'BILLTRANSFORMER':
        result = billTransformer(payload.id || raw.id, payload.sapNo || raw.sapNo);
        break;
      case 'GET_TRANSFORMERS_SUMMARY':
      case 'GETTRANSFORMERSSUMMARY':
        result = getTransformersSummary();
        break;

      // TNotes
      case 'GET_TNOTES':
      case 'GETALLTNOTES':
        result = getAllTNotes();
        break;
      case 'GET_TNOTE_BY_ID':
      case 'GETTNOTEBYID':
        result = getTNoteById(payload.id || raw.id);
        break;
      case 'ADD_TNOTE':
      case 'ADDTNOTE':
        result = addTNote(payload);
        break;
      case 'UPDATE_TNOTE':
      case 'UPDATETNOTE':
        result = updateTNote(payload.id || raw.id, payload);
        break;
      case 'DELETE_TNOTE':
      case 'DELETETNOTE':
        result = deleteTNote(payload.id || raw.id);
        break;

      // DCs
      case 'GET_DCS':
      case 'GETALLDCS':
        result = getAllDCs();
        break;
      case 'GET_DC_BY_NO':
      case 'GETDCBYNO':
        result = getDCByNo(payload.dcNo || raw.dcNo);
        break;
      case 'ADD_DC':
      case 'ADDDC':
        result = addDC(payload);
        break;
      case 'UPDATE_DC':
      case 'UPDATEDC':
        result = updateDC(payload.dcNo || raw.dcNo, payload);
        break;
      case 'DELETE_DC':
      case 'DELETEDC':
        result = deleteDC(payload.dcNo || raw.dcNo);
        break;

      // Bills
      case 'GET_BILLS':
      case 'GETALLBILLS':
        result = getAllBills();
        break;
      case 'GET_BILL_BY_SAP':
      case 'GETBILLBYSAP':
        result = getBillBySapNo(payload.sapNo || raw.sapNo);
        break;
      case 'ADD_BILL':
      case 'ADDBILL':
        result = addBill(payload);
        break;
      case 'UPDATE_BILL':
      case 'UPDATEBILL':
        result = updateBill(payload.sapNo || raw.sapNo, payload);
        break;
      case 'DELETE_BILL':
      case 'DELETEBILL':
        result = deleteBill(payload.sapNo || raw.sapNo);
        break;

      // Initializer
      case 'INIT_SAMPLE_DATA':
      case 'INIT_ALL':
        result = initializeSampleData();
        break;

      default:
        result = { status: 'ERROR', message: 'Unknown action: ' + action };
    }
    return respond(result);
  } catch (err) {
    return respond({ status: 'ERROR', message: err.toString() });
  }
}

function doGet(e) {
  try {
    const action = String(e.parameter.action || '').toUpperCase();
    const id = e.parameter.id;

    let result;
    switch (action) {
      case 'STATUS':
        result = { status: 'SUCCESS', message: 'VSTMS Google Apps Script API is running', timestamp: getTimestamp() };
        break;
      case 'SERVICES':
        result = getAllServices();
        break;
      case 'ENQUIRIES':
        result = getAllEnquiries();
        break;
      case 'JOBS':
        result = getAllJobs();
        break;
      case 'TRANSFORMERS':
        result = getAllTransformers();
        break;
      case 'TNOTES':
        result = getAllTNotes();
        break;
      case 'DCS':
        result = getAllDCs();
        break;
      case 'BILLS':
        result = getAllBills();
        break;
      case 'SUMMARY':
        result = getTransformersSummary();
        break;
      case 'INIT':
        result = initializeSampleData();
        break;
      default:
        result = {
          status: 'SUCCESS',
          message: 'VSTMS Google Sheets API Ready',
          availableSheets: Object.values(SHEET_NAMES)
        };
    }
    return respond(result);
  } catch (err) {
    return respond({ status: 'ERROR', message: err.toString() });
  }
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
