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
  TNOTE_TRANSFORMERS: 'TNote Transformers',
  DCS: 'DCs',
  BILLS: 'Bills',
  QUOTATIONS: 'Quotations',
  QUOTATION_FORM: 'Quotation_Form',
  QUOTATION_SETTINGS: 'Quotation Settings',
  QUOTATION_RATES: 'Quotation Rates',
  DROPDOWN_DEFAULTS: 'Dropdown Defaults'
};

const SHEET_HEADERS = {
  Enquiries: ['ID', 'Date', 'CustomerName', 'CustomerPhone', 'CustomerEmail', 'ServicesRequired', 'TransformerLocation', 'LeakageLocation', 'BreakdownTiming', 'SiteLocation', 'Status', 'Notes', 'CreatedAt', 'UpdatedAt', 'ContactPerson', 'TransformerCapacity', 'TransformerMake', 'TransformerStatus', 'ServicePriority', 'ProblemDescription', 'PhotoLinks'],
  Services: ['ServiceID', 'ServiceName', 'Description', 'Icon'],
  Jobs: ['JobID', 'EnquiryID', 'TransformerID', 'Status', 'StartDate', 'EndDate', 'Technician', 'Description', 'Cost', 'CreatedAt', 'UpdatedAt'],
  Transformers: ['ID', 'SpmCenter', 'DtrNo', 'SNo', 'Capacity', 'Type', 'OilCapacity', 'Status', 'TNoteID', 'DcNo', 'SapNo', 'CreatedAt', 'UpdatedAt', 'RequestID'],
  TNotes: ['ID', 'TNoteNo', 'Date', 'NumberOfTransformers', 'CreatedAt', 'UpdatedAt', 'Attachments'],
  'TNote Transformers': ['LinkID', 'TNoteID', 'TransformerID', 'IntakeType', 'VisitStatus', 'Billable', 'CreatedAt', 'UpdatedAt'],
  DCs: ['DcNo', 'Date', 'SpmCenter', 'TotalTransformers', 'CustomerName', 'CustomerAddress', 'CustomerGSTIN', 'CompanyGSTIN', 'TNoteNo', 'EmptyDrumsAvailable', 'EmptyDrumCount', 'SentToTGSPDCL', 'TransformerDetails', 'Delivered', 'DeliveryAttachments', 'DeliveredAt', 'CreatedAt', 'UpdatedAt', 'GeneratedChallanUrl', 'GeneratedChallanFileId'],
  Bills: ['SapNo', 'Date', 'SpmCenter', 'TotalTransformers', 'BillAmount', 'CreatedAt', 'UpdatedAt', 'Attachments', 'AgreementNo', 'GSTAmount', 'Status', 'AmountCredited', 'CreditedDate', 'GSTFilingMonth', 'InvoiceNo'],
  Quotations: ['QuotationNo', 'CustomerName', 'CustomerAddress', 'ContactPerson', 'Mobile', 'Email', 'TransformerMake', 'TransformerCapacity', 'TransformerSerialNo', 'TransformerLocation', 'QuotationDate', 'FinancialYear', 'LineItems', 'Subtotal', 'PdfUrl', 'FileUrl', 'FileId', 'OutputFormat', 'CreatedAt', 'UpdatedAt', 'DocumentType', 'GSTApplicable', 'GSTRate', 'GSTAmount', 'GrandTotal', 'WarrantyMonths', 'Terms', 'DocumentGroupId', 'GroupPosition', 'GroupCount'],
  Quotation_Form: ['QuotationNo', 'CustomerName', 'CustomerAddress', 'ContactPerson', 'Mobile', 'Email', 'TransformerMake', 'TransformerCapacity', 'TransformerSerialNo', 'TransformerLocation', 'QuotationDate', 'FinancialYear', 'LineItems', 'OutputFormat', 'UpdatedAt', 'DocumentType', 'Subtotal', 'GSTApplicable', 'GSTRate', 'GSTAmount', 'GrandTotal', 'WarrantyMonths', 'Terms', 'DocumentGroupId', 'GroupPosition', 'GroupCount'],
  'Quotation Settings': ['Setting', 'Value'],
  'Quotation Rates': ['TransformerCapacity', 'Service', 'Rate'],
  'Dropdown Defaults': ['Category', 'Value', 'Active']
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

const DEFAULT_DROPDOWN_VALUES = {
  Capacity: [
    '25 kVA', '50 kVA', '63 kVA', '100 kVA', '160 kVA', '250 kVA',
    '315 kVA', '500 kVA', '630 kVA', '1000 kVA', '1250 kVA', '1600 kVA',
    'Other', 'Not sure'
  ],
  Make: ['ABB', 'Siemens'],
  'SPM Center': ['Warangal', 'Salem', 'Rajahmundry', 'Mysuru', 'Karimnagar'],
  Service: Array.from(new Set([
    ...QUOTATION_SERVICES,
    ...DEFAULT_SERVICES.map(service => service.ServiceName),
    'Transformer Inspection',
    'Sick Transformer Repair / Restoration',
    'Transformer Coil Rewinding',
    'Preventive Maintenance',
    'Transformer Servicing',
    'Other'
  ]))
};

const QUOTATION_CAPACITIES = DEFAULT_DROPDOWN_VALUES.Capacity;

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

function initializeDropdownDefaults_() {
  const sheet = initializeSheet(SHEET_NAMES.DROPDOWN_DEFAULTS, SHEET_HEADERS['Dropdown Defaults']);
  if (sheet.getLastRow() <= 1) {
    const rows = [];
    Object.keys(DEFAULT_DROPDOWN_VALUES).forEach(category => {
      DEFAULT_DROPDOWN_VALUES[category].forEach(value => rows.push([category, value, true]));
    });
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    }
  }
  const rows = getSheetData(SHEET_NAMES.DROPDOWN_DEFAULTS);
  const gstinRow = rows.find(row => String(row.Category || '').trim() === 'Business GSTIN');
  if (!gstinRow) {
    sheet.appendRow(['Business GSTIN', '36AAUFM2590B1Z4', true]);
  } else if (
    String(gstinRow.Value || '').trim() !== '36AAUFM2590B1Z4' ||
    (gstinRow.Active !== true && String(gstinRow.Active).toLowerCase() !== 'true')
  ) {
    const found = findRowByValue(SHEET_NAMES.DROPDOWN_DEFAULTS, 'Category', 'Business GSTIN');
    if (found) {
      sheet.getRange(found.rowIndex, found.headers.indexOf('Value') + 1).setValue('36AAUFM2590B1Z4');
      sheet.getRange(found.rowIndex, found.headers.indexOf('Active') + 1).setValue(true);
    }
  }
  return sheet;
}

function getDropdownDefaults_() {
  initializeDropdownDefaults_();
  const values = {
    capacities: [],
    makes: [],
    spmCenters: [],
    services: [],
    businessGstin: '36AAUFM2590B1Z4'
  };
  const categoryKeys = {
    Capacity: 'capacities',
    Make: 'makes',
    'SPM Center': 'spmCenters',
    Service: 'services',
    'Business GSTIN': 'businessGstin'
  };

  getSheetData(SHEET_NAMES.DROPDOWN_DEFAULTS).forEach(row => {
    const key = categoryKeys[String(row.Category || '').trim()];
    const value = String(row.Value || '').trim();
    const active = row.Active;
    if (!key || !value || active === false || String(active).toLowerCase() === 'false') return;
    if (key === 'businessGstin') {
      values.businessGstin = value;
      return;
    }
    if (!values[key].some(existing => existing.toLowerCase() === value.toLowerCase())) {
      values[key].push(value);
    }
  });
  return values;
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

function saveRecordAttachments_(attachments, folderName) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  if (attachments.length > 5) throw new Error('Please upload no more than 5 attachments.');

  const folderIterator = DriveApp.getFoldersByName(folderName);
  const folder = folderIterator.hasNext() ? folderIterator.next() : DriveApp.createFolder(folderName);
  const maxFileSize = 2 * 1024 * 1024;
  const allowedImageType = /^image\/(jpeg|png|gif|webp|bmp|heic|heif|avif)$/i;

  return attachments.map(attachment => {
    if (!attachment || typeof attachment.dataUrl !== 'string') {
      throw new Error('An attachment is missing its file data.');
    }
    if (Number(attachment.size) > maxFileSize) {
      throw new Error('Each attachment must be 2 MB or smaller.');
    }

    const match = attachment.dataUrl.match(/^data:([A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || (match[1] !== 'application/pdf' && !allowedImageType.test(match[1])) ||
        (attachment.type && attachment.type !== match[1])) {
      throw new Error('Attachments must be PDF documents or supported image files.');
    }
    if (match[2].length > Math.ceil(maxFileSize * 4 / 3) + 4) {
      throw new Error('Each attachment must be 2 MB or smaller.');
    }

    const safeName = String(attachment.name || 'document-attachment')
      .replace(/[^\w.-]/g, '_')
      .slice(0, 120);
    const filename = `${Utilities.getUuid()}_${safeName}`;
    const bytes = Utilities.base64Decode(match[2]);
    if (bytes.length > maxFileSize) throw new Error('Each attachment must be 2 MB or smaller.');
    const blob = Utilities.newBlob(bytes, match[1], filename);
    return {
      name: String(attachment.name || safeName),
      type: match[1],
      size: bytes.length,
      url: folder.createFile(blob).getUrl()
    };
  });
}

function parseRecordAttachments_(value) {
  if (!value) return [];
  let attachments;
  try {
    attachments = Array.isArray(value) ? value : JSON.parse(String(value));
  } catch (error) {
    throw new Error('A record has invalid saved attachment data.');
  }
  if (!Array.isArray(attachments)) throw new Error('A record has invalid saved attachment data.');
  return attachments
    .filter(attachment => attachment && attachment.url)
    .map(attachment => ({
      name: String(attachment.name || 'Attachment'),
      type: String(attachment.type || ''),
      size: Number(attachment.size || 0),
      url: String(attachment.url)
    }));
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
    sapNo: row.SapNo ? String(row.SapNo) : null,
    createdAt: String(row.CreatedAt || ''),
    intakeType: row.IntakeType ? String(row.IntakeType) : null,
    visitStatus: row.VisitStatus ? String(row.VisitStatus) : null,
    billable: row.Billable === true || String(row.Billable).toLowerCase() === 'true'
  };
}

function ensureTNoteTransformerLinks_() {
  const sheet = initializeSheet(SHEET_NAMES.TNOTE_TRANSFORMERS, SHEET_HEADERS[SHEET_NAMES.TNOTE_TRANSFORMERS]);
  const existing = getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS);
  const linkKeys = new Set(existing.map(link => `${Number(link.TNoteID)}:${Number(link.TransformerID)}`));
  const tnoteIds = new Set(getSheetData(SHEET_NAMES.TNOTES).map(tnote => Number(tnote.ID)));
  const transformers = getSheetData(SHEET_NAMES.TRANSFORMERS);

  transformers.forEach(transformer => {
    const tNoteId = Number(transformer.TNoteID);
    const transformerId = Number(transformer.ID);
    const key = `${tNoteId}:${transformerId}`;
    if (!tNoteId || !transformerId || !tnoteIds.has(tNoteId) || linkKeys.has(key)) return;

    appendTNoteTransformerLink_(sheet, {
      tNoteId,
      transformerId,
      intakeType: 'NEW',
      visitStatus: String(transformer.Status || 'Recieved'),
      billable: true
    });
    linkKeys.add(key);
  });

  return sheet;
}

function appendTNoteTransformerLink_(sheet, link) {
  const now = getTimestamp();
  sheet.appendRow([
    getNextNumericId(SHEET_NAMES.TNOTE_TRANSFORMERS, 'LinkID'),
    Number(link.tNoteId),
    Number(link.transformerId),
    link.intakeType || 'NEW',
    link.visitStatus || 'Recieved',
    link.billable === true,
    now,
    now
  ]);
}

function getTNoteTransformerMap_() {
  ensureTNoteTransformerLinks_();
  const transformerById = new Map(
    getSheetData(SHEET_NAMES.TRANSFORMERS).map(row => [Number(row.ID), transformerRowToObj(row)])
  );

  const byTNote = new Map();
  getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS).forEach(link => {
    const tNoteId = Number(link.TNoteID);
    const transformer = transformerById.get(Number(link.TransformerID));
    if (!transformer) return;
    if (!byTNote.has(tNoteId)) byTNote.set(tNoteId, []);
    const attachedTransformers = byTNote.get(tNoteId);
    if (attachedTransformers.some(attached => attached.id === transformer.id)) return;
    attachedTransformers.push({
      ...transformer,
      intakeType: String(link.IntakeType || 'NEW'),
      visitStatus: String(link.VisitStatus || transformer.status || 'Recieved'),
      billable: link.Billable === true || String(link.Billable).toLowerCase() === 'true'
    });
  });
  return byTNote;
}

function getTNoteTransformers_(tNoteId) {
  return getTNoteTransformerMap_().get(Number(tNoteId)) || [];
}

function normalizeTransformerIdentity_(value) {
  return String(value || '').trim().toUpperCase();
}

function findTransformersByIdentity_(field, value) {
  const normalized = normalizeTransformerIdentity_(value);
  if (!normalized) throw new Error('Enter a DTR number or serial number to search.');
  if (!['DtrNo', 'SNo'].includes(field)) throw new Error('Search by DTR number or serial number.');

  return getSheetData(SHEET_NAMES.TRANSFORMERS)
    .filter(row => normalizeTransformerIdentity_(row[field]) === normalized)
    .map(transformerRowToObj);
}

function linkTNoteTransformer(tNoteId, transformerId, intakeType) {
  const normalizedIntakeType = String(intakeType || '').trim().toUpperCase();
  if (normalizedIntakeType !== 'RGP') throw new Error('Only RGP links to existing transformers are supported.');
  if (!findRowByValue(SHEET_NAMES.TNOTES, 'ID', tNoteId)) return { status: 'NOT_FOUND', message: 'TNote not found.' };
  const transformerResult = getTransformerById(transformerId);
  if (transformerResult.status !== 'SUCCESS') return { status: 'NOT_FOUND', message: 'Transformer not found.' };
  if (String(transformerResult.data.status || '').toLowerCase() === 'scrap') {
    throw new Error('Scrapped transformers cannot be linked to an RGP visit.');
  }

  const sheet = ensureTNoteTransformerLinks_();
  const existing = getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS).some(link =>
    Number(link.TNoteID) === Number(tNoteId) && Number(link.TransformerID) === Number(transformerId)
  );
  if (existing) throw new Error('This transformer is already linked to the selected TNote.');

  appendTNoteTransformerLink_(sheet, {
    tNoteId,
    transformerId,
    intakeType: 'RGP',
    visitStatus: 'Recieved',
    billable: false
  });
  return { status: 'SUCCESS', data: getTNoteTransformers_(tNoteId).find(item => item.id === Number(transformerId)) };
}

function updateTNoteTransformerVisitStatus(tNoteId, transformerId, visitStatus) {
  const allowedStatuses = ['Recieved', 'Assesment', 'Repair In Progress', 'Repaired'];
  const nextStatus = allowedStatuses.find(status => status.toLowerCase() === String(visitStatus || '').trim().toLowerCase());
  if (!nextStatus) throw new Error('Invalid RGP visit status.');

  const linksSheet = ensureTNoteTransformerLinks_();
  const links = getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS);
  const rowIndex = links.findIndex(link =>
    Number(link.TNoteID) === Number(tNoteId) &&
    Number(link.TransformerID) === Number(transformerId) &&
    String(link.IntakeType || '').toUpperCase() === 'RGP'
  );
  if (rowIndex < 0) return { status: 'NOT_FOUND', message: 'RGP visit not found.' };
  const currentStatus = String(links[rowIndex].VisitStatus || 'Recieved');
  const currentIndex = allowedStatuses.findIndex(status => status.toLowerCase() === currentStatus.toLowerCase());
  const nextIndex = allowedStatuses.findIndex(status => status === nextStatus);
  if (currentIndex < 0 || nextIndex !== currentIndex + 1) {
    throw new Error(`Invalid RGP visit stage transition from ${currentStatus} to ${nextStatus}.`);
  }

  const rowNumber = rowIndex + 2;
  const headers = linksSheet.getRange(1, 1, 1, linksSheet.getLastColumn()).getValues()[0].map(String);
  linksSheet.getRange(rowNumber, headers.indexOf('VisitStatus') + 1).setValue(nextStatus);
  linksSheet.getRange(rowNumber, headers.indexOf('UpdatedAt') + 1).setValue(getTimestamp());
  return { status: 'SUCCESS', data: getTNoteTransformers_(tNoteId).find(item => item.id === Number(transformerId)) };
}

function unlinkTNoteTransformer(tNoteId, transformerId) {
  const sheet = ensureTNoteTransformerLinks_();
  const links = getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS);
  const matchingLink = links.find(link =>
    Number(link.TNoteID) === Number(tNoteId) && Number(link.TransformerID) === Number(transformerId)
  );
  if (matchingLink && String(matchingLink.IntakeType || '').toUpperCase() === 'RGP') {
    throw new Error('RGP visit history cannot be removed.');
  }
  const transformer = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', transformerId);
  if (transformer) {
    const status = String(transformer.data[transformer.headers.indexOf('Status')] || '');
    if (status.toLowerCase() === 'delivered' || status.toLowerCase() === 'billed') {
      throw new Error('A delivered transformer cannot be removed from its TNote.');
    }
  }
  const rowsToDelete = [];
  links.forEach((link, index) => {
    if (Number(link.TNoteID) === Number(tNoteId) && Number(link.TransformerID) === Number(transformerId)) {
      rowsToDelete.push(index + 2);
    }
  });
  if (rowsToDelete.length === 0) return { status: 'NOT_FOUND', message: 'TNote transformer link not found.' };
  rowsToDelete.reverse().forEach(rowNumber => sheet.deleteRow(rowNumber));

  if (transformer) {
    const remaining = getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS)
      .find(link => Number(link.TransformerID) === Number(transformerId));
    const transformersSheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
    const tNoteColumn = transformer.headers.indexOf('TNoteID') + 1;
    const updatedColumn = transformer.headers.indexOf('UpdatedAt') + 1;
    if (tNoteColumn > 0) transformersSheet.getRange(transformer.rowIndex, tNoteColumn).setValue(remaining ? remaining.TNoteID : '');
    if (updatedColumn > 0) transformersSheet.getRange(transformer.rowIndex, updatedColumn).setValue(getTimestamp());
  }
  return { status: 'SUCCESS', message: 'Transformer removed from this TNote.' };
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
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return addTransformerLocked_(data);
  } finally {
    lock.releaseLock();
  }
}

function addTransformerLocked_(data) {
  const tNoteId = data.tNoteId || data.tNoteID;
  if (tNoteId && !findRowByValue(SHEET_NAMES.TNOTES, 'ID', tNoteId)) {
    throw new Error('The selected TNote does not exist.');
  }
  const intakeType = String(data.intakeType || 'NEW').toUpperCase();
  const linkSheet = tNoteId ? ensureTNoteTransformerLinks_() : null;
  const sheet = initializeSheet(SHEET_NAMES.TRANSFORMERS, SHEET_HEADERS.Transformers);
  const requestId = String(data.requestId || '').trim();
  if (requestId) {
    const existing = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'RequestID', requestId);
    if (existing) {
      const existingRow = Object.fromEntries(existing.headers.map((header, index) => [header, existing.data[index]]));
      const matchesRequest = String(existingRow.SpmCenter || '') === String(data.spmCenter || '') &&
        String(existingRow.DtrNo || '') === String(data.dtrNo || '') &&
        String(existingRow.SNo || '') === String(data.sNo || '') &&
        Number(existingRow.Capacity || 0) === Number(data.capacity || 0) &&
        String(existingRow.Type || '') === String(data.type || 'Distribution') &&
        Number(existingRow.OilCapacity || 0) === Number(data.oilCapacity || 0) &&
        Number(existingRow.TNoteID || 0) === Number(tNoteId || 0);
      if (!matchesRequest) throw new Error('Request ID was already used for a different transformer.');
      const created = transformerRowToObj(existingRow);
      if (tNoteId) {
        created.intakeType = intakeType;
        created.visitStatus = data.status || 'Recieved';
        created.billable = intakeType !== 'RGP';
      }
      return { status: 'SUCCESS', data: created };
    }
  }
  const normalizedDtrNo = normalizeTransformerIdentity_(data.dtrNo);
  const normalizedSNo = normalizeTransformerIdentity_(data.sNo);
  const existingIdentity = getSheetData(SHEET_NAMES.TRANSFORMERS).find(transformer =>
    Number(transformer.ID) > 0 &&
    ((normalizedDtrNo && normalizeTransformerIdentity_(transformer.DtrNo) === normalizedDtrNo) ||
      (normalizedSNo && normalizeTransformerIdentity_(transformer.SNo) === normalizedSNo))
  );
  if (existingIdentity) {
    if (intakeType === 'RGP') {
      throw new Error('A transformer with this DTR number or serial number already exists. Search and link the existing transformer as RGP.');
    }
    throw new Error('A transformer with this DTR number or serial number is already registered.');
  }
  const id = getNextNumericId(SHEET_NAMES.TRANSFORMERS, 'ID');
  const now = getTimestamp();

  const rowValues = {
    ID: id,
    SpmCenter: data.spmCenter || '',
    DtrNo: data.dtrNo || '',
    SNo: data.sNo || '',
    Capacity: data.capacity || 0,
    Type: data.type || 'Distribution',
    OilCapacity: data.oilCapacity || 0,
    Status: data.status || 'Recieved',
    TNoteID: data.tNoteId || data.tNoteID || '',
    DcNo: data.dcNo || '',
    SapNo: data.sapNo || '',
    CreatedAt: now,
    UpdatedAt: now,
    RequestID: requestId
  };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(header => rowValues[header] === undefined ? '' : rowValues[header]);
  sheet.appendRow(row);
  const persisted = getTransformerById(id);
  if (persisted.status !== 'SUCCESS') throw new Error('Transformer write could not be verified.');
  const created = persisted.data;
  if (tNoteId) {
    appendTNoteTransformerLink_(linkSheet, {
      tNoteId,
      transformerId: id,
      intakeType,
      visitStatus: data.status || 'Recieved',
      billable: intakeType !== 'RGP'
    });
    created.intakeType = intakeType;
    created.visitStatus = data.status || 'Recieved';
    created.billable = intakeType !== 'RGP';
  }
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

function deleteTransformer(id) {
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found && Number(id) === 0) {
    const sheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);
    const column = name => headers.indexOf(name);
    const invalidRows = [];
    for (let index = 1; index < data.length; index++) {
      const value = name => column(name) >= 0 ? data[index][column(name)] : '';
      const dtrNo = String(value('DtrNo') || '');
      if (
        !value('ID') &&
        !value('SpmCenter') &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dtrNo) &&
        String(value('SNo') || '') === dtrNo &&
        !value('Capacity') &&
        !value('Type') &&
        !value('OilCapacity') &&
        String(value('Status') || '') === '1' &&
        !value('TNoteID') &&
        !value('DcNo') &&
        !value('SapNo') &&
        String(value('CreatedAt') || '') === 'Recieved' &&
        !value('UpdatedAt')
      ) {
        invalidRows.push(index + 1);
      }
    }
    if (invalidRows.length > 1) {
      throw new Error('Multiple malformed transformer rows matched cleanup safeguards; no rows were deleted.');
    }
    if (invalidRows.length === 1) {
      sheet.deleteRow(invalidRows[0]);
      return { status: 'SUCCESS', message: 'Malformed legacy transformer row removed.' };
    }
  }
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };

  const transformer = transformerRowToObj(Object.fromEntries(
    found.headers.map((header, index) => [header, found.data[index]])
  ));
  if (['DELIVERED', 'BILLED'].includes(String(transformer.status || '').toUpperCase())) {
    throw new Error('Delivered or billed transformers cannot be deleted.');
  }

  const linksSheet = ensureTNoteTransformerLinks_();
  const links = getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS);
  if (links.some(link => Number(link.TransformerID) === Number(id) && String(link.IntakeType || '').toUpperCase() === 'RGP')) {
    throw new Error('Transformers with RGP visit history cannot be deleted.');
  }
  links.map((link, index) => Number(link.TransformerID) === Number(id) ? index + 2 : -1)
    .filter(rowNumber => rowNumber > 0)
    .reverse()
    .forEach(rowNumber => linksSheet.deleteRow(rowNumber));

  getOrCreateSheet(SHEET_NAMES.TRANSFORMERS).deleteRow(found.rowIndex);
  return { status: 'SUCCESS', message: 'Transformer deleted successfully' };
}

function updateTransformerStatus(id, newStatus) {
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };
  const currentStatus = String(found.data[found.headers.indexOf('Status')] || '');
  const allowedStages = ['Recieved', 'Assesment', 'Repair In Progress', 'Repaired'];
  if (String(newStatus).toLowerCase() === 'scrap') {
    if (!allowedStages.some(status => status.toLowerCase() === currentStatus.toLowerCase())) {
      throw new Error('Only transformers not yet delivered can be marked as Scrap.');
    }
    newStatus = 'Scrap';
  } else {
    const currentIndex = allowedStages.findIndex(status => status.toLowerCase() === currentStatus.toLowerCase());
    const nextIndex = allowedStages.findIndex(status => status.toLowerCase() === String(newStatus).toLowerCase());
    if (currentIndex < 0 || nextIndex !== currentIndex + 1) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}.`);
    }
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
  const statusIdx = found.headers.indexOf('Status') + 1;
  const updatedIdx = found.headers.indexOf('UpdatedAt') + 1;

  sheet.getRange(found.rowIndex, statusIdx).setValue(newStatus);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getTransformerById(id);
}

function deliverTransformer(id, dcNo) {
  if (!dcNo || !findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo)) {
    throw new Error('Select an existing delivery challan before delivering a transformer.');
  }
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };
  const currentStatus = String(found.data[found.headers.indexOf('Status')] || '');
  if (currentStatus.toLowerCase() !== 'repaired') {
    throw new Error('Only repaired, non-scrapped transformers can be delivered.');
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
  const statusIdx = found.headers.indexOf('Status') + 1;
  const dcIdx = found.headers.indexOf('DcNo') + 1;
  const updatedIdx = found.headers.indexOf('UpdatedAt') + 1;

  sheet.getRange(found.rowIndex, statusIdx).setValue('Delivered');
  sheet.getRange(found.rowIndex, dcIdx).setValue(dcNo);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getTransformerById(id);
}

function updateDCTransformerAssignment_(dcNo, transformerId, shouldAssign) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
    const dc = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
    if (!dc) throw new Error('Delivery challan not found.');
    const transformer = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', transformerId);
    if (!transformer) throw new Error('Transformer not found.');

    const transformerHeaders = transformer.headers;
    const statusColumn = transformerHeaders.indexOf('Status');
    const dcColumn = transformerHeaders.indexOf('DcNo');
    const currentStatus = String(transformer.data[statusColumn] || '');
    const currentDcNo = String(transformer.data[dcColumn] || '');
    const dcSheet = getOrCreateSheet(SHEET_NAMES.DCS);
    const dcHeaders = dc.headers;
    const dcValues = {};
    dcHeaders.forEach((header, index) => { dcValues[header] = dc.data[index]; });
    if (String(dcValues.Delivered).toLowerCase() === 'true') {
      throw new Error('A delivered challan cannot be edited.');
    }

    if (shouldAssign) {
      if (currentStatus.toLowerCase() !== 'repaired' || currentDcNo) {
        throw new Error('Only an unassigned repaired transformer can be added to a challan.');
      }
      const tNote = getAllTNotes().data
        .find(note => (note.transformers || []).some(link => Number(link.id) === Number(transformerId)));
      if (!tNote || !tNote.tNoteNo || !tNote.date) {
        throw new Error('The transformer must have a linked TNote number and date before delivery.');
      }
      if (String(dcValues.SentToTGSPDCL).toLowerCase() === 'true'
          && String(dcValues.SpmCenter || '').trim() !== String(transformer.data[transformerHeaders.indexOf('SpmCenter')] || '').trim()) {
        throw new Error('A TGSPDCL challan can only include transformers from its SPM Center.');
      }
      const transformerSheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
      transformerSheet.getRange(transformer.rowIndex, statusColumn + 1).setValue('Delivered');
      transformerSheet.getRange(transformer.rowIndex, dcColumn + 1).setValue(dcNo);
      const updatedColumn = transformerHeaders.indexOf('UpdatedAt');
      if (updatedColumn >= 0) transformerSheet.getRange(transformer.rowIndex, updatedColumn + 1).setValue(getTimestamp());
    } else {
      if (currentStatus.toLowerCase() !== 'delivered' || currentDcNo.toLowerCase() !== String(dcNo).toLowerCase()) {
        throw new Error('Only a transformer assigned to this challan can be removed.');
      }
      const transformerSheet = getOrCreateSheet(SHEET_NAMES.TRANSFORMERS);
      transformerSheet.getRange(transformer.rowIndex, statusColumn + 1).setValue('Repaired');
      transformerSheet.getRange(transformer.rowIndex, dcColumn + 1).clearContent();
      const updatedColumn = transformerHeaders.indexOf('UpdatedAt');
      if (updatedColumn >= 0) transformerSheet.getRange(transformer.rowIndex, updatedColumn + 1).setValue(getTimestamp());
    }

    const assignedTransformers = getSheetData(SHEET_NAMES.TRANSFORMERS)
      .filter(row => String(row.DcNo || '').toLowerCase() === String(dcNo).toLowerCase())
      .map(transformerRowToObj);
    const tnotes = getAllTNotes().data;
    const transformerDetails = assignedTransformers.map(item => {
      const tNotes = tnotes.flatMap(note =>
        (note.transformers || [])
          .filter(link => Number(link.id) === Number(item.id))
          .map(link => ({
            tNoteNo: note.tNoteNo || String(note.id),
            date: note.date || '',
            intakeType: String(link.intakeType || 'NEW').toUpperCase()
          }))
      );
      const isRgp = tNotes.some(note => note.intakeType === 'RGP');
      const name = [
        item.dtrNo && `DTR ${item.dtrNo}`,
        item.sNo && `SNo ${item.sNo}`,
        item.capacity && `${item.capacity} kVA`,
        item.type
      ].filter(Boolean).join(' · ');
      return {
        transformerId: item.id,
        transformerName: `${name || `Transformer ${item.id}`}${isRgp ? ' (RGP)' : ''}`,
        spmCenter: item.spmCenter || '',
        dtrNo: item.dtrNo || '',
        sNo: item.sNo || '',
        capacity: item.capacity || '',
        type: item.type || '',
        intakeType: isRgp ? 'RGP' : 'NEW',
        tNotes
      };
    });
    const tNoteNumbers = [...new Set(transformerDetails.flatMap(detail => detail.tNotes.map(note => note.tNoteNo)))];
    const dcSheetRow = getOrCreateSheet(SHEET_NAMES.DCS);
    const setValue = (header, value) => {
      const column = dcHeaders.indexOf(header);
      if (column >= 0) dcSheetRow.getRange(dc.rowIndex, column + 1).setValue(value);
    };
    setValue('TotalTransformers', assignedTransformers.length);
    setValue('TNoteNo', tNoteNumbers.join(', '));
    setValue('TransformerDetails', JSON.stringify(transformerDetails));
    setValue('GeneratedChallanUrl', '');
    setValue('GeneratedChallanFileId', '');
    setValue('UpdatedAt', getTimestamp());
    return getDCByNo(dcNo);
  } finally {
    lock.releaseLock();
  }
}

function billTransformer(id, sapNo) {
  const found = findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'Transformer not found' };
  ensureTNoteTransformerLinks_();
  const linkedRgpVisit = getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS).some(link =>
    Number(link.TransformerID) === Number(id) && String(link.IntakeType || '').toUpperCase() === 'RGP'
  );
  if (linkedRgpVisit) throw new Error('Transformers linked to an RGP visit cannot be billed through normal SAP billing.');
  const currentStatus = String(found.data[found.headers.indexOf('Status')] || '');
  if (currentStatus.toLowerCase() === 'scrap') {
    throw new Error('Scrapped transformers cannot be billed.');
  }
  if (currentStatus.toLowerCase() !== 'delivered') {
    throw new Error('Only delivered transformers can be billed.');
  }

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
    billed: 0,
    scrap: 0
  };

  data.forEach(t => {
    const s = String(t.Status || '').trim().toLowerCase();
    if (s === 'recieved' || s === 'receive') counts.recieve++;
    else if (s === 'assesment' || s === 'assessment') counts.assesment++;
    else if (s === 'repair in progress' || s === 'repair_in_progress') counts.repairInProgress++;
    else if (s === 'repaired') counts.repaired++;
    else if (s === 'delivered') counts.delivered++;
    else if (s === 'billed') counts.billed++;
    else if (s === 'scrap') counts.scrap++;
  });

  return { status: 'SUCCESS', data: counts };
}

// ============ TNOTE FUNCTIONS ============

function getAllTNotes() {
  const tnotes = getSheetData(SHEET_NAMES.TNOTES);
  const transformersByTNote = getTNoteTransformerMap_();

  const result = tnotes.map(tnote => {
    const id = Number(tnote.ID);
    const attachedTransformers = transformersByTNote.get(id) || [];
    return {
      id: id,
      tNoteNo: String(tnote.TNoteNo || id),
      date: dateOnly_(tnote.Date),
      numberOfTransformers: attachedTransformers.length,
      attachments: parseRecordAttachments_(tnote.Attachments),
      transformers: attachedTransformers
    };
  });

  return { status: 'SUCCESS', data: result };
}

function getTNoteById(id) {
  const found = findRowByValue(SHEET_NAMES.TNOTES, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'TNote not found' };

  const transformers = getTNoteTransformers_(id);

  const obj = {};
  found.headers.forEach((h, idx) => { obj[h] = found.data[idx]; });

  return {
    status: 'SUCCESS',
    data: {
      id: Number(obj.ID),
      tNoteNo: String(obj.TNoteNo || obj.ID),
      date: dateOnly_(obj.Date),
      numberOfTransformers: transformers.length,
      attachments: parseRecordAttachments_(obj.Attachments),
      transformers: transformers
    }
  };
}

function addTNote(data) {
  const sheet = initializeSheet(SHEET_NAMES.TNOTES, SHEET_HEADERS.TNotes);
  const tNoteNo = String(data.tNoteNo || '').trim();
  if (!tNoteNo) throw new Error('TNote number is required.');
  const duplicate = getSheetData(SHEET_NAMES.TNOTES).some(row =>
    String(row.TNoteNo || row.ID || '').trim().toLowerCase() === tNoteNo.toLowerCase()
  );
  if (duplicate) throw new Error(`TNote number "${tNoteNo}" already exists.`);
  const id = getNextNumericId(SHEET_NAMES.TNOTES, 'ID');
  const now = getTimestamp();
  const attachments = saveRecordAttachments_(data.attachments, 'D.S. Transformer TNote Attachments');

  const rowValues = {
    ID: id,
    TNoteNo: tNoteNo,
    Date: data.date || new Date().toISOString().split('T')[0],
    NumberOfTransformers: data.numberOfTransformers || 0,
    CreatedAt: now,
    UpdatedAt: now,
    Attachments: JSON.stringify(attachments)
  };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(header => rowValues[header] === undefined ? '' : rowValues[header]);
  sheet.appendRow(row);
  const persisted = getTNoteById(id);
  if (persisted.status !== 'SUCCESS') throw new Error('TNote write could not be verified.');
  return persisted;
}

function updateTNote(id, data) {
  const found = findRowByValue(SHEET_NAMES.TNOTES, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'TNote not found' };

  const sheet = getOrCreateSheet(SHEET_NAMES.TNOTES);
  const headers = found.headers;

  const dateIdx = headers.indexOf('Date') + 1;
  const tNoteNoIdx = headers.indexOf('TNoteNo') + 1;
  const countIdx = headers.indexOf('NumberOfTransformers') + 1;
  const updatedIdx = headers.indexOf('UpdatedAt') + 1;

  if (data.tNoteNo !== undefined) {
    const tNoteNo = String(data.tNoteNo || '').trim();
    if (!tNoteNo) throw new Error('TNote number is required.');
    const duplicate = getSheetData(SHEET_NAMES.TNOTES).some(row =>
      Number(row.ID) !== Number(id) &&
      String(row.TNoteNo || row.ID || '').trim().toLowerCase() === tNoteNo.toLowerCase()
    );
    if (duplicate) throw new Error(`TNote number "${tNoteNo}" already exists.`);
    if (tNoteNoIdx > 0) sheet.getRange(found.rowIndex, tNoteNoIdx).setValue(tNoteNo);
  }
  if (dateIdx > 0 && data.date) sheet.getRange(found.rowIndex, dateIdx).setValue(data.date);
  if (countIdx > 0 && data.numberOfTransformers !== undefined) sheet.getRange(found.rowIndex, countIdx).setValue(data.numberOfTransformers);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getTNoteById(id);
}

function deleteTNote(id) {
  const found = findRowByValue(SHEET_NAMES.TNOTES, 'ID', id);
  if (!found) return { status: 'NOT_FOUND', message: 'TNote not found' };

  const linksSheet = ensureTNoteTransformerLinks_();
  const links = getSheetData(SHEET_NAMES.TNOTE_TRANSFORMERS);
  if (links.some(link => Number(link.TNoteID) === Number(id) && String(link.IntakeType || '').toUpperCase() === 'RGP')) {
    throw new Error('A TNote containing an RGP visit cannot be deleted because it is service history.');
  }
  const deliveredTransformers = links
    .filter(link => Number(link.TNoteID) === Number(id))
    .map(link => findRowByValue(SHEET_NAMES.TRANSFORMERS, 'ID', link.TransformerID))
    .filter(transformer => transformer)
    .filter(transformer => {
      const status = String(transformer.data[transformer.headers.indexOf('Status')] || '').toLowerCase();
      return status === 'delivered' || status === 'billed';
    });
  if (deliveredTransformers.length > 0) {
    throw new Error('A TNote linked to a delivered transformer cannot be deleted.');
  }
  links.map((link, index) => Number(link.TNoteID) === Number(id) ? index + 2 : -1)
    .filter(rowNumber => rowNumber > 0)
    .reverse()
    .forEach(rowNumber => linksSheet.deleteRow(rowNumber));

  const sheet = getOrCreateSheet(SHEET_NAMES.TNOTES);
  sheet.deleteRow(found.rowIndex);
  return { status: 'SUCCESS', message: 'TNote deleted successfully' };
}

// ============ DC FUNCTIONS ============

function getAllDCs() {
  initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
  const data = getSheetData(SHEET_NAMES.DCS);
  const dcs = data.map(row => ({
    dcNo: String(row.DcNo || ''),
    date: dateOnly_(row.Date),
    spmCenter: String(row.SpmCenter || ''),
    totalTransformers: Number(row.TotalTransformers || 0),
    customerName: String(row.CustomerName || ''),
    customerAddress: String(row.CustomerAddress || ''),
    customerGstin: String(row.CustomerGSTIN || ''),
    companyGstin: String(row.CompanyGSTIN || ''),
    tNoteNo: String(row.TNoteNo || ''),
    emptyDrumsAvailable: row.EmptyDrumsAvailable === '' || row.EmptyDrumsAvailable === null || row.EmptyDrumsAvailable === undefined
      ? null
      : row.EmptyDrumsAvailable === true || String(row.EmptyDrumsAvailable).toLowerCase() === 'true',
    emptyDrumCount: Number(row.EmptyDrumCount || 0),
    sentToTgspdcl: row.SentToTGSPDCL === '' || row.SentToTGSPDCL === null || row.SentToTGSPDCL === undefined
      ? null
      : row.SentToTGSPDCL === true || String(row.SentToTGSPDCL).toLowerCase() === 'true',
    transformerDetails: parseDCTransformerDetails_(row.TransformerDetails),
    delivered: row.Delivered === true || String(row.Delivered).toLowerCase() === 'true',
    attachments: parseRecordAttachments_(row.DeliveryAttachments),
    deliveredAt: String(row.DeliveredAt || ''),
    generatedChallanUrl: String(row.GeneratedChallanUrl || ''),
    generatedChallanFileId: String(row.GeneratedChallanFileId || '')
  }));
  return { status: 'SUCCESS', data: dcs };
}

function getDCByNo(dcNo) {
  initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
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
      totalTransformers: Number(obj.TotalTransformers || 0),
      customerName: String(obj.CustomerName || ''),
      customerAddress: String(obj.CustomerAddress || ''),
      customerGstin: String(obj.CustomerGSTIN || ''),
      companyGstin: String(obj.CompanyGSTIN || ''),
      tNoteNo: String(obj.TNoteNo || ''),
      emptyDrumsAvailable: obj.EmptyDrumsAvailable === '' || obj.EmptyDrumsAvailable === null || obj.EmptyDrumsAvailable === undefined
        ? null
        : obj.EmptyDrumsAvailable === true || String(obj.EmptyDrumsAvailable).toLowerCase() === 'true',
      emptyDrumCount: Number(obj.EmptyDrumCount || 0),
      sentToTgspdcl: obj.SentToTGSPDCL === '' || obj.SentToTGSPDCL === null || obj.SentToTGSPDCL === undefined
        ? null
        : obj.SentToTGSPDCL === true || String(obj.SentToTGSPDCL).toLowerCase() === 'true',
      transformerDetails: parseDCTransformerDetails_(obj.TransformerDetails),
      delivered: obj.Delivered === true || String(obj.Delivered).toLowerCase() === 'true',
      attachments: parseRecordAttachments_(obj.DeliveryAttachments),
      deliveredAt: String(obj.DeliveredAt || ''),
      generatedChallanUrl: String(obj.GeneratedChallanUrl || ''),
      generatedChallanFileId: String(obj.GeneratedChallanFileId || '')
    }
  };
}

function addDC(data) {
  const sheet = initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
  const now = getTimestamp();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let dcNo;
  try {
    dcNo = nextDeliveryChallanNumber_(sheet);
    if (getSheetData(SHEET_NAMES.DCS).some(row => String(row.DcNo || '').trim().toLowerCase() === dcNo.toLowerCase())) {
      throw new Error(`Delivery challan number "${dcNo}" already exists.`);
    }

    const values = {
      DcNo: dcNo,
      Date: data.date || new Date().toISOString().split('T')[0],
      SpmCenter: data.spmCenter || '',
      TotalTransformers: data.totalTransformers || 0,
      CustomerName: data.customerName || '',
      CustomerAddress: data.customerAddress || '',
      CustomerGSTIN: data.customerGstin || '',
      CompanyGSTIN: data.companyGstin || '',
      TNoteNo: data.tNoteNo || '',
      EmptyDrumsAvailable: data.emptyDrumsAvailable === undefined || data.emptyDrumsAvailable === null
        ? ''
        : data.emptyDrumsAvailable === true || String(data.emptyDrumsAvailable).toLowerCase() === 'true',
      EmptyDrumCount: Number(data.emptyDrumCount || 0),
      SentToTGSPDCL: data.sentToTgspdcl === true || String(data.sentToTgspdcl).toLowerCase() === 'true',
      TransformerDetails: JSON.stringify(Array.isArray(data.transformerDetails) ? data.transformerDetails : []),
      Delivered: false,
      DeliveryAttachments: '[]',
      DeliveredAt: '',
      CreatedAt: now,
      UpdatedAt: now
    };
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    sheet.appendRow(headers.map(header => values[header] === undefined ? '' : values[header]));
    return { status: 'SUCCESS', data: {
      dcNo, date: values.Date, spmCenter: values.SpmCenter, totalTransformers: values.TotalTransformers,
      customerName: values.CustomerName, customerAddress: values.CustomerAddress,
      customerGstin: values.CustomerGSTIN, companyGstin: values.CompanyGSTIN, tNoteNo: values.TNoteNo,
      emptyDrumsAvailable: values.EmptyDrumsAvailable, emptyDrumCount: values.EmptyDrumCount,
      sentToTgspdcl: values.SentToTGSPDCL, transformerDetails: JSON.parse(values.TransformerDetails),
      delivered: false, attachments: []
    } };
  } finally {
    lock.releaseLock();
  }
}

function parseDCTransformerDetails_(value) {
  if (!value) return [];
  const details = JSON.parse(String(value));
  if (!Array.isArray(details)) throw new Error('Saved delivery challan transformer details are invalid.');
  return details;
}

function markDCDelivered_(dcNo, attachments) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
    const found = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
    if (!found) throw new Error('Delivery challan not found.');
    const headers = found.headers;
    const deliveredIndex = headers.indexOf('Delivered');
    if (deliveredIndex >= 0 && (found.data[deliveredIndex] === true ||
        String(found.data[deliveredIndex]).toLowerCase() === 'true')) {
      throw new Error('This delivery challan has already been marked delivered.');
    }
    if (!Array.isArray(attachments) || attachments.length === 0) {
      throw new Error('Upload the signed delivery challan before marking it delivered.');
    }
    const savedAttachments = saveRecordAttachments_(attachments, 'D.S. Transformer Delivered Challans');
    const sheet = getOrCreateSheet(SHEET_NAMES.DCS);
    const setValue = (header, value) => {
      const index = headers.indexOf(header);
      if (index >= 0) sheet.getRange(found.rowIndex, index + 1).setValue(value);
    };
    const deliveredAt = getTimestamp();
    setValue('Delivered', true);
    setValue('DeliveryAttachments', JSON.stringify(savedAttachments));
    setValue('DeliveredAt', deliveredAt);
    setValue('UpdatedAt', deliveredAt);
    return getDCByNo(dcNo);
  } finally {
    lock.releaseLock();
  }
}

function nextDeliveryChallanNumber_(sheet) {
  initializeQuotationSheets();
  const settings = {};
  getSheetData(SHEET_NAMES.QUOTATION_SETTINGS).forEach(row => {
    if (row.Setting) settings[String(row.Setting)] = String(row.Value || '');
  });

  let financialYear = String(settings['Financial Year'] || '').trim();
  if (!/^\d{2}-\d{2}$/.test(financialYear)) {
    const today = new Date();
    const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    financialYear = `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
  }

  const prefix = `DC/${financialYear}/`;
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const dcNoIndex = header.indexOf('DcNo');
  const currentNumbers = sheet.getLastRow() > 1
    ? sheet.getRange(2, dcNoIndex + 1, sheet.getLastRow() - 1, 1).getValues().flat()
    : [];
  const nextNumber = currentNumbers.reduce((maximum, value) => {
    const match = String(value || '').trim().match(new RegExp(`^DC/${financialYear.replace('-', '\\-')}/(\\d+)$`, 'i'));
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 499) + 1;
  return `${prefix}${nextNumber}`;
}

function saveGeneratedDCChallanPdf_(dcNo, fileName, dataUrl) {
  initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
  const found = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
  if (!found) throw new Error('Delivery challan not found.');
  if (typeof dataUrl !== 'string' || dataUrl.length > 12 * 1024 * 1024) {
    throw new Error('The generated delivery challan PDF is missing or exceeds the upload limit.');
  }
  const match = dataUrl.match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('The generated delivery challan must be a valid PDF.');

  const bytes = Utilities.base64Decode(match[1]);
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) {
    throw new Error('The generated delivery challan PDF must be smaller than 8 MB.');
  }
  const signature = Utilities.newBlob(bytes).getDataAsString().slice(0, 5);
  if (signature !== '%PDF-') throw new Error('The generated delivery challan PDF is invalid.');

  const safeName = String(fileName || `${dcNo}.pdf`)
    .replace(/[^\w.-]/g, '_')
    .slice(0, 120);
  const rootName = 'DS Transformers';
  const rootFolders = DriveApp.getRootFolder().getFoldersByName(rootName);
  const rootFolder = rootFolders.hasNext()
    ? rootFolders.next()
    : DriveApp.getRootFolder().createFolder(rootName);
  const challanFolders = rootFolder.getFoldersByName('Delivery Challans');
  const challanFolder = challanFolders.hasNext()
    ? challanFolders.next()
    : rootFolder.createFolder('Delivery Challans');
  const file = challanFolder.createFile(Utilities.newBlob(bytes, 'application/pdf', safeName));
  const headers = found.headers;
  const sheet = getOrCreateSheet(SHEET_NAMES.DCS);
  const urlColumn = headers.indexOf('GeneratedChallanUrl') + 1;
  const fileIdColumn = headers.indexOf('GeneratedChallanFileId') + 1;
  const updatedColumn = headers.indexOf('UpdatedAt') + 1;
  if (urlColumn <= 0 || fileIdColumn <= 0) throw new Error('Generated challan columns are not initialized.');
  sheet.getRange(found.rowIndex, urlColumn).setValue(file.getUrl());
  sheet.getRange(found.rowIndex, fileIdColumn).setValue(file.getId());
  if (updatedColumn > 0) sheet.getRange(found.rowIndex, updatedColumn).setValue(getTimestamp());
  return getDCByNo(dcNo);
}

function updateDC(dcNo, data) {
  initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
  const found = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
  if (!found) return { status: 'NOT_FOUND', message: 'DC not found' };
  if (String(found.data[found.headers.indexOf('Delivered')]).toLowerCase() === 'true') {
    throw new Error('A delivered challan cannot be edited.');
  }

  const sheet = getOrCreateSheet(SHEET_NAMES.DCS);
  const headers = found.headers;

  const dateIdx = headers.indexOf('Date') + 1;
  const spmIdx = headers.indexOf('SpmCenter') + 1;
  const countIdx = headers.indexOf('TotalTransformers') + 1;
  const customerNameIdx = headers.indexOf('CustomerName') + 1;
  const customerAddressIdx = headers.indexOf('CustomerAddress') + 1;
  const customerGstinIdx = headers.indexOf('CustomerGSTIN') + 1;
  const companyGstinIdx = headers.indexOf('CompanyGSTIN') + 1;
  const tNoteNoIdx = headers.indexOf('TNoteNo') + 1;
  const emptyDrumsAvailableIdx = headers.indexOf('EmptyDrumsAvailable') + 1;
  const emptyDrumCountIdx = headers.indexOf('EmptyDrumCount') + 1;
  const sentToTgspdclIdx = headers.indexOf('SentToTGSPDCL') + 1;
  const transformerDetailsIdx = headers.indexOf('TransformerDetails') + 1;
  const generatedChallanUrlIdx = headers.indexOf('GeneratedChallanUrl') + 1;
  const generatedChallanFileIdIdx = headers.indexOf('GeneratedChallanFileId') + 1;
  const updatedIdx = headers.indexOf('UpdatedAt') + 1;

  if (dateIdx > 0 && data.date) sheet.getRange(found.rowIndex, dateIdx).setValue(data.date);
  if (spmIdx > 0 && data.spmCenter !== undefined) sheet.getRange(found.rowIndex, spmIdx).setValue(data.spmCenter);
  if (countIdx > 0 && data.totalTransformers !== undefined) sheet.getRange(found.rowIndex, countIdx).setValue(data.totalTransformers);
  if (customerNameIdx > 0 && data.customerName !== undefined) sheet.getRange(found.rowIndex, customerNameIdx).setValue(data.customerName);
  if (customerAddressIdx > 0 && data.customerAddress !== undefined) sheet.getRange(found.rowIndex, customerAddressIdx).setValue(data.customerAddress);
  if (customerGstinIdx > 0 && data.customerGstin !== undefined) sheet.getRange(found.rowIndex, customerGstinIdx).setValue(data.customerGstin);
  if (companyGstinIdx > 0 && data.companyGstin !== undefined) sheet.getRange(found.rowIndex, companyGstinIdx).setValue(data.companyGstin);
  if (tNoteNoIdx > 0 && data.tNoteNo !== undefined) sheet.getRange(found.rowIndex, tNoteNoIdx).setValue(data.tNoteNo);
  if (emptyDrumsAvailableIdx > 0 && data.emptyDrumsAvailable !== undefined && data.emptyDrumsAvailable !== null) {
    sheet.getRange(found.rowIndex, emptyDrumsAvailableIdx).setValue(data.emptyDrumsAvailable === true || String(data.emptyDrumsAvailable).toLowerCase() === 'true');
  }
  if (emptyDrumCountIdx > 0 && data.emptyDrumCount !== undefined && data.emptyDrumCount !== null) {
    sheet.getRange(found.rowIndex, emptyDrumCountIdx).setValue(Number(data.emptyDrumCount) || 0);
  }
  if (sentToTgspdclIdx > 0 && data.sentToTgspdcl !== undefined && data.sentToTgspdcl !== null) {
    sheet.getRange(found.rowIndex, sentToTgspdclIdx).setValue(data.sentToTgspdcl === true || String(data.sentToTgspdcl).toLowerCase() === 'true');
  }
  if (transformerDetailsIdx > 0 && data.transformerDetails !== undefined && data.transformerDetails !== null) {
    sheet.getRange(found.rowIndex, transformerDetailsIdx).setValue(JSON.stringify(data.transformerDetails));
  }
  if (generatedChallanUrlIdx > 0) sheet.getRange(found.rowIndex, generatedChallanUrlIdx).clearContent();
  if (generatedChallanFileIdIdx > 0) sheet.getRange(found.rowIndex, generatedChallanFileIdIdx).clearContent();
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());

  return getDCByNo(dcNo);
}

function deleteDC(dcNo) {
  initializeSheet(SHEET_NAMES.DCS, SHEET_HEADERS.DCs);
  const found = findRowByValue(SHEET_NAMES.DCS, 'DcNo', dcNo);
  if (!found) return { status: 'NOT_FOUND', message: 'DC not found' };
  if (String(found.data[found.headers.indexOf('Delivered')]).toLowerCase() === 'true') {
    throw new Error('A delivered challan cannot be deleted.');
  }

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
    billAmount: Number(row.BillAmount || 0),
    attachments: parseRecordAttachments_(row.Attachments),
    agreementNo: String(row.AgreementNo || ''),
    gstAmount: Number(row.GSTAmount || 0),
    status: String(row.Status || 'PENDING'),
    amountCredited: row.AmountCredited === '' || row.AmountCredited == null ? null : Number(row.AmountCredited),
    creditedDate: dateOnly_(row.CreditedDate),
    gstFilingMonth: String(row.GSTFilingMonth || ''),
    invoiceNo: String(row.InvoiceNo || '')
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
      billAmount: Number(obj.BillAmount || 0),
      attachments: parseRecordAttachments_(obj.Attachments),
      agreementNo: String(obj.AgreementNo || ''),
      gstAmount: Number(obj.GSTAmount || 0),
      status: String(obj.Status || 'PENDING'),
      amountCredited: obj.AmountCredited === '' || obj.AmountCredited == null ? null : Number(obj.AmountCredited),
      creditedDate: dateOnly_(obj.CreditedDate),
      gstFilingMonth: String(obj.GSTFilingMonth || ''),
      invoiceNo: String(obj.InvoiceNo || '')
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

  const attachments = saveRecordAttachments_(data.attachments, 'D.S. Transformer Bill Attachments');
  const row = [
    sapNo,
    data.date || new Date().toISOString().split('T')[0],
    data.spmCenter || '',
    data.totalTransformers || 0,
    data.billAmount || 0,
    now,
    now,
    JSON.stringify(attachments),
    data.agreementNo || '',
    data.gstAmount || 0,
    data.status || 'PENDING',
    data.amountCredited || '',
    data.creditedDate || '',
    data.gstFilingMonth || '',
    data.invoiceNo || ''
  ];
  sheet.appendRow(row);
  return { status: 'SUCCESS', data: { sapNo: sapNo, agreementNo: data.agreementNo || '', date: data.date, spmCenter: data.spmCenter, totalTransformers: data.totalTransformers, billAmount: data.billAmount, gstAmount: data.gstAmount || 0, status: data.status || 'PENDING', amountCredited: data.amountCredited || null, creditedDate: data.creditedDate || null, gstFilingMonth: data.gstFilingMonth || '', invoiceNo: data.invoiceNo || '', attachments: attachments } };
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
  const agreementIdx = headers.indexOf('AgreementNo') + 1;
  const gstIdx = headers.indexOf('GSTAmount') + 1;
  const statusIdx = headers.indexOf('Status') + 1;
  const creditedAmountIdx = headers.indexOf('AmountCredited') + 1;
  const creditedDateIdx = headers.indexOf('CreditedDate') + 1;
  const gstMonthIdx = headers.indexOf('GSTFilingMonth') + 1;
  const invoiceIdx = headers.indexOf('InvoiceNo') + 1;
  const updatedIdx = headers.indexOf('UpdatedAt') + 1;
  const attachmentsIdx = headers.indexOf('Attachments') + 1;

  if (dateIdx > 0 && data.date) sheet.getRange(found.rowIndex, dateIdx).setValue(data.date);
  if (spmIdx > 0 && data.spmCenter !== undefined) sheet.getRange(found.rowIndex, spmIdx).setValue(data.spmCenter);
  if (countIdx > 0 && data.totalTransformers !== undefined) sheet.getRange(found.rowIndex, countIdx).setValue(data.totalTransformers);
  if (amtIdx > 0 && data.billAmount !== undefined) sheet.getRange(found.rowIndex, amtIdx).setValue(data.billAmount);
  if (agreementIdx > 0 && data.agreementNo !== undefined) sheet.getRange(found.rowIndex, agreementIdx).setValue(data.agreementNo);
  if (gstIdx > 0 && data.gstAmount !== undefined) sheet.getRange(found.rowIndex, gstIdx).setValue(data.gstAmount);
  if (statusIdx > 0 && data.status !== undefined) sheet.getRange(found.rowIndex, statusIdx).setValue(data.status);
  if (creditedAmountIdx > 0 && data.amountCredited !== undefined) sheet.getRange(found.rowIndex, creditedAmountIdx).setValue(data.amountCredited);
  if (creditedDateIdx > 0 && data.creditedDate !== undefined) sheet.getRange(found.rowIndex, creditedDateIdx).setValue(data.creditedDate);
  if (gstMonthIdx > 0 && data.gstFilingMonth !== undefined) sheet.getRange(found.rowIndex, gstMonthIdx).setValue(data.gstFilingMonth);
  if (invoiceIdx > 0 && data.invoiceNo !== undefined) sheet.getRange(found.rowIndex, invoiceIdx).setValue(data.invoiceNo);
  if (updatedIdx > 0) sheet.getRange(found.rowIndex, updatedIdx).setValue(getTimestamp());
  if (attachmentsIdx > 0 && Array.isArray(data.attachments) && data.attachments.some(attachment => attachment && attachment.dataUrl)) {
    const attachments = saveRecordAttachments_(data.attachments, 'D.S. Transformer Bill Attachments');
    sheet.getRange(found.rowIndex, attachmentsIdx).setValue(JSON.stringify(attachments));
  }

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
  initializeDropdownDefaults_();
  const dropdownDefaults = getDropdownDefaults_();
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
    dropdownDefaults.capacities.forEach(capacity => {
      dropdownDefaults.services.forEach(service => {
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
  const dropdownDefaults = getDropdownDefaults_();
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
      capacities: dropdownDefaults.capacities,
      makes: dropdownDefaults.makes,
      spmCenters: dropdownDefaults.spmCenters,
      services: dropdownDefaults.services,
      rates
    }
  };
}

function getDropdownDefaults() {
  return { status: 'SUCCESS', data: getDropdownDefaults_() };
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
      documentGroupId: String(row.DocumentGroupId || ''),
      groupPosition: Number(row.GroupPosition || 1),
      groupCount: Number(row.GroupCount || 1),
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
    const groupIdIndex = found.headers.indexOf('DocumentGroupId');
    const storedFileId = fileIdIndex >= 0 ? String(found.data[fileIdIndex] || '') : '';
    const fileUrl = fileUrlIndex >= 0 ? found.data[fileUrlIndex] : '';
    const pdfUrl = pdfUrlIndex >= 0 ? found.data[pdfUrlIndex] : '';
    const fileId = storedFileId || quotationDriveFileId_(fileUrl || pdfUrl);
    const groupId = groupIdIndex >= 0 ? String(found.data[groupIdIndex] || '') : '';
    const rows = groupId
      ? getSheetData(SHEET_NAMES.QUOTATIONS)
        .map((row, index) => ({ row, rowIndex: index + 2 }))
        .filter(item => String(item.row.DocumentGroupId || '') === groupId)
      : [{ row: null, rowIndex: found.rowIndex }];
    const sheet = getOrCreateSheet(SHEET_NAMES.QUOTATIONS);
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const previousValues = lastRow > 0 && lastColumn > 0
      ? sheet.getRange(1, 1, lastRow, lastColumn).getValues()
      : [];
    try {
      rows.map(item => item.rowIndex).sort((left, right) => right - left).forEach(rowIndex => sheet.deleteRow(rowIndex));
    } catch (error) {
      if (previousValues.length > 0) {
        sheet.clearContents();
        sheet.getRange(1, 1, previousValues.length, previousValues[0].length).setValues(previousValues);
      }
      throw error;
    }
    let fileCleanupWarning = '';
    if (fileId) {
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (error) {
        fileCleanupWarning = ' The document was removed, but its old Drive file could not be moved to trash.';
        console.warn(`Quotation file cleanup failed for ${fileId}: ${error.message}`);
      }
    }
    return {
      status: 'SUCCESS',
      message: rows.length > 1
        ? `Deleted the linked ${rows.length}-document group.${fileCleanupWarning}`
        : `Quotation deleted successfully.${fileCleanupWarning}`
    };
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

function addQuotationSignatory_(slide, left, top, width, height, fontSize) {
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
    .setFontSize(fontSize || 8)
    .setForegroundColor('#172033')
    .setBold(true);
  text.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
  return signatory;
}

function addQuotationInfoBox_(slide, heading, details, left, top, width, height, isBill) {
  const box = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, left, top, width, height);
  box.getFill().setSolidFill('#F8FAFC');
  box.getBorder().getLineFill().setSolidFill('#CBD5E1');
  box.getBorder().setWeight(1);

  setQuotationText_(slide, heading, left + 7, top + 5, width - 14, 13, 8, true);
  setQuotationText_(slide, details, left + 7, top + 18, width - 14, height - 21, 7, false);
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
  const signatoryHeight = isBill ? 30 : 28;
  const termsHeight = isBill ? 62 : 58;
  const closingGap = 4;
  const bottomMargin = isBill ? 42 : 150;
  const signatoryTop = pageHeight - bottomMargin - signatoryHeight;
  const termsTop = signatoryTop - closingGap - termsHeight;
  const date = quotationDateLabel_(quotation.quotationDate);
  const subject = `${isBill ? 'Bill' : 'Quotation'} for ${quotation.transformerCapacity} Transformer${quotation.transformerMake ? ` - ${quotation.transformerMake}` : ''}`;

  setQuotationText_(slide, isBill ? 'SERVICE BILL' : 'QUOTATION', margin, top, contentWidth, 26, 20, true, SlidesApp.ParagraphAlignment.CENTER);
  setQuotationText_(
    slide,
    `${isBill ? 'Bill' : 'Quotation'} No.: ${quotation.quotationNo}  |  Date: ${date}`,
    margin,
    top + 28,
    contentWidth,
    18,
    10,
    true,
    SlidesApp.ParagraphAlignment.CENTER
  );

  const subjectTop = top + 53;
  setQuotationText_(slide, subject, margin, subjectTop, contentWidth, 19, 11, true);
  const boxTop = subjectTop + 24;
  const boxGap = 12;
  const boxWidth = (contentWidth - boxGap) / 2;
  const boxHeight = 74;
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
    boxHeight,
    isBill
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
    boxHeight,
    isBill
  );

  const serviceTop = boxTop + boxHeight + 7;
  setQuotationText_(slide, isBill ? 'SERVICE DETAILS' : 'SERVICES / RATES', margin, serviceTop, contentWidth, 18, 11, true);
  const tableTop = serviceTop + 18;
  const billTotalsHeight = 52;
  const billTableTotalsGap = 0;
  const tableReflowAllowance = 120;
  const billTermsGap = 5;
  const billHeadingAndWarrantyHeight = 38;
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
  const termsLineCapacity = Math.max(40, Math.floor(contentWidth / 3.2));
  const termsLineCount = isBill
    ? billTerms.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / termsLineCapacity)), 0)
    : 0;
  const billTermsTextHeight = Math.max(18, termsLineCount * 6.5);
  const tableBottom = isBill
    ? signatoryTop - closingGap - billTermsTextHeight - billHeadingAndWarrantyHeight - billTermsGap - billTotalsHeight - billTableTotalsGap
    : termsTop - 10;
  const rowHeight = 14;
  const tableHeight = (quotation.lineItems.length + 1) * rowHeight;
  if (tableTop + tableHeight > tableBottom) {
    throw new Error('There are too many service rows to fit above the warranty and signatory. Remove some services and try again.');
  }
  const table = slide.insertTable(quotation.lineItems.length + 1, isBill ? 6 : 3, margin, tableTop, contentWidth, tableHeight);
  const columnWidths = isBill
    ? [32, contentWidth - 257, 32, 36, 70, 87]
    : [32, contentWidth - 132, 100];

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
      cell.getText().getTextStyle().setFontFamily('Arial').setFontSize(7).setForegroundColor('#172033');
      cell.getText().getParagraphStyle().setParagraphAlignment(isBill && column >= 4 ? SlidesApp.ParagraphAlignment.END : SlidesApp.ParagraphAlignment.START);
    });
  });

  let billSignatoryTop = signatoryTop;
  const belowTableObjectIds = [];
  if (isBill) {
    const renderedTableHeight = table.getHeight();
    const totalsTop = tableTop + renderedTableHeight + billTableTotalsGap - 8;
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
      36,
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
      contentWidth * 0.54,
      billTotalsHeight,
      9,
      true,
      SlidesApp.ParagraphAlignment.START
    );
    belowTableObjectIds.push(amountWordsShape.getObjectId());
    const warrantyHeadingTop = totalsTop + billTotalsHeight + billTermsGap;
    const panelPadding = 6;
    const warrantyHeadingTextTop = warrantyHeadingTop + 4;
    const warrantyTextTop = warrantyHeadingTop + 13;
    const termsHeadingTop = warrantyTextTop + 16;
    const termsTextTop = termsHeadingTop + 9;
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
        billSignatoryTop + signatoryHeight > pageHeight - 2) {
      throw new Error('There are too many service rows or terms to fit above the digital signatory. Reduce the service rows or shorten the terms.');
    }

    belowTableObjectIds.push(setQuotationText_(slide, 'WARRANTY', margin + panelPadding, warrantyHeadingTextTop, contentWidth - panelPadding * 2, 9, 7, true).getObjectId());
    belowTableObjectIds.push(setQuotationText_(
      slide,
      quotation.warrantyMonths
        ? `Warranty valid for ${quotation.warrantyMonths} months from completion / commissioning, limited to the specified work.`
        : 'Warranty, wherever applicable, will be as specified for the respective work.',
      margin + panelPadding,
      warrantyTextTop,
      contentWidth - panelPadding * 2,
      15,
      7,
      false
    ).getObjectId());
    belowTableObjectIds.push(setQuotationText_(slide, 'TERMS & CONDITIONS', margin + panelPadding, termsHeadingTop, contentWidth - panelPadding * 2, 10, 7, true).getObjectId());
    belowTableObjectIds.push(setQuotationText_(slide, billTerms, margin + panelPadding, termsTextTop, contentWidth - panelPadding * 2, termsTextHeight, 6.5, false).getObjectId());
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
      6.5,
      false
    );
    belowTableObjectIds.push(termsShape.getObjectId());
  }
  const signatory = addQuotationSignatory_(
    slide,
    margin + contentWidth * 0.48,
    billSignatoryTop,
    contentWidth * 0.52,
    signatoryHeight,
    9
  );
  belowTableObjectIds.push(signatory.getObjectId());
  return {
    tableObjectId: table.getObjectId(),
    columnWidths,
    initialTableHeight: table.getHeight(),
    belowTableObjectIds,
    signatoryObjectId: signatory.getObjectId(),
    isBill,
    maximumContentBottom: (pageHeight - 2) * 12700
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
    Email: quotation.email,
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
    DocumentGroupId: quotation.documentGroupId,
    GroupPosition: quotation.groupPosition,
    GroupCount: quotation.groupCount,
    UpdatedAt: quotation.updatedAt
  };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.getRange(2, 1, 1, headers.length).setValues([headers.map(header => row[header] ?? '')]);
}

function quotationDriveFileId_(url) {
  const match = String(url || '').match(/(?:\/d\/|[?&]id=)([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}

function quotationNumberSequence_(quotationNo, documentType) {
  const value = String(quotationNo || '');
  const match = documentType === 'BILL'
    ? value.match(/^BILL\/\d{2}-\d{2}\/\d{4}-(\d+)$/)
    : value.match(/^VST\/\d{2}-\d{2}\/\d{4}-(\d+)$/) || value.match(/^(\d+)-\d{2}-\d{2}$/);
  return match ? Number(match[1]) : 0;
}

function allocateQuotationNumbersLocked_(documentType, financialYear, quotationDate, count) {
  const settings = getQuotationConfig().data.settings;
  const startingNumber = Number(settings['Starting Quotation Number'] || 1);
  const matchingRows = getSheetData(SHEET_NAMES.QUOTATIONS)
    .filter(row => String(row.FinancialYear || '') === financialYear
      && String(row.DocumentType || 'QUOTATION').toUpperCase() === documentType);
  const largestSavedNumber = matchingRows.reduce(
    (largest, row) => Math.max(largest, quotationNumberSequence_(row.QuotationNo, documentType)),
    0,
  );
  const counterKey = `QuotationSequence:${documentType}:${financialYear}`;
  const properties = PropertiesService.getScriptProperties();
  let nextNumber = Math.max(
    startingNumber,
    largestSavedNumber + 1,
    Number(properties.getProperty(counterKey) || startingNumber),
  );
  const date = Utilities.parseDate(quotationDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const dateCode = Utilities.formatDate(date, Session.getScriptTimeZone(), 'ddMM');
  const prefix = documentType === 'BILL' ? 'BILL' : 'VST';
  const usedNumbers = new Set(matchingRows.map(row => String(row.QuotationNo || '')));
  const numbers = [];
  while (numbers.length < count) {
    const candidate = `${prefix}/${financialYear}/${dateCode}-${nextNumber}`;
    nextNumber += 1;
    if (!usedNumbers.has(candidate)) numbers.push(candidate);
  }
  properties.setProperty(counterKey, String(nextNumber));
  return numbers;
}

function reserveQuotationNumbers(data) {
  const documentType = String(data.documentType || 'QUOTATION').toUpperCase();
  const financialYear = String(data.financialYear || '');
  const quotationDate = String(data.quotationDate || '');
  const count = Number(data.count);
  if (documentType !== 'QUOTATION' && documentType !== 'BILL') {
    throw new Error('Choose either a quotation or bill document.');
  }
  if (!/^\d{2}-\d{2}$/.test(financialYear)) {
    throw new Error('Financial Year must use the format YY-YY.');
  }
  if (!Number.isInteger(count) || count < 1 || count > 2) {
    throw new Error('A quotation or bill can reserve one or two document numbers.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    initializeQuotationSheets();
    return {
      status: 'SUCCESS',
      data: {
        numbers: allocateQuotationNumbersLocked_(documentType, financialYear, quotationDate, count),
      },
    };
  } finally {
    lock.releaseLock();
  }
}

function generatedQuotationRecord_(input, outputFormat, now, groupId, groupPosition, groupCount) {
  const documentType = String(input.documentType || 'QUOTATION').toUpperCase();
  if (documentType !== 'QUOTATION' && documentType !== 'BILL') {
    throw new Error('Choose either a quotation or bill document.');
  }
  if (!String(input.quotationNo || '').trim()) throw new Error('A reserved document number is required.');
  if (!String(input.customerName || '').trim()) throw new Error('Customer Name is required.');
  if (!String(input.mobile || '').trim()) throw new Error('Mobile is required.');
  if (!QUOTATION_CAPACITIES.includes(String(input.transformerCapacity || ''))) {
    throw new Error('Select a valid transformer capacity.');
  }
  if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) {
    throw new Error('Every generated document must contain at least one service.');
  }

  const seenServices = new Set();
  const lineItems = input.lineItems.map(item => {
    const service = String(item.service || '');
    if (!QUOTATION_SERVICES.includes(service)) throw new Error(`Unknown quotation service: ${service}`);
    if (seenServices.has(service)) throw new Error(`${service} can only be added once per document.`);
    seenServices.add(service);
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
  const financialYear = String(input.financialYear || '');
  if (!/^\d{2}-\d{2}$/.test(financialYear)) throw new Error('Financial Year must use the format YY-YY.');
  const numberPrefix = documentType === 'BILL' ? 'BILL' : 'VST';
  if (!new RegExp(`^${numberPrefix}\\/${financialYear.replace('-', '\\-')}\\/\\d{4}-\\d+$`).test(String(input.quotationNo))) {
    throw new Error('The generated document number does not match its document type and financial year.');
  }
  const subtotal = Math.round(lineItems.reduce(
    (sum, item) => sum + (documentType === 'BILL' ? item.quantity : 1) * item.rate,
    0,
  ) * 100) / 100;
  const gstApplicable = documentType === 'BILL'
    && (input.gstApplicable === true || String(input.gstApplicable).toLowerCase() === 'true');
  const gstRate = gstApplicable ? Number(input.gstRate || 19) : 0;
  const gstAmount = gstApplicable ? Math.round(subtotal * gstRate) / 100 : 0;
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;
  const warrantyMonths = documentType === 'BILL' && input.warrantyMonths !== '' && input.warrantyMonths != null
    ? Number(input.warrantyMonths)
    : 0;
  if (documentType === 'BILL' && (!Number.isInteger(warrantyMonths) || warrantyMonths < 0)) {
    throw new Error('Warranty period must be a whole number of months.');
  }
  return {
    ...input,
    quotationNo: String(input.quotationNo),
    documentType,
    customerName: String(input.customerName).trim(),
    customerAddress: String(input.customerAddress || '').trim(),
    contactPerson: String(input.contactPerson || '').trim(),
    mobile: String(input.mobile).trim(),
    email: String(input.email || '').trim(),
    transformerMake: String(input.transformerMake || '').trim(),
    transformerCapacity: String(input.transformerCapacity),
    transformerSerialNo: String(input.transformerSerialNo || '').trim(),
    transformerLocation: String(input.transformerLocation || '').trim(),
    quotationDate: String(input.quotationDate || new Date().toISOString().split('T')[0]),
    financialYear,
    outputFormat,
    lineItems,
    subtotal: documentType === 'BILL' ? subtotal : subtotal,
    gstApplicable,
    gstRate,
    gstAmount,
    grandTotal,
    warrantyMonths: documentType === 'BILL' ? warrantyMonths : '',
    terms: documentType === 'BILL' ? String(input.terms || '').trim() : '',
    documentGroupId: groupId,
    groupPosition,
    groupCount,
    createdAt: String(input.createdAt || now),
    updatedAt: now,
  }
}

function saveGeneratedQuotationGroup(data) {
  initializeQuotationSheets();
  if (!data || !Array.isArray(data.records) || data.records.length < 1 || data.records.length > 2) {
    throw new Error('A generated quotation or bill must contain one or two numbered documents.');
  }
  const outputFormat = String(data.outputFormat || '').toUpperCase();
  if (outputFormat !== 'PDF' && outputFormat !== 'PNG') throw new Error('Choose PDF or PNG output.');
  if (data.records.length > 1 && outputFormat !== 'PDF') {
    throw new Error('Overflow documents must be saved together as a two-page PDF.');
  }
  const groupId = data.records.length > 1 ? String(data.documentGroupId || '') : '';
  if (data.records.length > 1 && !/^[A-Za-z0-9_-]{8,80}$/.test(groupId)) {
    throw new Error('A valid linked-document group ID is required for an overflow document.');
  }
  const fileDataUrl = String(data.dataUrl || '');
  if (fileDataUrl.length > 16 * 1024 * 1024) throw new Error('The generated document exceeds the upload limit.');
  const signature = outputFormat === 'PDF'
    ? /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/
    : /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
  const match = fileDataUrl.match(signature);
  if (!match) throw new Error(`The generated document is not a valid ${outputFormat} file.`);
  const bytes = Utilities.base64Decode(match[1]);
  if (bytes.length === 0 || bytes.length > 12 * 1024 * 1024) {
    throw new Error('The generated file must be smaller than 12 MB.');
  }
  if (outputFormat === 'PDF' && Utilities.newBlob(bytes).getDataAsString().slice(0, 5) !== '%PDF-') {
    throw new Error('The generated PDF is invalid.');
  }
  if (outputFormat === 'PNG' && (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71)) {
    throw new Error('The generated PNG is invalid.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let generatedFile = null;
  const changedRows = [];
  const appendedRows = [];
  const deletedRows = [];
  try {
    const settings = getQuotationConfig().data.settings;
    const sheet = initializeSheet(SHEET_NAMES.QUOTATIONS, SHEET_HEADERS.Quotations);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const recordsInput = data.records;
    const now = getTimestamp();
    const records = recordsInput.map((record, index) => generatedQuotationRecord_(
      record,
      outputFormat,
      now,
      groupId,
      index + 1,
      recordsInput.length,
    ));
    if (new Set(records.map(record => record.quotationNo)).size !== records.length) {
      throw new Error('Each document in an overflow group must have a different number.');
    }
    const services = records.flatMap(record => record.lineItems.map(item => item.service));
    if (new Set(services).size !== services.length) {
      throw new Error('A service cannot appear in more than one document in the same linked group.');
    }
    if (records.some(record => record.documentType !== records[0].documentType
        || record.financialYear !== records[0].financialYear
        || record.customerName !== records[0].customerName
        || record.mobile !== records[0].mobile
        || record.quotationDate !== records[0].quotationDate)) {
      throw new Error('Linked documents must have the same customer, date, type, and financial year.');
    }

    const replaceNumbers = Array.isArray(data.replaceQuotationNumbers)
      ? data.replaceQuotationNumbers.map(String)
      : [];
    const oldRows = replaceNumbers
      .map(number => findRowByValue(SHEET_NAMES.QUOTATIONS, 'QuotationNo', number))
      .filter(Boolean);
    if (replaceNumbers.length !== oldRows.length) {
      throw new Error('One or more existing documents could not be found for regeneration.');
    }
    const replacingNumbers = new Set(replaceNumbers);
    records.forEach(record => {
      const conflict = findRowByValue(SHEET_NAMES.QUOTATIONS, 'QuotationNo', record.quotationNo);
      if (conflict && !replacingNumbers.has(record.quotationNo)) {
        throw new Error(`Document number ${record.quotationNo} is already in use.`);
      }
    });
    const storedGroupIds = [...new Set(oldRows.map(row => {
      const index = row.headers.indexOf('DocumentGroupId');
      return index >= 0 ? String(row.data[index] || '') : '';
    }).filter(Boolean))];
    if (storedGroupIds.length > 1) throw new Error('The selected documents belong to different linked groups.');
    const existingGroupId = storedGroupIds[0] || '';
    const expectedNumbers = existingGroupId
      ? getSheetData(SHEET_NAMES.QUOTATIONS)
        .filter(row => String(row.DocumentGroupId || '') === existingGroupId)
        .map(row => String(row.QuotationNo || ''))
      : replaceNumbers;
    if (expectedNumbers.some(number => !replacingNumbers.has(number))) {
      throw new Error('Edit or delete the linked group as a whole so its pages remain synchronized.');
    }
    const rootName = settings['Quotation Root Folder'] || 'DS Transformers';
    const rootMatches = DriveApp.getRootFolder().getFoldersByName(rootName);
    const rootFolder = rootMatches.hasNext() ? rootMatches.next() : DriveApp.getRootFolder().createFolder(rootName);
    const folderName = records[0].documentType === 'BILL'
      ? settings['Bill Folder'] || 'Service Bills'
      : settings['Quotation Folder'] || 'Quotations';
    const folderMatches = rootFolder.getFoldersByName(folderName);
    const folder = folderMatches.hasNext() ? folderMatches.next() : rootFolder.createFolder(folderName);
    const fileName = String(data.fileName || `${records[0].quotationNo}.${outputFormat.toLowerCase()}`)
      .replace(/[^\w.-]/g, '_')
      .slice(0, 120);
    const mimeType = outputFormat === 'PDF' ? 'application/pdf' : 'image/png';
    generatedFile = folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));

    const rowFor = record => {
      const rowValues = {
        QuotationNo: record.quotationNo,
        CustomerName: record.customerName,
        CustomerAddress: record.customerAddress,
        ContactPerson: record.contactPerson,
        Mobile: record.mobile,
        Email: record.email,
        TransformerMake: record.transformerMake,
        TransformerCapacity: record.transformerCapacity,
        TransformerSerialNo: record.transformerSerialNo,
        TransformerLocation: record.transformerLocation,
        QuotationDate: record.quotationDate,
        FinancialYear: record.financialYear,
        LineItems: JSON.stringify(record.lineItems),
        Subtotal: record.subtotal,
        PdfUrl: outputFormat === 'PDF' ? generatedFile.getUrl() : '',
        FileUrl: generatedFile.getUrl(),
        FileId: generatedFile.getId(),
        OutputFormat: outputFormat,
        CreatedAt: record.createdAt,
        UpdatedAt: now,
        DocumentType: record.documentType,
        GSTApplicable: record.gstApplicable,
        GSTRate: record.gstRate,
        GSTAmount: record.gstAmount,
        GrandTotal: record.grandTotal,
        WarrantyMonths: record.warrantyMonths,
        Terms: record.terms,
        DocumentGroupId: groupId,
        GroupPosition: record.groupPosition,
        GroupCount: record.groupCount,
      };
      return headers.map(header => rowValues[header] === undefined ? '' : rowValues[header]);
    };
    const recordsByNumber = new Map(records.map(record => [record.quotationNo, record]));
    const recordNumbers = new Set(recordsByNumber.keys());
    oldRows
      .filter(row => !recordNumbers.has(String(row.data[row.headers.indexOf('QuotationNo')] || '')))
      .sort((left, right) => right.rowIndex - left.rowIndex)
      .forEach(row => {
        const values = sheet.getRange(row.rowIndex, 1, 1, headers.length).getValues()[0];
        sheet.deleteRow(row.rowIndex);
        deletedRows.push({ rowIndex: row.rowIndex, values });
      });
    recordsByNumber.forEach((record, number) => {
      const existing = findRowByValue(SHEET_NAMES.QUOTATIONS, 'QuotationNo', number);
      if (existing) {
        const previousValues = sheet.getRange(existing.rowIndex, 1, 1, headers.length).getValues()[0];
        changedRows.push({ quotationNo: number, values: previousValues });
        sheet.getRange(existing.rowIndex, 1, 1, headers.length).setValues([rowFor(record)]);
      } else if (oldRows.length === 0 || records.length > oldRows.length) {
        sheet.appendRow(rowFor(record));
        appendedRows.push(number);
      } else {
        throw new Error(`Could not match document ${number} to an existing linked record.`);
      }
    });

    writeQuotationForm_(records[0]);
    const oldFileIds = [...new Set(oldRows.map(row => {
      const index = row.headers.indexOf('FileId');
      return index >= 0 ? String(row.data[index] || '') : '';
    }).filter(id => id && id !== generatedFile.getId()))];
    oldFileIds.forEach(fileId => {
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (error) {
        console.warn(`Old quotation file cleanup failed for ${fileId}: ${error.message}`);
      }
    });
    const resultRecords = records.map(record => ({
      ...record,
      fileUrl: generatedFile.getUrl(),
      fileId: generatedFile.getId(),
      pdfUrl: outputFormat === 'PDF' ? generatedFile.getUrl() : '',
    }));
    return { status: 'SUCCESS', data: resultRecords };
  } catch (error) {
    appendedRows.forEach(number => {
      const appended = findRowByValue(SHEET_NAMES.QUOTATIONS, 'QuotationNo', number);
      if (appended) sheet.deleteRow(appended.rowIndex);
    });
    deletedRows
      .sort((left, right) => left.rowIndex - right.rowIndex)
      .forEach(entry => {
        sheet.insertRowBefore(entry.rowIndex);
        sheet.getRange(entry.rowIndex, 1, 1, entry.values.length).setValues([entry.values]);
      });
    changedRows.forEach(entry => {
      const existing = findRowByValue(SHEET_NAMES.QUOTATIONS, 'QuotationNo', entry.quotationNo);
      if (existing) {
        sheet.getRange(existing.rowIndex, 1, 1, entry.values.length).setValues([entry.values]);
      }
    });
    if (generatedFile) generatedFile.setTrashed(true);
    throw error;
  } finally {
    lock.releaseLock();
  }
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
      const dateValue = String(data.quotationDate || new Date().toISOString().split('T')[0]);
      quotationNo = allocateQuotationNumbersLocked_(documentType, financialYear, dateValue, 1)[0];
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
  initializeDropdownDefaults_();
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
      case 'GET_DROPDOWN_DEFAULTS':
        result = getDropdownDefaults();
        break;
      case 'GET_QUOTATION_CONFIG':
        result = getQuotationConfig();
        break;
      case 'GET_QUOTATIONS':
        result = getAllQuotations();
        break;
      case 'GET_QUOTATION_BY_NO':
        result = getQuotationByNo(payload.quotationNo || raw.quotationNo);
        break;
      case 'RESERVE_QUOTATION_NUMBERS':
        result = reserveQuotationNumbers(payload);
        break;
      case 'SAVE_GENERATED_QUOTATION_GROUP':
        result = saveGeneratedQuotationGroup(payload);
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
      case 'FIND_TRANSFORMERS_BY_IDENTITY':
        result = {
          status: 'SUCCESS',
          data: findTransformersByIdentity_(payload.field, payload.value)
        };
        break;
      case 'ADD_TRANSFORMER':
      case 'ADDTRANSFORMER':
        result = addTransformer(payload);
        break;
      case 'UPDATE_TRANSFORMER':
      case 'UPDATETRANSFORMER':
        result = updateTransformer(payload.id || raw.id, payload);
        break;
      case 'DELETE_TRANSFORMER':
      case 'DELETETRANSFORMER':
        result = deleteTransformer(payload.id || raw.id);
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
      case 'LINK_TNOTE_TRANSFORMER':
        result = linkTNoteTransformer(payload.tNoteId, payload.transformerId, payload.intakeType);
        break;
      case 'UPDATE_TNOTE_TRANSFORMER_VISIT_STATUS':
        result = updateTNoteTransformerVisitStatus(payload.tNoteId, payload.transformerId, payload.visitStatus);
        break;
      case 'UNLINK_TNOTE_TRANSFORMER':
        result = unlinkTNoteTransformer(payload.tNoteId, payload.transformerId);
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
      case 'MARK_DC_DELIVERED':
        result = markDCDelivered_(payload.dcNo, payload.attachments);
        break;
      case 'SAVE_GENERATED_DC_PDF':
        result = saveGeneratedDCChallanPdf_(payload.dcNo, payload.fileName, payload.dataUrl);
        break;
      case 'ADD_TRANSFORMER_TO_DC':
        result = updateDCTransformerAssignment_(payload.dcNo, payload.transformerId, true);
        break;
      case 'REMOVE_TRANSFORMER_FROM_DC':
        result = updateDCTransformerAssignment_(payload.dcNo, payload.transformerId, false);
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
