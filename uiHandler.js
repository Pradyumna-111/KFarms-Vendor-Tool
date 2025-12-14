/* uiHandler.js
   responsibilities:
   - DOM rendering and event bindings
   - renderVendorTable(filteredList?)
   - setupSearchAndFilters(), setupSorting()
   - add/edit/delete flows, modals, compare, bulk actions
   - main() initialization binds DOM events
*/

const uiHandler = (function () {
  /* Helper: small Toast */
  function showToast(message, type='info') {
    const alertsBox = document.getElementById('alertsBox');
    const el = document.createElement('div');
    el.className = 'alert';
    el.textContent = message;
    alertsBox.appendChild(el);
    setTimeout(()=> el.remove(), 4000);
  }

  /* Render risk badge helper */
  function renderRiskBadge(risk) {
    const span = document.createElement('span');
    span.className = 'badge ' + (risk === 'low' ? 'risk-low' : (risk === 'medium' ? 'risk-medium' : 'risk-high'));
    span.textContent = risk;
    return span;
  }

  /* render compliance cells: ✓ or — for gst/license/agreement as small inline spans */
  function renderComplianceCells(vendor) {
    const fields = ['gst','license','agreement'];
    return fields.map(f => (vendor[f] ? '✓' : '—')).join(' ');
  }

  /* render status badge */
  function renderStatusBadge(status) {
    const span = document.createElement('span');
    span.className = 'badge ' + (status === 'active' ? 'status-active' : (status === 'inactive' ? 'status-inactive' : 'status-blacklisted'));
    span.textContent = status;
    return span;
  }

  /* render contract badge */
  function renderContractBadge(status, daysLeft) {
    const span = document.createElement('span');
    if (status === 'expired') {
      span.className = 'badge';
      span.style.background = '#fff5f5'; span.style.color = '#7f1d1d';
      span.textContent = `Expired ${Math.abs(daysLeft)}d ago`;
    } else if (status === 'expiringSoon') {
      span.className = 'badge';
      span.style.background = '#fff7ed'; span.style.color = '#92400e';
      span.textContent = `Expiring in ${daysLeft}d`;
    } else {
      span.className = 'badge';
      span.style.background = '#ecfdf5'; span.style.color = '#065f46';
      span.textContent = `Valid (${daysLeft}d)`;
    }
    return span;
  }

  /* renderVendorTable (optional list param for filtered/sorted data) */
  function renderVendorTable(list) {
    const tbody = document.getElementById('vendorTableBody');
    const vendors = Array.isArray(list) ? list : vendorManager.loadVendors();
    if (!vendors || vendors.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" class="flex-center">No vendors found</td></tr>`;
      return;
    }

    // Build rows via HTML string for simpler and faster insert (single innerHTML op)
    // Tradeoff: innerHTML is fast but less safe for untrusted content — we sanitize by stringifying basic fields.
    const rows = vendors.map(v => {
      const safe = (val)=> val===undefined || val===null ? '' : String(val).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const stars = '★'.repeat(Math.max(0, Math.min(5, Number(v.rating)||0)));
      const perf = (Number(v.performanceScore)||0).toFixed(2);
      const risk = vendorManager.computeRiskLevel(v);
      const compliance = renderComplianceCells(v).replace(/</g,'&lt;');
      const contractInfo = vendorManager.checkContractExpiry(v);
      const contractEnd = v.contractEnd ? safe(v.contractEnd) : '';
      return `<tr>
        <td><input type="checkbox" class="rowCheckbox" data-id="${safe(v.id)}" aria-label="Select ${safe(v.name)}" /></td>
        <td>${safe(v.name)}</td>
        <td>${safe(v.category)}</td>
        <td>${safe(v.phone)}</td>
        <td>${safe(v.email)}</td>
        <td>${safe(v.price)}</td>
        <td aria-label="rating">${stars}</td>
        <td>${perf}</td>
        <td>${safe(risk)}</td>
        <td>${compliance}</td>
        <td>${contractEnd}</td>
        <td>${safe(v.status)}</td>
        <td>
          <button class="btn" data-action="edit" data-id="${safe(v.id)}" aria-label="Edit ${safe(v.name)}">Edit</button>
          <button class="btn destructive" data-action="delete" data-id="${safe(v.id)}" aria-label="Delete ${safe(v.name)}">Delete</button>
        </td>
      </tr>`;
    }).join('\n');
    tbody.innerHTML = rows;
    // wire up row checkboxes and action buttons via event delegation (outside)
    updateBulkControlsState();
  }

  /* bulk control helper */
  function updateBulkControlsState() {
    const selected = document.querySelectorAll('.rowCheckbox:checked').length;
    document.getElementById('bulkDeleteBtn').disabled = selected === 0;
    const compareBtn = document.getElementById('compareBtn');
    compareBtn.disabled = selected === 0;
  }

  /* Add Vendor handler - robust validation and upsert */
  function handleAddVendorFormSubmit(evt) {
    evt.preventDefault();
    const form = evt.target;
    const get = id => (form.querySelector(`#${id}`) || form.elements[id])?.value;
    // simple getters for fields
    const raw = {
      name: (get('name') || '').trim(),
      category: (get('category') || '').trim(),
      phone: (get('phone') || '').trim(),
      email: (get('email') || '').trim(),
      price: get('price') === '' ? 0 : Number(get('price')),
      rating: get('rating') === '' ? 0 : Number(get('rating')),
      status: get('status') || 'active',
      gst: !!form.querySelector('#gst')?.checked,
      license: !!form.querySelector('#license')?.checked,
      agreement: !!form.querySelector('#agreement')?.checked,
      contractStart: form.querySelector('#contractStart')?.value || '',
      contractEnd: form.querySelector('#contractEnd')?.value || '',
      notes: form.querySelector('#notes')?.value || ''
    };

    // Validation
    const errors = [];
    if (!raw.name) errors.push('Name is required');
    if (!raw.category) errors.push('Category is required');
    if (!raw.email) errors.push('Email is required');
    if (raw.phone) {
      const digits = raw.phone.replace(/\D/g,'');
      if (digits.length < 10 || digits.length > 15) errors.push('Phone must be 10–15 digits');
    }
    if (raw.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email)) errors.push('Email format invalid');
    if (raw.price && !(Number(raw.price) > 0)) errors.push('Price must be a positive number');
    if (raw.rating && !(Number.isInteger(Number(raw.rating)) && raw.rating >=1 && raw.rating <=5)) errors.push('Rating must be integer 1–5');
    if (raw.contractStart && raw.contractEnd && new Date(raw.contractStart) > new Date(raw.contractEnd)) errors.push('Contract start must be before contract end');

    if (errors.length) {
      showToast('Validation: ' + errors.join('; '));
      return;
    }

    // Build vendor object
    const vendor = {
      id: `v-${Date.now()}`,
      name: raw.name,
      category: raw.category,
      phone: raw.phone,
      email: raw.email,
      price: Number(raw.price) || 0,
      rating: Number(raw.rating) || 0,
      status: raw.status,
      gst: !!raw.gst,
      license: !!raw.license,
      agreement: !!raw.agreement,
      contractStart: raw.contractStart,
      contractEnd: raw.contractEnd,
      notes: raw.notes
    };
    vendor.performanceScore = vendorManager.computePerformanceScore(vendor);
    vendor.riskLevel = vendorManager.computeRiskLevel(vendor);

    // upsert using vendorManager (it merges by email/phone)
    vendorManager.upsertVendor(vendor);

    uiHandler.renderVendorTable();
    form.reset();
    showToast('Vendor saved');
    // TODO: trigger CSV export button if desired
  }

  /* Edit flow: open modal, populate form, submit updates */
  function openEditModalWithVendor(id, openerBtn) {
    const vendors = vendorManager.loadVendors();
    const v = vendors.find(x => x.id === id);
    if (!v) { showToast('Vendor not found'); return; }
    const modal = document.getElementById('editModal');
    // populate fields
    document.getElementById('edit-id').value = v.id;
    document.getElementById('edit-name').value = v.name || '';
    document.getElementById('edit-category').value = v.category || '';
    document.getElementById('edit-phone').value = v.phone || '';
    document.getElementById('edit-email').value = v.email || '';
    document.getElementById('edit-price').value = v.price || '';
    document.getElementById('edit-rating').value = v.rating || '';
    document.getElementById('edit-status').value = v.status || 'active';
    document.getElementById('edit-gst').checked = !!v.gst;
    document.getElementById('edit-license').checked = !!v.license;
    document.getElementById('edit-agreement').checked = !!v.agreement;
    document.getElementById('edit-contractStart').value = v.contractStart || '';
    document.getElementById('edit-contractEnd').value = v.contractEnd || '';
    document.getElementById('edit-notes').value = v.notes || '';

    // open modal
    openModal(modal);
    // focus first input
    setTimeout(()=> document.getElementById('edit-name').focus(), 50);
    // store opener to restore focus on close
    modal.dataset.openerId = openerBtn ? openerBtn.id : '';
  }

  function handleEditFormSubmit(evt) {
    evt.preventDefault();
    const form = evt.target;
    const id = document.getElementById('edit-id').value;
    const updated = {
      id,
      name: document.getElementById('edit-name').value.trim(),
      category: document.getElementById('edit-category').value.trim(),
      phone: document.getElementById('edit-phone').value.trim(),
      email: document.getElementById('edit-email').value.trim(),
      price: document.getElementById('edit-price').value === '' ? 0 : Number(document.getElementById('edit-price').value),
      rating: document.getElementById('edit-rating').value === '' ? 0 : Number(document.getElementById('edit-rating').value),
      status: document.getElementById('edit-status').value,
      gst: !!document.getElementById('edit-gst').checked,
      license: !!document.getElementById('edit-license').checked,
      agreement: !!document.getElementById('edit-agreement').checked,
      contractStart: document.getElementById('edit-contractStart').value || '',
      contractEnd: document.getElementById('edit-contractEnd').value || '',
      notes: document.getElementById('edit-notes').value || ''
    };

    // validation (same rules as Add)
    const errors = [];
    if (!updated.name) errors.push('Name required');
    if (!updated.category) errors.push('Category required');
    if (!updated.email) errors.push('Email required');
    if (updated.phone) {
      const digits = updated.phone.replace(/\D/g,'');
      if (digits.length < 10 || digits.length > 15) errors.push('Phone must be 10–15 digits');
    }
    if (updated.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.email)) errors.push('Email format invalid');
    if (updated.price && !(Number(updated.price) > 0)) errors.push('Price must be positive');
    if (updated.rating && !(Number.isInteger(Number(updated.rating)) && updated.rating>=1 && updated.rating<=5)) errors.push('Rating must be integer 1–5');
    if (updated.contractStart && updated.contractEnd && new Date(updated.contractStart) > new Date(updated.contractEnd)) errors.push('Contract start must be before contract end');

    if (errors.length) { showToast('Validation: ' + errors.join('; ')); return; }

    // recompute fields
    updated.performanceScore = vendorManager.computePerformanceScore(updated);
    updated.riskLevel = vendorManager.computeRiskLevel(updated);

    // save
    vendorManager.upsertVendor(updated);
    renderVendorTable();
    // close modal
    closeModal(document.getElementById('editModal'));
    showToast('Vendor updated');
  }

  /* Delete flow */
  let _pendingDeleteId = null;
  function openDeleteConfirm(id) {
    _pendingDeleteId = id;
    const modal = document.getElementById('confirmDeleteModal');
    const vendor = vendorManager.loadVendors().find(v => v.id === id);
    document.getElementById('confirmDeleteText').textContent = `Delete vendor "${vendor ? vendor.name : id}"? This cannot be undone.`;
    openModal(modal);
    document.getElementById('confirmDeleteBtn').focus();
  }

  async function confirmDelete() {
    if (!_pendingDeleteId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    try {
      vendorManager.deleteVendorById(_pendingDeleteId);
      renderVendorTable();
      showToast('Vendor deleted');
    } finally {
      btn.disabled = false;
      _pendingDeleteId = null;
      closeModal(document.getElementById('confirmDeleteModal'));
    }
  }

  /* Modal helpers */
  function openModal(modalEl) {
    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden','false');
  }
  function closeModal(modalEl) {
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden','true');
    // restore focus if opener saved
    const openerId = modalEl.dataset.openerId;
    if (openerId) {
      const opener = document.getElementById(openerId);
      if (opener) opener.focus();
    }
  }

  /* Setup event delegation for table actions */
  function tableEventDelegation(e) {
    const target = e.target;
    const action = target.dataset.action;
    if (action === 'edit') {
      openEditModalWithVendor(target.dataset.id, target);
      return;
    }
    if (action === 'delete') {
      openDeleteConfirm(target.dataset.id);
      return;
    }
    // checkbox toggles
    if (target.classList.contains('rowCheckbox')) {
      updateBulkControlsState();
      // enforce max 2 selection for compare
      const checked = document.querySelectorAll('.rowCheckbox:checked');
      if (checked.length > 2) {
        // uncheck last clicked (simple approach)
        target.checked = false;
        showToast('Compare supports up to 2 vendors. Uncheck one to select this.');
        updateBulkControlsState();
      }
    }
  }

  /* selectAll */
  function setupSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
    selectAll.addEventListener('change', (e) => {
      const checked = !!e.target.checked;
      document.querySelectorAll('.rowCheckbox').forEach(cb => cb.checked = checked);
      updateBulkControlsState();
    });
  }

  /* bulk delete */
  function handleBulkDelete() {
    const checked = Array.from(document.querySelectorAll('.rowCheckbox:checked')).map(cb => cb.dataset.id);
    if (!checked.length) return;
    // simple confirm
    if (!confirm(`Delete ${checked.length} vendors?`)) return;
    for (const id of checked) vendorManager.deleteVendorById(id);
    renderVendorTable();
    showToast('Selected vendors deleted');
  }

  /* search and filters (debounced) */
  function setupSearchAndFilters() {
    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');
    const filterStatus = document.getElementById('filterStatus');
    const filterRating = document.getElementById('filterRating');
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    // populate category options from vendors
    function populateCategories() {
      const vendors = vendorManager.loadVendors();
      const cats = Array.from(new Set(vendors.map(v => v.category).filter(Boolean)));
      filterCategory.innerHTML = `<option value="">Any</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    function applyFilters() {
      let vendors = vendorManager.loadVendors();
      const q = (searchInput.value || '').trim().toLowerCase();
      if (q) vendors = vendors.filter(v => (v.name||'').toLowerCase().includes(q) || (v.email||'').toLowerCase().includes(q));
      const cat = filterCategory.value;
      if (cat) vendors = vendors.filter(v => v.category === cat);
      const status = filterStatus.value;
      if (status) vendors = vendors.filter(v => v.status === status);
      const rating = Number(filterRating.value) || 0;
      if (rating) vendors = vendors.filter(v => Number(v.rating || 0) >= rating);
      const min = Number(priceMin.value); const max = Number(priceMax.value);
      if (!isNaN(min) && min !== 0) vendors = vendors.filter(v => Number(v.price||0) >= min);
      if (!isNaN(max) && max !== 0) vendors = vendors.filter(v => Number(v.price||0) <= max);
      // apply sorting if selected
      const sortBy = document.getElementById('sortBy').value;
      const sorted = sortVendors(vendors, sortBy);
      renderVendorTable(sorted);
    }

    // debouncer
    let tid = null;
    searchInput.addEventListener('input', () => { clearTimeout(tid); tid = setTimeout(applyFilters, 300); });
    ['change','input'].forEach(ev => {
      filterCategory.addEventListener(ev, applyFilters);
      filterStatus.addEventListener(ev, applyFilters);
      filterRating.addEventListener(ev, applyFilters);
      priceMin.addEventListener(ev, applyFilters);
      priceMax.addEventListener(ev, applyFilters);
    });

    clearFiltersBtn.addEventListener('click', () => {
      searchInput.value = '';
      filterCategory.value = '';
      filterStatus.value = '';
      filterRating.value = '';
      priceMin.value = '';
      priceMax.value = '';
      document.getElementById('sortBy').value = '';
      renderVendorTable();
      populateCategories();
    });

    // populate categories initially
    populateCategories();
  }

  /* sorting helpers */
  function sortVendors(vendors, sortKey) {
    if (!sortKey) return vendors;
    const arr = vendors.slice(); // copy
    const num = (x) => {
      if (x === undefined || x === null || x === '') return 0;
      return Number(x);
    };
    const cmp = (a,b) => {
      if (a === b) return 0;
      return a > b ? 1 : -1;
    };
    switch (sortKey) {
      case 'priceAsc': arr.sort((a,b)=> cmp(num(a.price), num(b.price))); break;
      case 'priceDesc': arr.sort((a,b)=> cmp(num(b.price), num(a.price))); break;
      case 'ratingAsc': arr.sort((a,b)=> cmp(num(a.rating), num(b.rating))); break;
      case 'ratingDesc': arr.sort((a,b)=> cmp(num(b.rating), num(a.rating))); break;
      case 'scoreAsc': arr.sort((a,b)=> cmp(num(a.performanceScore), num(b.performanceScore))); break;
      case 'scoreDesc': arr.sort((a,b)=> cmp(num(b.performanceScore), num(a.performanceScore))); break;
      default: break;
    }
    return arr;
  }

  function setupSorting() {
    document.getElementById('sortBy').addEventListener('change', () => {
      // use current filters
      const event = new Event('input'); // trigger existing filter handler by dispatching input on search
      document.getElementById('searchInput').dispatchEvent(event);
    });
  }

  /* compare feature: select up to 2 and open modal */
  function enforceMaxSelection() {
    const checkboxes = document.querySelectorAll('.rowCheckbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = document.querySelectorAll('.rowCheckbox:checked');
        if (checked.length > 2) {
          cb.checked = false;
          showToast('Max 2 vendors can be compared at once');
        }
        updateBulkControlsState();
      });
    });
  }

  function handleCompare() {
    const ids = Array.from(document.querySelectorAll('.rowCheckbox:checked')).map(cb => cb.dataset.id);
    if (ids.length < 2) { showToast('Select two vendors to compare'); return; }
    const vendors = vendorManager.loadVendors();
    const a = vendors.find(v=>v.id===ids[0]); const b = vendors.find(v=>v.id===ids[1]);
    if (!a || !b) { showToast('Comparison error'); return; }
    renderComparisonModal(a,b);
  }

  function renderComparisonModal(a,b) {
    const modal = document.getElementById('compareModal');
    const content = document.getElementById('compareContent');
    function panel(v) {
      return `<div>
        <h4>${escapeHtml(v.name)}</h4>
        <p><strong>Category:</strong> ${escapeHtml(v.category)}</p>
        <p><strong>Price:</strong> ${escapeHtml(v.price)}</p>
        <p><strong>Rating:</strong> ${escapeHtml(v.rating)}</p>
        <p><strong>Score:</strong> ${escapeHtml(v.performanceScore)}</p>
        <p><strong>Risk:</strong> ${escapeHtml(v.riskLevel)}</p>
        <p><strong>Status:</strong> ${escapeHtml(v.status)}</p>
        <p><strong>Compliance:</strong> ${renderComplianceCells(v)}</p>
        <p><strong>Contract End:</strong> ${escapeHtml(v.contractEnd || '')}</p>
      </div>`;
    }
    content.innerHTML = panel(a) + panel(b);
    openModal(modal);
  }

  /* Utility escape helper */
  function escapeHtml(s){ if (s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* Contract alerts on load */
  function checkAllContractsOnLoad() {
    const vendors = vendorManager.loadVendors();
    const alerts = [];
    for (const v of vendors) {
      const res = vendorManager.checkContractExpiry(v);
      if (res.status === 'expired') alerts.push(`Contract expired: ${v.name} (ended ${Math.abs(res.daysLeft)} days ago)`);
      if (res.status === 'expiringSoon') alerts.push(`Contract expiring soon: ${v.name} (in ${res.daysLeft} days)`);
    }
    const alertsBox = document.getElementById('alertsBox');
    alerts.forEach(a => {
      const el = document.createElement('div');
      el.className = 'alert';
      el.textContent = a;
      alertsBox.appendChild(el);
    });
  }

  /* Wire up events (centralized) */
  function bindEvents() {
    // Add vendor
    document.getElementById('addVendorForm').addEventListener('submit', handleAddVendorFormSubmit);

    // table delegation
    document.getElementById('vendorTable').addEventListener('click', (e)=> {
      // handle button clicks & delegation
      const target = e.target;
      if (target.dataset.action) {
        tableEventDelegation(e);
      }
    });

    // row checkbox delegation (listen to tbody)
    document.getElementById('vendorTableBody').addEventListener('change', (e)=>{
      if (e.target && e.target.classList && e.target.classList.contains('rowCheckbox')) {
        updateBulkControlsState();
      }
    });

    document.getElementById('bulkDeleteBtn').addEventListener('click', handleBulkDelete);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // modal close buttons
    document.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) closeModal(modal);
    }));

    // edit form submit
    document.getElementById('editVendorForm').addEventListener('submit', handleEditFormSubmit);

    // import/export bindings
    document.getElementById('exportCSVBtn').addEventListener('click', () => csvUtils.exportVendorsToCSV(vendorManager.loadVendors()));
    document.getElementById('importCSVInput').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        await csvUtils.importCSV(f);
        renderVendorTable();
        showToast('CSV imported');
        // reset file input
        e.target.value = '';
      } catch (err) {
        showToast('Import failed: ' + err.message);
      }
    });

    // clear all data button (careful)
    document.getElementById('clearDataBtn').addEventListener('click', () => {
      if (!confirm('Clear all vendors? This action cannot be undone.')) return;
      localStorage.removeItem(vendorManager.STORAGE_KEY);
      renderVendorTable();
      showToast('All vendors removed');
    });

    // compare
    document.getElementById('compareBtn').addEventListener('click', handleCompare);

    // generate report
    document.getElementById('generateReportBtn').addEventListener('click', () => {
      const vendors = vendorManager.loadVendors();
      const report = reportGenerator.generateReport(vendors);
      reportGenerator.renderReport(report);
      document.getElementById('exportReportCSVBtn').hidden = false;
    });

    document.getElementById('exportReportCSVBtn').addEventListener('click', () => {
      const vendors = vendorManager.loadVendors();
      const report = reportGenerator.generateReport(vendors);
      reportGenerator.exportReportCSV(report);
    });

    // select all
    setupSelectAll();
  }

  /* main init */
  function main() {
    renderVendorTable();
    bindEvents();
    setupSearchAndFilters();
    setupSorting();
    checkAllContractsOnLoad();
  }

  return {
    renderVendorTable,
    main,
    renderRiskBadge,
    renderStatusBadge
  };
})();

/* auto init on DOMContentLoaded */
document.addEventListener('DOMContentLoaded', () => { uiHandler.main(); });
