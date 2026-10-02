import React, { useEffect, useRef, useState } from 'react';
import './LandingPage.css';

export default function LandingPage({ onAdminLogin, isAuthenticated, onGoToDashboard }) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [quotation, setQuotation] = useState({
    companyName: '',
    contactPerson: '',
    mobileNumber: '',
    transformerCapacity: '',
    transformerMake: '',
    servicesRequired: [],
    problemDescription: '',
    transformerStatus: '',
    servicePriority: ''
  });
  const [quotationPhotos, setQuotationPhotos] = useState([]);
  const quotationPhotoInput = useRef(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState('');
  const [quoteError, setQuoteError] = useState('');

  useEffect(() => {
    if (!showQuotationModal) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowQuotationModal(false);
    };

    document.body.classList.add('quote-modal-open');
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.classList.remove('quote-modal-open');
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showQuotationModal]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    setTimeout(() => {
      if (loginUsername === 'admin' && loginPassword === 'admin') {
        setShowLoginModal(false);
        onAdminLogin();
      } else {
        setLoginError('Invalid credentials. Default is admin / admin');
      }
      setLoginLoading(false);
    }, 300);
  };

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    setQuoteLoading(true);
    setQuoteSuccess('');
    setQuoteError('');

    try {
      const attachments = await Promise.all(quotationPhotos.map((photo) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: photo.name,
          type: photo.type,
          size: photo.size,
          dataUrl: reader.result
        });
        reader.onerror = () => reject(new Error(`Unable to read ${photo.name}. Please choose the photo again.`));
        reader.readAsDataURL(photo);
      })));
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: quotation.companyName,
          contactPerson: quotation.contactPerson,
          customerPhone: quotation.mobileNumber,
          servicesRequired: quotation.servicesRequired.join(', '),
          transformerCapacity: quotation.transformerCapacity,
          transformerMake: quotation.transformerMake,
          transformerStatus: quotation.transformerStatus,
          servicePriority: quotation.servicePriority,
          problemDescription: quotation.problemDescription,
          attachments,
          status: 'NEW'
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || `Submission failed with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.status !== 'SUCCESS') {
        throw new Error(result.message || 'The quotation request could not be saved.');
      }

      setQuoteSuccess('Thank you! Your quotation request has been recorded. Our technical team will contact you shortly.');
      setQuotation({
        companyName: '',
        contactPerson: '',
        mobileNumber: '',
        transformerCapacity: '',
        transformerMake: '',
        servicesRequired: [],
        problemDescription: '',
        transformerStatus: '',
        servicePriority: ''
      });
      setQuotationPhotos([]);
      if (quotationPhotoInput.current) quotationPhotoInput.current.value = '';
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Failed to submit quotation request. Please try again.');
    } finally {
      setQuoteLoading(false);
    }
  };

  const updateQuotation = (field, value) => {
    setQuotation((current) => ({ ...current, [field]: value }));
  };

  const openQuotationModal = (event) => {
    event.preventDefault();
    setQuoteSuccess('');
    setQuoteError('');
    setShowQuotationModal(true);
  };

  const toggleQuotationService = (service) => {
    setQuotation((current) => ({
      ...current,
      servicesRequired: current.servicesRequired.includes(service)
        ? current.servicesRequired.filter((selected) => selected !== service)
        : [...current.servicesRequired, service]
    }));
  };

  const handleQuotationPhotosChange = (event) => {
    const files = Array.from(event.target.files || []);
    const maxPhotoCount = 5;
    const maxPhotoSize = 2 * 1024 * 1024;

    if (files.length > maxPhotoCount) {
      setQuotationPhotos([]);
      event.target.value = '';
      setQuoteError(`Please select no more than ${maxPhotoCount} photos.`);
      return;
    }

    const oversizedPhoto = files.find((file) => file.size > maxPhotoSize);
    if (oversizedPhoto) {
      setQuotationPhotos([]);
      event.target.value = '';
      setQuoteError(`${oversizedPhoto.name} is larger than 2 MB. Please choose a smaller photo.`);
      return;
    }

    setQuoteError('');
    setQuotationPhotos(files);
  };

  return (
    <div className="landing-root">
      {/* Site Header */}
      <header className="site-header">
        <div className="landing-container nav-wrap">
          <a href="#top" className="brand" aria-label="D.S. Transformers home">
            <span className="brand-mark">DS</span>
            <span className="brand-text">
              <strong>D.S. TRANSFORMERS</strong>
              <small>Electrical Contractor & Repair Specialist</small>
            </span>
          </a>

          <nav className="main-nav" aria-label="Primary navigation">
            <a href="#services">Services</a>
            <a href="#why-us">Why Us</a>
            <a href="#machinery">Machinery</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>

          <div className="header-actions">
            <a className="landing-btn btn-whatsapp" href="https://wa.me/919949396530" target="_blank" rel="noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.074-1.926-.461-1.393-.578-2.316-1.989-2.387-2.083-.07-.095-.572-.76-.572-1.448 0-.689.362-1.028.49-1.168.129-.14.282-.175.376-.175.093 0 .188.001.27.005.087.004.204-.033.319.243.12.288.409 1.002.446 1.075.037.073.061.16.012.257-.048.098-.073.159-.145.243-.072.085-.152.189-.217.254-.073.072-.149.151-.064.297.085.146.377.623.81 1.008.558.496 1.029.65 1.175.723.146.073.232.064.318-.036.087-.1.373-.434.473-.583.1-.149.2-.124.335-.075.136.049.864.407 1.012.481.149.074.248.111.285.174.037.063.037.367-.107.772z"/>
              </svg>
              WhatsApp
            </a>

            {/* Professional Modernized Admin Login Button */}
            {isAuthenticated ? (
              <button
                type="button"
                className="landing-btn btn-admin-login"
                onClick={onGoToDashboard}
                title="Go to VSTMS Operations Dashboard"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Dashboard</span>
                <span className="btn-admin-badge">Admin</span>
              </button>
            ) : (
              <button
                type="button"
                className="landing-btn btn-admin-login"
                onClick={() => setShowLoginModal(true)}
                title="Admin Portal Login"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="landing-container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">📍 Based in Mallapur, Hyderabad</span>
            <h1>Fast, Reliable <span>Transformer Repair</span> & Breakdown Services</h1>
            <p>
              Authorised Class-A Electrical Contractor specializing in HT/LT distribution and power transformer rewinding, maintenance, oil filtration, and emergency breakdown rectification across Telangana.
            </p>

            <div className="hero-chips">
              <span className="hero-chip">⚡ 24/7 Emergency Response</span>
              <span className="hero-chip">🔍 Free Site Inspection</span>
              <span className="hero-chip">🛡️ 1-Year Service Warranty</span>
              <span className="hero-chip">🏆 25+ Years Experience</span>
            </div>

            <div className="hero-cta">
              <a className="landing-btn btn-primary" href="#quotation-form" onClick={openQuotationModal}>Request Instant Quotation</a>
              <a className="landing-btn btn-whatsapp" href="https://wa.me/919949396530" target="_blank" rel="noreferrer">Chat on WhatsApp</a>
            </div>
          </div>

          <div className="hero-image-wrap">
            <img src="/PhotoGallery/Shed-1.jpeg" alt="D.S. Transformers Heavy Workshop" onError={(e) => { e.target.src = '/PhotoGallery/Shed.jpeg'; }} />
            <div className="hero-overlay-badge">
              <div>
                <strong>D.S. Transformers Facility</strong>
                <br />
                <span>Heavy Duty Overhead Cranes & Advanced Rewinding Infrastructure</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="landing-section" id="services" style={{ background: '#ffffff' }}>
        <div className="landing-container">
          <div className="section-head">
            <span className="eyebrow">Expert Solutions</span>
            <h2>Complete Transformer Engineering Services</h2>
            <p>From prompt on-site oil leakage repairs to full workshop coil rewinding and load testing.</p>
          </div>

          <div className="service-grid">
            <div className="service-card">
              <div className="service-icon">🛠️</div>
              <h3>Oil Leakage Rectification</h3>
              <p>Thorough gasket replacements, valve overhauls, bushing seal repairs, and tank weld sealing to completely eliminate oil leaks.</p>
              <a href="#quotation-form" onClick={openQuotationModal}>Get Quick Quote →</a>
            </div>

            <div className="service-card">
              <div className="service-icon">⚡</div>
              <h3>Transformer Breakdown Repair</h3>
              <p>Rapid emergency diagnostics, internal fault rectification, core inspection, bushing repairs, and priority restoration.</p>
              <a href="#quotation-form" onClick={openQuotationModal}>Get Quick Quote →</a>
            </div>

            <div className="service-card">
              <div className="service-icon">🔄</div>
              <h3>Coil Rewinding</h3>
              <p>High-grade electrolytic copper and aluminum conductor rewinding with precision automated winding machines and Class-H insulation.</p>
              <a href="#quotation-form" onClick={openQuotationModal}>Get Quick Quote →</a>
            </div>

            <div className="service-card">
              <div className="service-icon">💧</div>
              <h3>Oil Filtration & Dehydration</h3>
              <p>High-vacuum two-stage dielectric oil purification removing moisture, dissolved gases, and sludge to achieve BDV &gt; 60 kV.</p>
              <a href="#quotation-form" onClick={openQuotationModal}>Get Quick Quote →</a>
            </div>

            <div className="service-card">
              <div className="service-icon">🔩</div>
              <h3>Gasket & Bushing Replacement</h3>
              <p>Complete replacement of degraded cork-neoprene gaskets, porcelain HT/LT bushings, and brass terminal connectors.</p>
              <a href="#quotation-form" onClick={openQuotationModal}>Get Quick Quote →</a>
            </div>

            <div className="service-card">
              <div className="service-icon">🔍</div>
              <h3>Testing & Diagnostics</h3>
              <p>Comprehensive tests: Insulation Resistance (Megger), Turns Ratio, Winding Resistance, Magnetic Balance, and High Voltage withstand testing.</p>
              <a href="#quotation-form" onClick={openQuotationModal}>Get Quick Quote →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Why Us / Statistics Section */}
      <section className="landing-section" id="why-us">
        <div className="landing-container">
          <div className="section-head">
            <span className="eyebrow">Proven Track Record</span>
            <h2>Why Industrial Clients Trust D.S. Transformers</h2>
            <p>Delivering high-voltage reliability for manufacturing plants, commercial substations, and utilities.</p>
          </div>

          <div className="why-us-grid">
            <div className="stat-card">
              <div className="stat-num">25+</div>
              <div className="stat-label">Years of Industry Excellence</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">1,500+</div>
              <div className="stat-label">Transformers Serviced & Restored</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">Class-A</div>
              <div className="stat-label">Licensed Electrical Contractor</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">1 Year</div>
              <div className="stat-label">Full Comprehensive Warranty</div>
            </div>
          </div>
        </div>
      </section>

      {/* Workshop Machinery & Testing Facility Showcase */}
      <section className="landing-section" id="machinery" style={{ background: '#ffffff' }}>
        <div className="landing-container">
          <div className="section-head">
            <span className="eyebrow">State-of-the-Art Infrastructure</span>
            <h2>Our Workshop Testing & Overhaul Facility</h2>
            <p>Equipped with calibrated precision instruments and heavy-duty machinery for transformers up to 2500 kVA.</p>
          </div>

          <div className="gallery-grid">
            <div className="gallery-item">
              <img src="/PhotoGallery/BDVKit.jpeg" alt="Oil BDV Testing Kit" />
              <div className="gallery-item-title">Oil BDV Testing Kit (60-80 kV)</div>
            </div>
            <div className="gallery-item">
              <img src="/PhotoGallery/HVKit.jpeg" alt="High Voltage Test Bench" />
              <div className="gallery-item-title">High Voltage Test Bench</div>
            </div>
            <div className="gallery-item">
              <img src="/PhotoGallery/FilterMachine.jpeg" alt="Oil Filtration Machine" />
              <div className="gallery-item-title">Oil Dehydration & Filtration Unit</div>
            </div>
            <div className="gallery-item">
              <img src="/PhotoGallery/Crame5MT.jpeg" alt="5-Metric-Ton Crane" />
              <div className="gallery-item-title">5 MT Heavy Overhead Crane</div>
            </div>
            <div className="gallery-item">
              <img src="/PhotoGallery/RatioMeter.jpeg" alt="Ratio Meter" />
              <div className="gallery-item-title">Digital Turns Ratio Meter</div>
            </div>
            <div className="gallery-item">
              <img src="/PhotoGallery/Meggar.jpeg" alt="Megger Insulation Tester" />
              <div className="gallery-item-title">Digital Megger & Resistance Meter</div>
            </div>
            <div className="gallery-item">
              <img src="/PhotoGallery/Oven.jpeg" alt="Industrial Baking Oven" />
              <div className="gallery-item-title">Coil Baking & Dehydration Oven</div>
            </div>
            <div className="gallery-item">
              <img src="/PhotoGallery/WeldingMachine.jpeg" alt="Tank Welding Setup" />
              <div className="gallery-item-title">Precision Tank Welding & Fabrication</div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="landing-section" id="about">
        <div className="landing-container">
          <div className="section-head">
            <span className="eyebrow">About Company</span>
            <h2>Committed to Electrical Engineering Standards</h2>
            <p>
              D.S. Transformers is an established electrical contracting firm based in Mallapur Industrial Area, Hyderabad. We provide end-to-end electrical maintenance, transformer refurbishment, and statutory inspection compliance for industrial and utility installations.
            </p>
          </div>
        </div>
      </section>

      {showQuotationModal && (
        <div
          className="quote-modal-backdrop"
          onClick={() => setShowQuotationModal(false)}
        >
          <section
            className="quote-modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotationTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="quote-modal-close"
              onClick={() => setShowQuotationModal(false)}
              aria-label="Close quotation form"
            >
              ×
            </button>

            <div className="quote-modal-content">
              <header className="quote-modal-heading">
                <span className="eyebrow">Quotation enquiry</span>
                <h2 id="quotationTitle">Request a Transformer Service Quotation</h2>
                <p>
                  Share your transformer details and service requirement. Our team will review the
                  information and contact you regarding inspection, service requirements and quotation.
                </p>
              </header>

              {quoteSuccess && <div className="quote-feedback quote-feedback-success" role="status">{quoteSuccess}</div>}
              {quoteError && <div className="quote-feedback quote-feedback-error" role="alert">{quoteError}</div>}

              <form onSubmit={handleQuoteSubmit} className="quote-form">
                <section className="quote-form-section">
                  <h3><span>1</span>Customer details</h3>
                  <div className="quote-fields-grid">
                    <div className="quote-field">
                      <label htmlFor="quoteCompany">Company / Organization Name</label>
                      <input id="quoteCompany" type="text" autoComplete="organization" placeholder="ABC Industries" value={quotation.companyName} onChange={(event) => updateQuotation('companyName', event.target.value)} />
                    </div>
                    <div className="quote-field">
                      <label htmlFor="quoteContact">Contact Person</label>
                      <input id="quoteContact" type="text" autoComplete="name" placeholder="Contact person name" value={quotation.contactPerson} onChange={(event) => updateQuotation('contactPerson', event.target.value)} />
                    </div>
                    <div className="quote-field">
                      <label htmlFor="quoteMobile">Mobile Number <span className="quote-required">Required</span></label>
                      <input id="quoteMobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength="10" pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number" placeholder="10-digit mobile number" value={quotation.mobileNumber} onChange={(event) => updateQuotation('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))} required />
                      <small>Enter a valid 10-digit Indian mobile number.</small>
                    </div>
                  </div>
                </section>

                <section className="quote-form-section">
                  <h3><span>2</span>Transformer details</h3>
                  <div className="quote-fields-grid">
                    <div className="quote-field">
                      <label htmlFor="quoteCapacity">Transformer Capacity</label>
                      <select id="quoteCapacity" value={quotation.transformerCapacity} onChange={(event) => updateQuotation('transformerCapacity', event.target.value)}>
                        <option value="">Select capacity</option>
                        <option>25 kVA</option><option>50 kVA</option><option>100 kVA</option>
                        <option>160 kVA</option><option>250 kVA</option><option>315 kVA</option>
                        <option>500 kVA</option><option>630 kVA</option><option>1000 kVA</option>
                        <option>1250 kVA</option><option>1600 kVA</option><option>Other</option><option>Not sure</option>
                      </select>
                    </div>
                    <div className="quote-field">
                      <label htmlFor="quoteMake">Transformer Make</label>
                      <input id="quoteMake" type="text" placeholder="e.g. ABB, Siemens" value={quotation.transformerMake} onChange={(event) => updateQuotation('transformerMake', event.target.value)} />
                    </div>
                  </div>
                </section>

                <section className="quote-form-section">
                  <h3><span>3</span>Services required</h3>
                  <p className="quote-form-hint">Select all services that apply.</p>
                  <div className="quote-services-grid" role="group" aria-label="Select required services">
                    {[
                      'Transformer Breakdown Repair',
                      'Transformer Inspection',
                      'Sick Transformer Repair / Restoration',
                      'Transformer Coil Rewinding',
                      'Transformer Oil Filtration',
                      'Oil Leakage Rectification',
                      'Gasket Replacement',
                      'Annual Maintenance',
                      'Preventive Maintenance',
                      'Transformer Servicing',
                      'Other'
                    ].map((service) => (
                      <label className={`quote-service-option${quotation.servicesRequired.includes(service) ? ' is-selected' : ''}`} key={service}>
                        <input type="checkbox" checked={quotation.servicesRequired.includes(service)} onChange={() => toggleQuotationService(service)} />
                        <span>{service}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="quote-form-section">
                  <h3><span>4</span>Problem and urgency</h3>
                  <div className="quote-fields-grid quote-fields-single">
                    <div className="quote-field">
                      <label htmlFor="quoteProblem">Describe the Problem</label>
                      <textarea id="quoteProblem" rows="4" placeholder="Describe the issue or service you need..." value={quotation.problemDescription} onChange={(event) => updateQuotation('problemDescription', event.target.value)} />
                    </div>
                    <div className="quote-field">
                      <label htmlFor="quoteStatus">Current Transformer Status</label>
                      <select id="quoteStatus" value={quotation.transformerStatus} onChange={(event) => updateQuotation('transformerStatus', event.target.value)}>
                        <option value="">Select status</option>
                        <option>Working normally</option><option>Working with an issue</option>
                        <option>Partially working</option><option>Not working / breakdown</option>
                        <option>Under inspection</option><option>Not sure</option>
                      </select>
                    </div>
                    <div className="quote-field">
                      <label htmlFor="quotePriority">How soon do you need assistance?</label>
                      <select id="quotePriority" value={quotation.servicePriority} onChange={(event) => updateQuotation('servicePriority', event.target.value)}>
                        <option value="">Select priority</option>
                        <option>Emergency / Breakdown</option><option>As soon as possible</option>
                        <option>Within 1 week</option><option>Planned maintenance</option>
                        <option>Just requesting a quotation</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="quote-form-section">
                  <h3><span>5</span>Photos and files</h3>
                  <div className="quote-field">
                    <label htmlFor="quotePhotos">Upload Transformer Photos</label>
                    <input id="quotePhotos" type="file" accept="image/*" multiple ref={quotationPhotoInput} onChange={handleQuotationPhotosChange} />
                    <small>Upload up to 5 transformer photos. Each image must be 2 MB or smaller.</small>
                    {quotationPhotos.length > 0 && <small className="quote-file-list">{quotationPhotos.map((photo) => photo.name).join(', ')}</small>}
                  </div>
                </section>

                <div className="quote-form-actions">
                  <button type="submit" disabled={quoteLoading} className="landing-btn btn-primary">
                    {quoteLoading ? 'Submitting request...' : 'Submit Quotation Request'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* Footer */}
      <footer className="landing-footer" id="contact">
        <div className="landing-container">
          <div className="footer-grid">
            <div className="footer-col">
              <h4>D.S. TRANSFORMERS</h4>
              <p>
                Authorised Electrical Contractor & Transformer Repair Workshop. Providing industrial transformer repair, oil filtration, and coil rewinding services across Telangana.
              </p>
              <p>📍 Industrial Area, Mallapur, Hyderabad, Telangana 500076</p>
            </div>

            <div className="footer-col">
              <h4>Services</h4>
              <a href="#services">Breakdown Repair</a>
              <a href="#services">Coil Rewinding</a>
              <a href="#services">Oil Filtration</a>
              <a href="#services">Gasket Replacement</a>
              <a href="#services">Testing & Diagnostics</a>
            </div>

            <div className="footer-col">
              <h4>Quick Links</h4>
              <a href="#why-us">Why Choose Us</a>
              <a href="#machinery">Machinery & Facility</a>
              <a href="#quotation-form" onClick={openQuotationModal}>Request Quotation</a>
              <a href="https://wa.me/919949396530" target="_blank" rel="noreferrer">WhatsApp Chat</a>
            </div>

            <div className="footer-col">
              <h4>Operations Portal</h4>
              <p>Authorized personnel and staff management access:</p>
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="landing-btn btn-admin-login"
                style={{ marginTop: '0.5rem', width: '100%' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Admin Login</span>
              </button>
            </div>
          </div>

          <div className="footer-bottom">
            © {new Date().getFullYear()} D.S. Transformers. All rights reserved. | VSTMS Enterprise Architecture
          </div>
        </div>
      </footer>

      {/* ========================================= */}
      {/* HIGH-END PROFESSIONAL ADMIN LOGIN MODAL  */}
      {/* ========================================= */}
      {showLoginModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowLoginModal(false)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setShowLoginModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
              <div className="admin-modal-icon-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h3 className="admin-modal-title">VSTMS Admin Portal</h3>
              <p className="admin-modal-subtitle">Vendor Service Transformer Management System</p>
            </div>

            <div className="admin-modal-body">
              <div className="admin-credential-hint">
                <span>Default Credentials:</span>
                <strong>Username: admin | Password: admin</strong>
              </div>

              {loginError && (
                <div className="admin-error-box">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit}>
                <div className="form-field" style={{ marginBottom: '1.2rem' }}>
                  <label>Admin Username</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="admin"
                  />
                </div>

                <div className="form-field" style={{ marginBottom: '1.2rem' }}>
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="admin-submit-btn"
                >
                  {loginLoading ? 'Authenticating...' : 'Sign In to Dashboard →'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
