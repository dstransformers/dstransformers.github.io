const appConfig = {
  businessEmail: 'BUSINESS_EMAIL',
  businessWhatsApp: 'BUSINESS_WHATSAPP_NUMBER',
  storageKey: 'ds_transformers_enquiries_v1'
};

const mobileRegex = /^[6-9]\d{9}$/;

function showFieldError(fieldName, message) {
  const field = document.getElementById(fieldName)?.closest('.field');
  const errorNode = document.querySelector(`[data-error-for="${fieldName}"]`);

  if (field) field.classList.add('error');
  if (errorNode) errorNode.textContent = message;
}

function clearFieldError(fieldName) {
  const field = document.getElementById(fieldName)?.closest('.field');
  const errorNode = document.querySelector(`[data-error-for="${fieldName}"]`);

  if (field) field.classList.remove('error');
  if (errorNode) errorNode.textContent = '';
}

function getSelectedServices() {
  return Array.from(document.querySelectorAll('input[name="serviceRequired"]:checked')).map((input) => input.value);
}

function setConditionalFields() {
  const selectedServices = getSelectedServices();
  const leakageVisible = selectedServices.includes('Oil Leakage Rectification');
  const breakdownSelected = selectedServices.includes('Transformer Breakdown Repair') || document.getElementById('transformerStatus')?.value === 'Not working / breakdown';

  const leakageWrap = document.getElementById('leakageLocationWrap');
  const breakdownWrap = document.getElementById('breakdownTimingWrap');
  const siteLocationWrap = document.getElementById('siteLocationWrap');
  const locationChoice = document.getElementById('transformerLocationChoice')?.value;

  leakageWrap?.classList.toggle('hidden', !leakageVisible);
  breakdownWrap?.classList.toggle('hidden', !breakdownSelected);
  siteLocationWrap?.classList.toggle('hidden', locationChoice !== 'Customer site');

  const otherServiceField = document.getElementById('serviceOtherField');
  const otherServiceCheck = document.getElementById('serviceOtherCheck');
  otherServiceField?.classList.toggle('hidden', !otherServiceCheck?.checked);
}

function readFilesAsDataUrls(files) {
  if (!files || files.length === 0) {
    return Promise.resolve([]);
  }

  const fileLimit = 5;
  const selectedFiles = Array.from(files).slice(0, fileLimit);

  return Promise.all(
    selectedFiles.map((file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result
        });
        reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
        reader.readAsDataURL(file);
      })
    )
  );
}

function generateEnquiryId() {
  const storage = JSON.parse(localStorage.getItem(appConfig.storageKey) || '[]');
  const year = new Date().getFullYear();
  const highestNumber = storage.reduce((max, item) => {
    const match = (item.enquiryId || '').match(/DT-(\d{4})-(\d{4})/);
    if (!match) return max;
    return Math.max(max, Number(match[2]));
  }, 0);

  return `DT-${year}-${String(highestNumber + 1).padStart(4, '0')}`;
}

function validateForm(form) {
  let valid = true;

  const companyName = form.companyName.value.trim();
  const contactPerson = form.contactPerson.value.trim();
  const mobileNumber = form.mobileNumber.value.trim();
  const locationChoice = form.transformerLocationChoice.value.trim();
  const siteLocation = form.siteLocation.value.trim();
  const transformerCapacity = form.transformerCapacity.value.trim();
  const transformerType = form.transformerType.value.trim();
  const transformerQuantity = form.transformerQuantity.value.trim();
  const workshopServiceLocation = form.workshopServiceLocation.value.trim();
  const selectedServices = getSelectedServices();

  clearFieldError('companyName');
  clearFieldError('contactPerson');
  clearFieldError('mobileNumber');
  clearFieldError('transformerLocationChoice');
  clearFieldError('siteLocation');
  clearFieldError('transformerCapacity');
  clearFieldError('transformerType');
  clearFieldError('transformerQuantity');
  clearFieldError('workshopServiceLocation');
  clearFieldError('serviceRequired');
  clearFieldError('transformerStatus');
  clearFieldError('servicePriority');

  if (!companyName) {
    showFieldError('companyName', 'Please enter the company or organization name.');
    valid = false;
  }

  if (!contactPerson) {
    showFieldError('contactPerson', 'Please enter the contact person name.');
    valid = false;
  }

  if (!mobileNumber || !mobileRegex.test(mobileNumber)) {
    showFieldError('mobileNumber', 'Please enter a valid 10-digit mobile number.');
    valid = false;
  }

  if (!locationChoice) {
    showFieldError('transformerLocationChoice', 'Please select where the transformer is located.');
    valid = false;
  }

  if (locationChoice === 'Customer site' && !siteLocation) {
    showFieldError('siteLocation', 'Please enter the site location.');
    valid = false;
  }

  if (!transformerCapacity) {
    showFieldError('transformerCapacity', 'Please select a transformer capacity.');
    valid = false;
  }

  if (!transformerType) {
    showFieldError('transformerType', 'Please select the transformer type.');
    valid = false;
  }

  if (!transformerQuantity || Number(transformerQuantity) < 1) {
    showFieldError('transformerQuantity', 'Please enter at least 1 transformer.');
    valid = false;
  }

  if (!workshopServiceLocation) {
    showFieldError('workshopServiceLocation', 'Please select where the required work is expected to be carried out.');
    valid = false;
  }

  if (selectedServices.length === 0) {
    const serviceError = document.querySelector('[data-error-for="serviceRequired"]');
    if (serviceError) serviceError.textContent = 'Please select at least one required service.';
    valid = false;
  }

  if (!form.transformerStatus.value) {
    showFieldError('transformerStatus', 'Please select the current transformer status.');
    valid = false;
  }

  if (!form.servicePriority.value) {
    showFieldError('servicePriority', 'Please select how soon you need assistance.');
    valid = false;
  }

  return valid;
}

function getFormPayload(form) {
  const services = getSelectedServices();
  const otherService = document.getElementById('otherServiceDetail')?.value.trim();

  if (services.includes('Other') && otherService) {
    services[services.indexOf('Other')] = otherService;
  }

  return {
    companyName: form.companyName.value.trim(),
    contactPerson: form.contactPerson.value.trim(),
    mobileNumber: form.mobileNumber.value.trim(),
    whatsappNumber: form.whatsappNumber.value.trim(),
    emailAddress: form.emailAddress.value.trim(),
    transformerLocationChoice: form.transformerLocationChoice.value,
    siteLocation: form.siteLocation.value.trim(),
    workshopServiceLocation: form.workshopServiceLocation.value,
    transformerCapacity: form.transformerCapacity.value,
    transformerType: form.transformerType.value,
    transformerMake: form.transformerMake.value.trim(),
    transformerAge: form.transformerAge.value.trim(),
    transformerQuantity: Number(form.transformerQuantity.value || 1),
    serviceRequired: services,
    otherServiceDetail: otherService,
    problemDescription: form.problemDescription.value.trim(),
    transformerStatus: form.transformerStatus.value,
    servicePriority: form.servicePriority.value,
    leakageLocation: form.leakageLocation.value.trim(),
    breakdownTiming: form.breakdownTiming.value.trim(),
    enquiryId: generateEnquiryId(),
    createdAt: new Date().toISOString(),
    status: 'New'
  };
}

function buildNotificationMessage(enquiry) {
  const servicesList = enquiry.serviceRequired.map((service) => `• ${service}`).join('\n');
  const shortProblem = enquiry.problemDescription || 'Inspection required';

  return {
    email: {
      to: appConfig.businessEmail,
      subject: `New Transformer Enquiry — ${enquiry.enquiryId} — ${enquiry.companyName}`,
      body: `
NEW TRANSFORMER SERVICE ENQUIRY

Enquiry ID: ${enquiry.enquiryId}

Customer
Company: ${enquiry.companyName}
Contact Person: ${enquiry.contactPerson}
Mobile: ${enquiry.mobileNumber}
WhatsApp: ${enquiry.whatsappNumber || 'Not provided'}
Email: ${enquiry.emailAddress || 'Not provided'}
Location: ${enquiry.transformerLocationChoice}
Site: ${enquiry.siteLocation || 'Not required'}
Workshop Requirement: ${enquiry.workshopServiceLocation}

Transformer
Capacity: ${enquiry.transformerCapacity}
Type: ${enquiry.transformerType}
Make: ${enquiry.transformerMake || 'Not provided'}
Age: ${enquiry.transformerAge || 'Not provided'}
Quantity: ${enquiry.transformerQuantity}

Service Required
${servicesList}

Transformer Status
${enquiry.transformerStatus}

Priority
${enquiry.servicePriority}

Problem
${enquiry.problemDescription || 'No problem description provided.'}

Attachments
${enquiry.attachments?.length || 0} transformer file(s) uploaded

View Full Enquiry
${window.location.origin}${window.location.pathname}#quotation-form
      `.trim()
    },
    whatsapp: {
      to: appConfig.businessWhatsApp,
      message: `🔔 *NEW TRANSFORMER ENQUIRY*\n\n*Enquiry:* ${enquiry.enquiryId}\n*Company:* ${enquiry.companyName}\n*Contact:* ${enquiry.contactPerson}\n*Phone:* ${enquiry.mobileNumber}\n*Location:* ${enquiry.siteLocation || enquiry.transformerLocationChoice}\n*Transformer:* ${enquiry.transformerCapacity}\n*Problem:* ${shortProblem}\n*Required:*\n${servicesList}\n*Priority:* ${enquiry.servicePriority}\n📷 ${enquiry.attachments?.length || 0} photos uploaded\n\n*View Enquiry:* ${window.location.origin}${window.location.pathname}#quotation-form`
    }
  };
}

function handleSubmitSuccess(enquiry) {
  const successBlock = document.getElementById('quoteSuccess');
  const successId = document.getElementById('successEnquiryId');
  const form = document.getElementById('quotationForm');

  if (successId) successId.textContent = enquiry.enquiryId;
  if (successBlock) successBlock.classList.remove('hidden');
  if (form) form.classList.add('hidden');

  const formSection = document.getElementById('quotation-form');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function configureFormInteractions() {
  const form = document.getElementById('quotationForm');
  if (!form) return;

  const servicesCheckboxes = form.querySelectorAll('input[name="serviceRequired"]');
  servicesCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      setConditionalFields();
      const serviceError = document.querySelector('[data-error-for="serviceRequired"]');
      if (serviceError && getSelectedServices().length > 0) serviceError.textContent = '';
    });
  });

  const statusField = form.querySelector('#transformerStatus');
  statusField?.addEventListener('change', setConditionalFields);

  const locationField = form.querySelector('#transformerLocationChoice');
  locationField?.addEventListener('change', setConditionalFields);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (form.dataset.submitting === 'true') return;

    if (!validateForm(form)) return;

    form.dataset.submitting = 'true';
    const submitButton = form.querySelector('.submit-btn');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }

    try {
      const enquiry = getFormPayload(form);
      const files = await readFilesAsDataUrls(form.photoUpload.files);
      enquiry.attachments = files;

      const storage = JSON.parse(localStorage.getItem(appConfig.storageKey) || '[]');
      storage.unshift(enquiry);
      localStorage.setItem(appConfig.storageKey, JSON.stringify(storage));

      const notifications = buildNotificationMessage(enquiry);
      console.info('EMAIL_NOTIFICATION', notifications.email);
      console.info('WHATSAPP_NOTIFICATION', notifications.whatsapp);

      handleSubmitSuccess(enquiry);
    } catch (error) {
      console.error('Enquiry submission failed', error);
      const errorNode = document.querySelector('[data-error-for="serviceRequired"]');
      if (errorNode) {
        errorNode.textContent = 'The enquiry could not be submitted. Please try again.';
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Quotation Request';
      }
      form.dataset.submitting = 'false';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const lightbox = document.getElementById('lightbox');
      const img = item.querySelector('img');
      const title = item.dataset.title || 'Workshop photo';
      const description = item.dataset.description || '';

      if (!lightbox || !img) return;

      const image = lightbox.querySelector('img');
      const caption = lightbox.querySelector('.lightbox-caption');
      const titleNode = lightbox.querySelector('.lightbox-title');

      if (image) image.src = item.href;
      if (titleNode) titleNode.textContent = title;
      if (caption) caption.textContent = description;

      lightbox.classList.add('visible');
    });
  });

  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox || event.target.closest('.lightbox-close')) {
        lightbox.classList.remove('visible');
      }
    });
  }

  const yearNode = document.getElementById('year');
  if (yearNode) {
    const currentYear = new Date().getFullYear();
    yearNode.textContent = currentYear;
  }

  setConditionalFields();
  configureFormInteractions();
});
