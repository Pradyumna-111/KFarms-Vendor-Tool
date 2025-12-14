/* vendorManager.js
   Responsibilities:
   - manage CRUD on vendor array stored in localStorage ('vendors')
   - computePerformanceScore and computeRiskLevel
   - checkContractExpiry
   Public functions:
   - loadVendors(): Array
   - saveVendors(vendors): void
   - upsertVendor(vendor): vendor (adds or updates by email/phone)
   - deleteVendorById(id): void
   - computePerformanceScore(vendor): Number (2-decimal)
   - computeRiskLevel(vendor): "low"|"medium"|"high"
   - checkContractExpiry(vendor): "expired"|"expiringSoon"|"valid"
*/

const vendorManager = (function () {
  const STORAGE_KEY = 'vendors';

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load vendors:', e);
      return [];
    }
  }

  function _save(vendors) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vendors));
    } catch (e) {
      console.error('Failed to save vendors:', e);
    }
  }

  function loadVendors() { return _load(); }
  function saveVendors(v) { return _save(v); }

  function findVendorIndexByUnique(vendors, vendor) {
    if (!vendor) return -1;
    const email = (vendor.email || '').toLowerCase();
    const phone = (vendor.phone || '').replace(/\D/g, '');
    return vendors.findIndex(v => (v.email && v.email.toLowerCase() === email) || (v.phone && v.phone.replace(/\D/g,'') === phone));
  }

  function upsertVendor(vendor) {
    const vendors = _load();
    // determine unique by email or phone
    const idx = findVendorIndexByUnique(vendors, vendor);
    if (idx >= 0) {
      vendor.id = vendors[idx].id; // preserve id
      vendors[idx] = vendor;
    } else {
      if (!vendor.id) vendor.id = `v-${Date.now()}`;
      vendors.push(vendor);
    }
    _save(vendors);
    return vendor;
  }

  function deleteVendorById(id) {
    const vendors = _load().filter(v => v.id !== id);
    _save(vendors);
  }

  /* computePerformanceScore:
     base = rating * 2
     complianceBonus = (gst ? 0.5 : 0) + (license ? 0.5 : 0) + (agreement ? 0.5 : 0)
     pricePenalty = price * 0.01
     score = base + complianceBonus - pricePenalty
     round to 2 decimals */
  function computePerformanceScore(vendor) {
    const rating = Number(vendor.rating) || 0;
    const price = Number(vendor.price) || 0;
    const gst = !!vendor.gst;
    const license = !!vendor.license;
    const agreement = !!vendor.agreement;
    const base = rating * 2;
    const complianceBonus = (gst ? 0.5 : 0) + (license ? 0.5 : 0) + (agreement ? 0.5 : 0);
    const pricePenalty = price * 0.01;
    const score = base + complianceBonus - pricePenalty;
    return Math.round((score + Number.EPSILON) * 100) / 100;
  }

  /* computeRiskLevel:
     Low Risk: score >= 3
     Medium Risk: 1 <= score < 3
     High Risk: score < 1
  */
  function computeRiskLevel(vendor) {
    const s = Number(vendor.performanceScore);
    if (isNaN(s)) return 'medium';
    if (s >= 3) return 'low';
    if (s >= 1) return 'medium';
    return 'high';
  }

  /* checkContractExpiry:
     returns object: {status:"expired"|"expiringSoon"|"valid", daysLeft: Number}
  */
  function checkContractExpiry(vendor) {
    if (!vendor.contractEnd) return { status: 'valid', daysLeft: Infinity };
    const today = new Date();
    const end = new Date(vendor.contractEnd);
    // zero time-of-day differences by using UTC days difference
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.floor((end.setHours(0,0,0,0) - today.setHours(0,0,0,0)) / msPerDay);
    if (daysLeft < 0) return { status: 'expired', daysLeft };
    if (daysLeft <= 7) return { status: 'expiringSoon', daysLeft };
    return { status: 'valid', daysLeft };
  }

  return {
    loadVendors,
    saveVendors,
    upsertVendor,
    deleteVendorById,
    computePerformanceScore,
    computeRiskLevel,
    checkContractExpiry,
    STORAGE_KEY
  };
})();
