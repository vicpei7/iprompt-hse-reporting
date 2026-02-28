// ============================================================
// app.js — Frontend logic for iPrompt HSE Reporting
// ============================================================

// --- Global state ---
let CONFIG = null;       // loaded from /api/config
let currentProject = null;
let currentMonth = null;
let currentContract = null;
let currentData = null;  // the data for current project+month

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Show today's date in navbar
  const today = new Date();
  document.getElementById('currentDate').textContent = today.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  // Load config from server
  try {
    const res = await fetch('/api/config');
    CONFIG = await res.json();
    renderProjectCards();
  } catch (err) {
    console.error('Failed to load config:', err);
    document.getElementById('app').innerHTML = '<p style="text-align:center;padding:40px;color:red;">Failed to connect to server. Please make sure the server is running.</p>';
  }
});

// ============================================================
// NAVIGATION
// ============================================================

function navigateTo(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show target page
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  // Update breadcrumb
  updateBreadcrumb(pageId);
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateBreadcrumb(pageId) {
  const bc = document.getElementById('breadcrumb');
  let parts = [];

  if (currentProject && pageId !== 'landing') {
    parts.push(CONFIG.projects[currentProject].name);
  }
  if (currentMonth && ['method', 'input', 'upload'].includes(pageId)) {
    const monthObj = CONFIG.months.find(m => m.id === currentMonth);
    parts.push(monthObj ? monthObj.label : currentMonth);
  }
  if (currentContract && ['input', 'upload'].includes(pageId)) {
    const proj = CONFIG.projects[currentProject];
    const c = proj.contracts.find(c => c.id === currentContract);
    parts.push(c ? c.label : currentContract);
  }

  bc.innerHTML = parts.map((p, i) =>
    (i > 0 ? '<span class="sep">/</span>' : '') + `<span>${p}</span>`
  ).join('');
}

// ============================================================
// LANDING PAGE — Project Cards
// ============================================================

function renderProjectCards() {
  const container = document.getElementById('projectCards');
  const projects = CONFIG.projects;
  const icons = {
    'sapih-tiram-wangsa': 'fa-oil-well',
    'chenda': 'fa-industry',
    'sirung': 'fa-mountain'
  };
  const colors = {
    'sapih-tiram-wangsa': '#1a5276',
    'chenda': '#117a65',
    'sirung': '#7d3c98'
  };

  container.innerHTML = Object.values(projects).map(proj => `
    <div class="project-card" onclick="selectProject('${proj.id}')" style="border-top: 4px solid ${colors[proj.id] || '#333'}">
      <div class="card-icon" style="background: ${colors[proj.id] || '#333'}">
        <i class="fas ${icons[proj.id] || 'fa-building'}"></i>
      </div>
      <h2>${proj.name}</h2>
      <p class="card-desc">${proj.description}</p>
      <div class="card-contracts">
        ${proj.contracts.map(c => `<span class="contract-tag">${c.label}</span>`).join('')}
      </div>
      <span class="card-arrow"><i class="fas fa-chevron-right"></i></span>
    </div>
  `).join('');
}

function selectProject(projectId) {
  currentProject = projectId;
  currentMonth = null;
  currentContract = null;

  const proj = CONFIG.projects[projectId];
  document.getElementById('monthsTitle').textContent = proj.name + ' — Select Month';

  renderMonthGrid();
  navigateTo('months');
}

// ============================================================
// MONTH SELECTION PAGE
// ============================================================

async function renderMonthGrid() {
  const grid = document.getElementById('monthGrid');

  // Check which months have data
  const monthStatuses = await Promise.all(
    CONFIG.months.map(async m => {
      try {
        const res = await fetch(`/api/data/${currentProject}/${m.id}`);
        const data = await res.json();
        // Check if any values exist
        let hasData = false;
        if (data.table1) {
          Object.values(data.table1).forEach(ind => {
            Object.values(ind).forEach(val => {
              if (val !== null && val !== undefined && val !== '') hasData = true;
            });
          });
        }
        return { ...m, hasData };
      } catch {
        return { ...m, hasData: false };
      }
    })
  );

  grid.innerHTML = monthStatuses.map(m => `
    <div class="month-btn ${m.hasData ? 'has-data' : ''}" onclick="selectMonth('${m.id}')">
      ${m.label}
      <span class="month-status">${m.hasData ? '✓ Has data' : 'No data yet'}</span>
    </div>
  `).join('');
}

function selectMonth(monthId) {
  currentMonth = monthId;
  currentContract = null;

  const proj = CONFIG.projects[currentProject];
  const monthLabel = CONFIG.months.find(m => m.id === monthId)?.label || monthId;

  document.getElementById('methodTitle').textContent = 'How would you like to provide data?';
  document.getElementById('methodSubtitle').textContent = `${proj.name} — ${monthLabel}`;

  // Populate contract dropdown
  const select = document.getElementById('contractSelect');
  select.innerHTML = '<option value="">-- Select your contract --</option>' +
    proj.contracts.map(c => `<option value="${c.id}">${c.label}</option>`).join('');

  navigateTo('method');
}

function onContractChange() {
  currentContract = document.getElementById('contractSelect').value;
}

// ============================================================
// CUMULATIVE VIEW
// ============================================================

async function loadCumulative() {
  const proj = CONFIG.projects[currentProject];
  document.getElementById('cumulativeTitle').textContent = `${proj.name} — Cumulative 2026`;

  try {
    const res = await fetch(`/api/cumulative/${currentProject}`);
    const data = await res.json();
    renderCumulativeTable1(data.table1, proj.contracts);
    renderCumulativeTable2(data.table2, proj.contracts);
    navigateTo('cumulative');
  } catch (err) {
    showToast('Failed to load cumulative data');
  }
}

function renderCumulativeTable1(table1Data, contracts) {
  const table = document.getElementById('cumulativeTable1');
  const headers = contracts.map(c => `<th>${c.label}</th>`).join('');

  // Pre-calculate totals for Manhours and LTI (needed for LTIF formula)
  const manhoursByContract = {};
  const ltiByContract = {};
  let totalManhours = 0;
  let totalLTI = 0;
  contracts.forEach(c => {
    const mh = parseFloat(table1Data['Manhours']?.[c.id]) || 0;
    const lti = parseFloat(table1Data['Loss Time Injury (LTI)']?.[c.id]) || 0;
    manhoursByContract[c.id] = mh;
    ltiByContract[c.id] = lti;
    totalManhours += mh;
    totalLTI += lti;
  });

  let rows = '';
  CONFIG.table1Indicators.forEach(ind => {
    const isLTIF = ind === 'Loss Time Injury Frequency (LTIF)';

    let total = 0;
    const cells = contracts.map(c => {
      if (isLTIF) {
        // LTIF = (LTI x 1,000,000) / Manhours
        const mh = manhoursByContract[c.id];
        const lti = ltiByContract[c.id];
        const ltif = (mh > 0) ? (lti * 1000000) / mh : null;
        return `<td>${ltif !== null ? formatNumber(ltif) : '-'}</td>`;
      } else {
        const val = table1Data[ind]?.[c.id];
        if (val !== null && val !== undefined) total += parseFloat(val) || 0;
        return `<td>${val !== null && val !== undefined ? formatNumber(val) : '-'}</td>`;
      }
    }).join('');

    // Calculate total column
    let totalDisplay;
    if (isLTIF) {
      // LTIF total = (Total LTI x 1,000,000) / Total Manhours
      totalDisplay = (totalManhours > 0) ? formatNumber((totalLTI * 1000000) / totalManhours) : '-';
    } else {
      totalDisplay = total ? formatNumber(total) : '-';
    }

    rows += `<tr>
      <td>${ind}</td>
      ${cells}
      <td class="total-col">${totalDisplay}</td>
    </tr>`;
  });

  table.innerHTML = `
    <thead><tr>
      <th>Indicator</th>
      ${headers}
      <th>Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  `;
}

function renderCumulativeTable2(table2Data, contracts) {
  const table = document.getElementById('cumulativeTable2');

  // Two-row header
  let headerRow1 = '<th rowspan="2">Indicator</th>';
  let headerRow2 = '';
  contracts.forEach(c => {
    headerRow1 += `<th colspan="2" class="contract-group">${c.label}</th>`;
    headerRow2 += `<th class="sub-header">Planned</th><th class="sub-header">Actual</th>`;
  });
  headerRow1 += '<th colspan="2" class="contract-group">Total</th>';
  headerRow2 += '<th class="sub-header">Planned</th><th class="sub-header">Actual</th>';

  let rows = '';
  CONFIG.table2Indicators.forEach(ind => {
    let totalPlanned = 0, totalActual = 0;
    const cells = contracts.map(c => {
      const entry = table2Data[ind]?.[c.id] || {};
      const p = entry.planned;
      const a = entry.actual;
      if (p !== null && p !== undefined) totalPlanned += parseFloat(p) || 0;
      if (a !== null && a !== undefined) totalActual += parseFloat(a) || 0;
      return `<td>${p !== null && p !== undefined ? formatNumber(p) : '-'}</td>
              <td>${a !== null && a !== undefined ? formatNumber(a) : '-'}</td>`;
    }).join('');

    rows += `<tr>
      <td>${ind}</td>
      ${cells}
      <td class="total-col">${totalPlanned ? formatNumber(totalPlanned) : '-'}</td>
      <td class="total-col">${totalActual ? formatNumber(totalActual) : '-'}</td>
    </tr>`;
  });

  table.innerHTML = `
    <thead>
      <tr>${headerRow1}</tr>
      <tr>${headerRow2}</tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

// ============================================================
// MANUAL INPUT TABLE
// ============================================================

async function goToManualInput() {
  if (!currentContract) {
    showToast('Please select your contract first');
    return;
  }

  const proj = CONFIG.projects[currentProject];
  const monthLabel = CONFIG.months.find(m => m.id === currentMonth)?.label || currentMonth;
  const contractObj = proj.contracts.find(c => c.id === currentContract);

  document.getElementById('inputTitle').textContent = `${proj.name} — ${monthLabel}`;
  document.getElementById('inputSubtitle').textContent = 'Enter your HSE indicator values below';
  document.getElementById('inputContractBadge').textContent = contractObj.label;

  // Load existing data
  try {
    const res = await fetch(`/api/data/${currentProject}/${currentMonth}`);
    currentData = await res.json();
  } catch {
    currentData = { table1: {}, table2: {} };
  }

  renderInputTable1(proj.contracts);
  renderInputTable2(proj.contracts);
  navigateTo('input');
}

function renderInputTable1(contracts) {
  const table = document.getElementById('table1');
  const headers = contracts.map(c => {
    const isMe = c.id === currentContract;
    return `<th style="${isMe ? 'background: #27ae60;' : ''}">${c.label}${isMe ? ' ★' : ''}</th>`;
  }).join('');

  let rows = '';
  CONFIG.table1Indicators.forEach(ind => {
    const cells = contracts.map(c => {
      const isMe = c.id === currentContract;
      const val = currentData?.table1?.[ind]?.[c.id];
      const displayVal = val !== null && val !== undefined && val !== '' ? val : '';

      if (isMe) {
        return `<td><input type="number" step="any"
          data-table="1" data-indicator="${ind}" data-contract="${c.id}"
          value="${displayVal}"
          placeholder="0"
          onchange="onInputChange(this)"></td>`;
      } else {
        return `<td>${displayVal !== '' ? formatNumber(displayVal) : '<span class="text-muted">-</span>'}</td>`;
      }
    }).join('');

    // Calculate total
    const isLTIF = ind === 'Loss Time Injury Frequency (LTIF)';
    let totalDisplay;

    if (isLTIF) {
      // LTIF = (Total LTI x 1,000,000) / Total Manhours
      let totalMH = 0, totalLTI = 0;
      contracts.forEach(c => {
        const mh = parseFloat(currentData?.table1?.['Manhours']?.[c.id]) || 0;
        const lti = parseFloat(currentData?.table1?.['Loss Time Injury (LTI)']?.[c.id]) || 0;
        totalMH += mh;
        totalLTI += lti;
      });
      totalDisplay = (totalMH > 0) ? formatNumber((totalLTI * 1000000) / totalMH) : '-';
    } else {
      let total = 0;
      contracts.forEach(c => {
        const val = currentData?.table1?.[ind]?.[c.id];
        if (val !== null && val !== undefined && val !== '') total += parseFloat(val) || 0;
      });
      totalDisplay = total ? formatNumber(total) : '-';
    }

    rows += `<tr>
      <td>${ind}</td>
      ${cells}
      <td class="total-col" id="total1-${ind.replace(/[^a-zA-Z0-9]/g, '_')}">${totalDisplay}</td>
    </tr>`;
  });

  table.innerHTML = `
    <thead><tr>
      <th>Indicator</th>
      ${headers}
      <th>Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  `;
}

function renderInputTable2(contracts) {
  const table = document.getElementById('table2');

  let headerRow1 = '<th rowspan="2">Indicator</th>';
  let headerRow2 = '';
  contracts.forEach(c => {
    const isMe = c.id === currentContract;
    headerRow1 += `<th colspan="2" class="contract-group" style="${isMe ? 'background: #27ae60;' : ''}">${c.label}${isMe ? ' ★' : ''}</th>`;
    headerRow2 += `<th class="sub-header" style="${isMe ? 'background: #229954;' : ''}">Planned</th>
                   <th class="sub-header" style="${isMe ? 'background: #229954;' : ''}">Actual</th>`;
  });
  headerRow1 += '<th colspan="2" class="contract-group">Total</th>';
  headerRow2 += '<th class="sub-header">Planned</th><th class="sub-header">Actual</th>';

  let rows = '';
  CONFIG.table2Indicators.forEach(ind => {
    let totalPlanned = 0, totalActual = 0;

    const cells = contracts.map(c => {
      const isMe = c.id === currentContract;
      const entry = currentData?.table2?.[ind]?.[c.id] || {};
      const pVal = entry.planned !== null && entry.planned !== undefined && entry.planned !== '' ? entry.planned : '';
      const aVal = entry.actual !== null && entry.actual !== undefined && entry.actual !== '' ? entry.actual : '';

      if (pVal !== '') totalPlanned += parseFloat(pVal) || 0;
      if (aVal !== '') totalActual += parseFloat(aVal) || 0;

      if (isMe) {
        return `<td>
          <div class="planned-actual-group">
            <div>
              <span class="pa-label">Planned</span>
              <input type="number" step="any"
                data-table="2" data-indicator="${ind}" data-contract="${c.id}" data-field="planned"
                value="${pVal}" placeholder="0"
                onchange="onInputChange(this)">
            </div>
            <div>
              <span class="pa-label">Actual</span>
              <input type="number" step="any"
                data-table="2" data-indicator="${ind}" data-contract="${c.id}" data-field="actual"
                value="${aVal}" placeholder="0"
                onchange="onInputChange(this)">
            </div>
          </div>
        </td>`;
      } else {
        return `<td>
          <div class="planned-actual-group" style="gap:12px;">
            <span>${pVal !== '' ? formatNumber(pVal) : '-'}</span>
            <span>${aVal !== '' ? formatNumber(aVal) : '-'}</span>
          </div>
        </td>`;
      }
    }).join('');

    const indKey = ind.replace(/[^a-zA-Z0-9]/g, '_');
    rows += `<tr>
      <td>${ind}</td>
      ${cells}
      <td class="total-col" id="totalP2-${indKey}">${totalPlanned ? formatNumber(totalPlanned) : '-'}</td>
      <td class="total-col" id="totalA2-${indKey}">${totalActual ? formatNumber(totalActual) : '-'}</td>
    </tr>`;
  });

  table.innerHTML = `
    <thead>
      <tr>${headerRow1}</tr>
      <tr>${headerRow2}</tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function onInputChange(input) {
  // Update local data immediately for total calculation
  const tableNum = input.dataset.table;
  const indicator = input.dataset.indicator;
  const contract = input.dataset.contract;
  const value = input.value !== '' ? parseFloat(input.value) : null;

  if (tableNum === '1') {
    if (!currentData.table1[indicator]) currentData.table1[indicator] = {};
    currentData.table1[indicator][contract] = value;
    updateTotal1(indicator);
  } else {
    const field = input.dataset.field;
    if (!currentData.table2[indicator]) currentData.table2[indicator] = {};
    if (!currentData.table2[indicator][contract]) currentData.table2[indicator][contract] = {};
    currentData.table2[indicator][contract][field] = value;
    updateTotal2(indicator);
  }
}

function updateTotal1(indicator) {
  const contracts = CONFIG.projects[currentProject].contracts;
  const isLTIF = indicator === 'Loss Time Injury Frequency (LTIF)';

  if (isLTIF) {
    // LTIF = (Total LTI x 1,000,000) / Total Manhours
    let totalMH = 0, totalLTI = 0;
    contracts.forEach(c => {
      const mh = parseFloat(currentData?.table1?.['Manhours']?.[c.id]) || 0;
      const lti = parseFloat(currentData?.table1?.['Loss Time Injury (LTI)']?.[c.id]) || 0;
      totalMH += mh;
      totalLTI += lti;
    });
    const key = indicator.replace(/[^a-zA-Z0-9]/g, '_');
    const el = document.getElementById('total1-' + key);
    if (el) el.textContent = (totalMH > 0) ? formatNumber((totalLTI * 1000000) / totalMH) : '-';
  } else {
    let total = 0;
    contracts.forEach(c => {
      const val = currentData?.table1?.[indicator]?.[c.id];
      if (val !== null && val !== undefined && val !== '') total += parseFloat(val) || 0;
    });
    const key = indicator.replace(/[^a-zA-Z0-9]/g, '_');
    const el = document.getElementById('total1-' + key);
    if (el) el.textContent = total ? formatNumber(total) : '-';
  }

  // Also update LTIF total whenever Manhours or LTI changes
  if (indicator === 'Manhours' || indicator === 'Loss Time Injury (LTI)') {
    updateTotal1('Loss Time Injury Frequency (LTIF)');
  }
}

function updateTotal2(indicator) {
  const contracts = CONFIG.projects[currentProject].contracts;
  let totalP = 0, totalA = 0;
  contracts.forEach(c => {
    const entry = currentData?.table2?.[indicator]?.[c.id];
    if (entry) {
      if (entry.planned !== null && entry.planned !== undefined) totalP += parseFloat(entry.planned) || 0;
      if (entry.actual !== null && entry.actual !== undefined) totalA += parseFloat(entry.actual) || 0;
    }
  });
  const key = indicator.replace(/[^a-zA-Z0-9]/g, '_');
  const elP = document.getElementById('totalP2-' + key);
  const elA = document.getElementById('totalA2-' + key);
  if (elP) elP.textContent = totalP ? formatNumber(totalP) : '-';
  if (elA) elA.textContent = totalA ? formatNumber(totalA) : '-';
}

// ============================================================
// SAVE DATA
// ============================================================

async function saveAllData() {
  // Collect all input values
  const payload = { table1: {}, table2: {} };

  document.querySelectorAll('#table1 input[type="number"]').forEach(input => {
    const ind = input.dataset.indicator;
    const con = input.dataset.contract;
    if (!payload.table1[ind]) payload.table1[ind] = {};
    payload.table1[ind][con] = input.value !== '' ? parseFloat(input.value) : null;
  });

  document.querySelectorAll('#table2 input[type="number"]').forEach(input => {
    const ind = input.dataset.indicator;
    const con = input.dataset.contract;
    const field = input.dataset.field;
    if (!payload.table2[ind]) payload.table2[ind] = {};
    if (!payload.table2[ind][con]) payload.table2[ind][con] = {};
    payload.table2[ind][con][field] = input.value !== '' ? parseFloat(input.value) : null;
  });

  try {
    const res = await fetch(`/api/data/${currentProject}/${currentMonth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      currentData = result.data;
      showToast('Data saved successfully!');
    } else {
      showToast('Failed to save. Please try again.');
    }
  } catch (err) {
    showToast('Error saving data. Check your connection.');
  }
}

// ============================================================
// FILE UPLOAD
// ============================================================

function goToUpload() {
  if (!currentContract) {
    showToast('Please select your contract first');
    return;
  }

  const proj = CONFIG.projects[currentProject];
  const monthLabel = CONFIG.months.find(m => m.id === currentMonth)?.label || currentMonth;
  const contractObj = proj.contracts.find(c => c.id === currentContract);

  document.getElementById('uploadTitle').textContent = `Upload HSE Report`;
  document.getElementById('uploadSubtitle').textContent = `${proj.name} — ${monthLabel} — ${contractObj.label}`;

  // Reset upload state
  resetUpload();
  setupUploadHandlers();
  navigateTo('upload');
}

function setupUploadHandlers() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  // Click to browse
  dropZone.onclick = () => fileInput.click();

  // Drag events
  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  };

  dropZone.ondragleave = () => {
    dropZone.classList.remove('dragover');
  };

  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // File input change
  fileInput.onchange = () => {
    if (fileInput.files.length > 0) {
      processUploadedFile(fileInput.files[0]);
    }
  };
}

async function processUploadedFile(file) {
  const dropZone = document.getElementById('dropZone');
  const progress = document.getElementById('uploadProgress');
  const results = document.getElementById('extractedResults');

  // Show progress
  dropZone.style.display = 'none';
  progress.style.display = 'block';
  results.style.display = 'none';

  // Upload to server
  const formData = new FormData();
  formData.append('hsefile', file);
  formData.append('contractId', currentContract);

  try {
    const res = await fetch(`/api/upload/${currentProject}/${currentMonth}`, {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    if (result.success) {
      renderExtractedData(result.extracted);
      progress.style.display = 'none';
      results.style.display = 'block';
      showToast(`Scanned "${result.filename}" — review the extracted values`);
    } else {
      progress.style.display = 'none';
      dropZone.style.display = 'block';
      showToast(result.error || 'Failed to process file');
    }
  } catch (err) {
    progress.style.display = 'none';
    dropZone.style.display = 'block';
    showToast('Error uploading file. Please try again.');
  }
}

function renderExtractedData(extracted) {
  const table1El = document.getElementById('extractedTable1');
  const table2El = document.getElementById('extractedTable2');

  // Table 1
  let rows1 = '';
  CONFIG.table1Indicators.forEach(ind => {
    const val = extracted.table1[ind];
    const found = val !== null && val !== undefined;
    rows1 += `<tr>
      <td>${ind}</td>
      <td>
        <input type="number" step="any"
          class="extracted-input ${found ? 'highlighted' : ''}"
          data-table="1" data-indicator="${ind}" data-contract="${currentContract}"
          value="${found ? val : ''}"
          placeholder="${found ? '' : 'Not found'}">
      </td>
      <td class="text-muted" style="font-size:12px;">${found ? '✓ Found in report' : '✗ Not detected'}</td>
    </tr>`;
  });

  table1El.innerHTML = `
    <thead><tr>
      <th>Indicator</th>
      <th>Value for ${currentContract}</th>
      <th>Status</th>
    </tr></thead>
    <tbody>${rows1}</tbody>
  `;

  // Table 2
  let rows2 = '';
  CONFIG.table2Indicators.forEach(ind => {
    const entry = extracted.table2[ind];
    const foundP = entry?.planned !== null && entry?.planned !== undefined;
    const foundA = entry?.actual !== null && entry?.actual !== undefined;
    rows2 += `<tr>
      <td>${ind}</td>
      <td>
        <div class="planned-actual-group">
          <div>
            <span class="pa-label">Planned</span>
            <input type="number" step="any"
              class="extracted-input ${foundP ? 'highlighted' : ''}"
              data-table="2" data-indicator="${ind}" data-contract="${currentContract}" data-field="planned"
              value="${foundP ? entry.planned : ''}"
              placeholder="${foundP ? '' : 'N/A'}">
          </div>
          <div>
            <span class="pa-label">Actual</span>
            <input type="number" step="any"
              class="extracted-input ${foundA ? 'highlighted' : ''}"
              data-table="2" data-indicator="${ind}" data-contract="${currentContract}" data-field="actual"
              value="${foundA ? entry.actual : ''}"
              placeholder="${foundA ? '' : 'N/A'}">
          </div>
        </div>
      </td>
      <td class="text-muted" style="font-size:12px;">${(foundP || foundA) ? '✓ Found' : '✗ Not detected'}</td>
    </tr>`;
  });

  table2El.innerHTML = `
    <thead><tr>
      <th>Indicator</th>
      <th>Values for ${currentContract}</th>
      <th>Status</th>
    </tr></thead>
    <tbody>${rows2}</tbody>
  `;
}

async function saveExtractedData() {
  const payload = { table1: {}, table2: {} };

  document.querySelectorAll('#extractedTable1 input[type="number"]').forEach(input => {
    const ind = input.dataset.indicator;
    const con = input.dataset.contract;
    if (input.value !== '') {
      if (!payload.table1[ind]) payload.table1[ind] = {};
      payload.table1[ind][con] = parseFloat(input.value);
    }
  });

  document.querySelectorAll('#extractedTable2 input[type="number"]').forEach(input => {
    const ind = input.dataset.indicator;
    const con = input.dataset.contract;
    const field = input.dataset.field;
    if (input.value !== '') {
      if (!payload.table2[ind]) payload.table2[ind] = {};
      if (!payload.table2[ind][con]) payload.table2[ind][con] = {};
      payload.table2[ind][con][field] = parseFloat(input.value);
    }
  });

  try {
    const res = await fetch(`/api/data/${currentProject}/${currentMonth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast('Extracted data saved successfully!');
      // Go back to method page after short delay
      setTimeout(() => navigateTo('method'), 1500);
    } else {
      showToast('Failed to save extracted data.');
    }
  } catch {
    showToast('Error saving. Please try again.');
  }
}

function resetUpload() {
  document.getElementById('dropZone').style.display = 'block';
  document.getElementById('uploadProgress').style.display = 'none';
  document.getElementById('extractedResults').style.display = 'none';
  document.getElementById('fileInput').value = '';
}

// ============================================================
// UTILITIES
// ============================================================

function formatNumber(num) {
  const n = parseFloat(num);
  if (isNaN(n)) return '-';
  // Large numbers get commas, decimals kept as-is
  if (Number.isInteger(n) || n > 100) {
    return n.toLocaleString('en-US');
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}
