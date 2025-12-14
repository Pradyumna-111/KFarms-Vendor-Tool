/* csvUtils.js
   responsibilities:
   - exportVendorsToCSV(vendorsArray)
   - importCSV(file) -> returns Promise resolving to parsed vendors array and handles merging
   - helper: escapeCSV, parseCSV (simple but handles quoted values)
*/

const csvUtils = (function () {
  // headers we export/import
  const HEADERS = ["id","name","category","phone","email","price","rating","status","gst","license","agreement","performanceScore","riskLevel","contractStart","contractEnd","notes"];

  function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g,'""')}"`;
    }
    return s;
  }

  function exportVendorsToCSV(vendors) {
    const lines = [];
    lines.push(HEADERS.join(','));
    for (const v of vendors) {
      const row = HEADERS.map(h => {
        let val = v[h];
        // booleans -> true/false
        if (typeof val === 'boolean') return String(val);
        return escapeCSV(val);
      });
      lines.push(row.join(','));
    }
    const csv = lines.join('\r\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendors_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* simple CSV parser that handles quoted values and commas inside quotes.
     returns array of objects mapping header->value
  */
  function parseCSVText(text) {
    const rows = [];
    let cur = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nxt = text[i+1];
      if (ch === '"' ) {
        if (inQuotes && nxt === '"') {
          // escaped quote
          cur += '"';
          i++; // skip next
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
        continue;
      }
      if ((ch === '\n' || ch === '\r') && !inQuotes) {
        // handle CRLF and LF
        if (cur !== '' || row.length > 0) {
          row.push(cur);
          rows.push(row);
          row = [];
          cur = '';
        }
        // skip if next is also newline
        continue;
      }
      cur += ch;
    }
    // leftover
    if (cur !== '' || row.length > 0) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  function importCSVFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed reading file'));
      reader.onload = () => {
        try {
          const text = reader.result;
          const rows = parseCSVText(text);
          if (rows.length === 0) return resolve([]);
          const headers = rows[0].map(h => h.trim());
          const parsed = [];
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (row.length === 1 && row[0]==='') continue;
            const obj = {};
            for (let c = 0; c < headers.length; c++) {
              const key = headers[c] || `col${c}`;
              let val = row[c] !== undefined ? row[c].trim() : '';
              // normalize booleans and numbers for known fields
              if (['price','rating','performanceScore'].includes(key)) {
                val = val === '' ? '' : Number(val);
              } else if (['gst','license','agreement'].includes(key)) {
                val = String(val).toLowerCase() === 'true' || String(val) === '1';
              }
              obj[key] = val;
            }
            parsed.push(obj);
          }
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  /* importCSV(file) merges into existing localStorage vendors array using email or phone as unique key */
  async function importCSV(file) {
    const parsed = await importCSVFile(file);
    const existing = vendorManager.loadVendors();
    for (const row of parsed) {
      // normalize keys to match our vendor shape
      const vendor = {
        id: row.id || `v-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        name: row.name || '',
        category: row.category || '',
        phone: row.phone || '',
        email: row.email || '',
        price: row.price || 0,
        rating: row.rating || 0,
        status: row.status || 'active',
        gst: !!row.gst,
        license: !!row.license,
        agreement: !!row.agreement,
        contractStart: row.contractStart || '',
        contractEnd: row.contractEnd || '',
        notes: row.notes || ''
      };
      vendor.performanceScore = vendorManager.computePerformanceScore(vendor);
      vendor.riskLevel = vendorManager.computeRiskLevel(vendor);
      // merge: find by email or phone
      const idx = existing.findIndex(e => (e.email && e.email.toLowerCase() === (vendor.email || '').toLowerCase()) || (e.phone && e.phone.replace(/\D/g,'') === (vendor.phone || '').replace(/\D/g,'')));
      if (idx >= 0) {
        vendor.id = existing[idx].id;
        existing[idx] = vendor;
      } else {
        existing.push(vendor);
      }
    }
    vendorManager.saveVendors(existing);
    return existing;
  }

  return {
    exportVendorsToCSV,
    importCSV,
    HEADERS
  };
})();
