/* reportGenerator.js
   responsibilities:
   - computeBestVendor, computeCheapestVendor, computeHighRiskVendors, computeCategorySummary
   - renderReport (text into #reportContainer)
   - exportReportCSV(reportObject)
*/

const reportGenerator = (function () {
  function computeBestVendor(vendors) {
    if (!vendors || vendors.length===0) return null;
    return vendors.reduce((best, v) => (Number(v.performanceScore || 0) > Number(best.performanceScore || 0) ? v : best), vendors[0]);
  }
  function computeCheapestVendor(vendors) {
    if (!vendors || vendors.length===0) return null;
    return vendors.reduce((best, v) => (Number(v.price || Infinity) < Number(best.price || Infinity) ? v : best), vendors[0]);
  }
  function computeHighRiskVendors(vendors) {
    return (vendors || []).filter(v => vendorManager.computeRiskLevel(v) === 'high');
  }
  function computeCategorySummary(vendors) {
    const map = {};
    for (const v of (vendors||[])) {
      const c = v.category || 'Uncategorized';
      if (!map[c]) map[c] = {count:0, avgRating:0, avgPrice:0, totalRating:0, totalPrice:0};
      map[c].count++;
      map[c].totalRating += Number(v.rating || 0);
      map[c].totalPrice += Number(v.price || 0);
    }
    const out = [];
    for (const k of Object.keys(map)) {
      const t = map[k];
      out.push({ category: k, count: t.count, avgRating: (t.totalRating/t.count)||0, avgPrice: (t.totalPrice/t.count)||0 });
    }
    return out;
  }

  function generateReport(vendors) {
    const best = computeBestVendor(vendors);
    const cheap = computeCheapestVendor(vendors);
    const highRisk = computeHighRiskVendors(vendors);
    const categories = computeCategorySummary(vendors);
    return { generatedAt: new Date().toISOString(), best, cheapest: cheap, highRisk, categories };
  }

  function renderReport(report) {
    const container = document.getElementById('reportContainer');
    container.innerHTML = '';
    const h = document.createElement('div');
    h.innerHTML = `
      <p><strong>Generated:</strong> ${report.generatedAt}</p>
      <h4>Best Vendor (by performance)</h4>
      <p>${report.best ? report.best.name + ' (score: ' + (report.best.performanceScore||'0') + ')' : 'N/A'}</p>
      <h4>Cheapest Vendor</h4>
      <p>${report.cheapest ? report.cheapest.name + ' (price: ' + (report.cheapest.price||'0') + ')' : 'N/A'}</p>
      <h4>High-risk Vendors</h4>
      <ul>${report.highRisk.map(v => `<li>${v.name} (${v.email || v.phone})</li>`).join('') || '<li>None</li>'}</ul>
      <h4>Category Summary</h4>
      <ul>${report.categories.map(c => `<li>${c.category}: ${c.count} vendors, avg rating ${c.avgRating.toFixed(2)}, avg price ${c.avgPrice.toFixed(2)}</li>`).join('')}</ul>
    `;
    container.appendChild(h);
  }

  /* export report as CSV (multi-section simple format) */
  function exportReportCSV(report) {
    const lines = [];
    lines.push(`Generated,${report.generatedAt}`);
    lines.push('');
    lines.push('Best Vendor,Name,Email,Score,Price');
    if (report.best) lines.push(`Best,${escapeCSV(report.best.name)},${escapeCSV(report.best.email)},${report.best.performanceScore},${report.best.price}`);
    lines.push('');
    lines.push('Cheapest Vendor,Name,Email,Price');
    if (report.cheapest) lines.push(`Cheapest,${escapeCSV(report.cheapest.name)},${escapeCSV(report.cheapest.email)},${report.cheapest.price}`);
    lines.push('');
    lines.push('High Risk Vendors,Name,Email,Phone');
    for (const v of report.highRisk) { lines.push(`,${escapeCSV(v.name)},${escapeCSV(v.email)},${escapeCSV(v.phone)}`); }
    lines.push('');
    lines.push('Category Summary,Category,Count,AvgRating,AvgPrice');
    for (const c of report.categories) { lines.push(`,${escapeCSV(c.category)},${c.count},${c.avgRating},${c.avgPrice}`); }

    const csv = lines.join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendor_report.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function escapeCSV(s) {
    if (s === null || s === undefined) return '';
    const str = String(s);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) return `"${str.replace(/"/g,'""')}"`;
    return str;
  }

  return {
    computeBestVendor,
    computeCheapestVendor,
    computeHighRiskVendors,
    computeCategorySummary,
    generateReport,
    renderReport,
    exportReportCSV
  };
})();
