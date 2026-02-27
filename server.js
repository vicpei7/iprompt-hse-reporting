// ============================================================
// server.js — Main backend server for iPrompt HSE Reporting
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PROJECTS, TABLE1_INDICATORS, TABLE2_INDICATORS, MONTHS, INDICATOR_KEYWORDS } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- File upload setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.xlsx', '.xls', '.docx', '.doc', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload PDF, Excel, Word, CSV, or text files.'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

// --- Data & uploads directories (auto-create if missing, e.g. on cloud) ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Helper: get file path for a project+month combo
function getDataPath(projectId, monthId) {
  return path.join(DATA_DIR, `${projectId}_${monthId}.json`);
}

// Helper: create empty data structure for a project+month
function createEmptyData(projectId) {
  const project = PROJECTS[projectId];
  if (!project) return null;

  const table1 = {};
  TABLE1_INDICATORS.forEach(ind => {
    table1[ind] = {};
    project.contracts.forEach(c => {
      table1[ind][c.id] = null;
    });
  });

  const table2 = {};
  TABLE2_INDICATORS.forEach(ind => {
    table2[ind] = {};
    project.contracts.forEach(c => {
      table2[ind][c.id] = { planned: null, actual: null };
    });
  });

  return { table1, table2, lastUpdated: null };
}

// Helper: load data for a project+month (create empty if not exists)
function loadData(projectId, monthId) {
  const filePath = getDataPath(projectId, monthId);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return createEmptyData(projectId);
    }
  }
  return createEmptyData(projectId);
}

// Helper: save data for a project+month
function saveData(projectId, monthId, data) {
  data.lastUpdated = new Date().toISOString();
  const filePath = getDataPath(projectId, monthId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================================
// API ROUTES
// ============================================================

// GET /api/config — return all configuration (projects, indicators, months)
app.get('/api/config', (req, res) => {
  res.json({
    projects: PROJECTS,
    table1Indicators: TABLE1_INDICATORS,
    table2Indicators: TABLE2_INDICATORS,
    months: MONTHS
  });
});

// GET /api/data/:projectId/:monthId — get data for a project+month
app.get('/api/data/:projectId/:monthId', (req, res) => {
  const { projectId, monthId } = req.params;
  if (!PROJECTS[projectId]) return res.status(404).json({ error: 'Project not found' });
  const data = loadData(projectId, monthId);
  res.json(data);
});

// POST /api/data/:projectId/:monthId — save data for a project+month
app.post('/api/data/:projectId/:monthId', (req, res) => {
  const { projectId, monthId } = req.params;
  if (!PROJECTS[projectId]) return res.status(404).json({ error: 'Project not found' });

  const existing = loadData(projectId, monthId);
  const incoming = req.body;

  // Merge incoming data with existing (so different contracts can save independently)
  if (incoming.table1) {
    Object.keys(incoming.table1).forEach(indicator => {
      if (existing.table1[indicator]) {
        Object.keys(incoming.table1[indicator]).forEach(contractId => {
          const val = incoming.table1[indicator][contractId];
          if (val !== undefined && val !== null && val !== '') {
            existing.table1[indicator][contractId] = val;
          }
        });
      }
    });
  }

  if (incoming.table2) {
    Object.keys(incoming.table2).forEach(indicator => {
      if (existing.table2[indicator]) {
        Object.keys(incoming.table2[indicator]).forEach(contractId => {
          const val = incoming.table2[indicator][contractId];
          if (val !== undefined && val !== null) {
            if (val.planned !== undefined && val.planned !== null && val.planned !== '') {
              existing.table2[indicator][contractId].planned = val.planned;
            }
            if (val.actual !== undefined && val.actual !== null && val.actual !== '') {
              existing.table2[indicator][contractId].actual = val.actual;
            }
          }
        });
      }
    });
  }

  saveData(projectId, monthId, existing);
  res.json({ success: true, data: existing });
});

// GET /api/cumulative/:projectId — get cumulative totals across all months
app.get('/api/cumulative/:projectId', (req, res) => {
  const { projectId } = req.params;
  if (!PROJECTS[projectId]) return res.status(404).json({ error: 'Project not found' });

  const cumulative = createEmptyData(projectId);
  const project = PROJECTS[projectId];

  // Sum across all months
  MONTHS.forEach(month => {
    const monthData = loadData(projectId, month.id);

    TABLE1_INDICATORS.forEach(ind => {
      project.contracts.forEach(c => {
        const val = monthData.table1[ind]?.[c.id];
        if (val !== null && val !== undefined && val !== '') {
          const numVal = parseFloat(val);
          if (!isNaN(numVal)) {
            cumulative.table1[ind][c.id] = (cumulative.table1[ind][c.id] || 0) + numVal;
          }
        }
      });
    });

    TABLE2_INDICATORS.forEach(ind => {
      project.contracts.forEach(c => {
        const entry = monthData.table2[ind]?.[c.id];
        if (entry) {
          if (entry.planned !== null && entry.planned !== undefined && entry.planned !== '') {
            const numVal = parseFloat(entry.planned);
            if (!isNaN(numVal)) {
              if (!cumulative.table2[ind][c.id].planned) cumulative.table2[ind][c.id].planned = 0;
              cumulative.table2[ind][c.id].planned += numVal;
            }
          }
          if (entry.actual !== null && entry.actual !== undefined && entry.actual !== '') {
            const numVal = parseFloat(entry.actual);
            if (!isNaN(numVal)) {
              if (!cumulative.table2[ind][c.id].actual) cumulative.table2[ind][c.id].actual = 0;
              cumulative.table2[ind][c.id].actual += numVal;
            }
          }
        }
      });
    });
  });

  res.json(cumulative);
});

// POST /api/upload/:projectId/:monthId — upload HSE report and extract data
app.post('/api/upload/:projectId/:monthId', upload.single('hsefile'), async (req, res) => {
  const { projectId, monthId } = req.params;
  const contractId = req.body.contractId;

  if (!PROJECTS[projectId]) return res.status(404).json({ error: 'Project not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let textContent = '';

    // Extract text based on file type
    if (ext === '.pdf') {
      // Try pdf-parse first, fallback to pdfjs-dist
      try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        textContent = pdfData.text;
      } catch (pdfErr) {
        // Fallback: use pdfjs-dist
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
        const dataBuffer = new Uint8Array(fs.readFileSync(filePath));
        const pdfDoc = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          textContent += content.items.map(item => item.str).join(' ') + '\n';
        }
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        textContent += XLSX.utils.sheet_to_csv(sheet) + '\n';
      });
    } else if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      textContent = result.value;
    } else if (ext === '.txt' || ext === '.csv') {
      textContent = fs.readFileSync(filePath, 'utf8');
    }

    // Search for indicator values in the text
    const extracted = { table1: {}, table2: {} };
    const textLower = textContent.toLowerCase();
    const lines = textContent.split('\n');

    // For each indicator, search for keywords and nearby numbers
    TABLE1_INDICATORS.forEach(indicator => {
      const keywords = INDICATOR_KEYWORDS[indicator] || [];
      let foundValue = null;

      for (const keyword of keywords) {
        // Search each line for the keyword
        for (const line of lines) {
          const lineLower = line.toLowerCase();
          if (lineLower.includes(keyword.toLowerCase())) {
            // Look for numbers on this line
            const numbers = line.match(/[\d,]+\.?\d*/g);
            if (numbers && numbers.length > 0) {
              // Take the first meaningful number (skip very small ones for manhours)
              for (const numStr of numbers) {
                const num = parseFloat(numStr.replace(/,/g, ''));
                if (!isNaN(num)) {
                  foundValue = num;
                  break;
                }
              }
            }
            if (foundValue !== null) break;
          }
        }
        if (foundValue !== null) break;
      }

      if (foundValue !== null) {
        extracted.table1[indicator] = foundValue;
      }
    });

    TABLE2_INDICATORS.forEach(indicator => {
      const keywords = INDICATOR_KEYWORDS[indicator] || [];
      let foundPlanned = null;
      let foundActual = null;

      for (const keyword of keywords) {
        for (const line of lines) {
          const lineLower = line.toLowerCase();
          if (lineLower.includes(keyword.toLowerCase())) {
            const numbers = line.match(/[\d,]+\.?\d*/g);
            if (numbers && numbers.length >= 2) {
              foundPlanned = parseFloat(numbers[0].replace(/,/g, ''));
              foundActual = parseFloat(numbers[1].replace(/,/g, ''));
            } else if (numbers && numbers.length === 1) {
              foundActual = parseFloat(numbers[0].replace(/,/g, ''));
            }
            break;
          }
        }
        if (foundActual !== null) break;
      }

      if (foundPlanned !== null || foundActual !== null) {
        extracted.table2[indicator] = {
          planned: foundPlanned,
          actual: foundActual
        };
      }
    });

    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch {}

    res.json({
      success: true,
      filename: req.file.originalname,
      contractId,
      extracted,
      rawTextPreview: textContent.substring(0, 1000)
    });

  } catch (error) {
    // Clean up on error
    try { if (req.file) fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: 'Failed to process file: ' + error.message });
  }
});

// --- Serve the single-page app for all other routes ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start server (listen on all network interfaces so office colleagues can access) ---
app.listen(PORT, '0.0.0.0', () => {
  // Find local IP address for sharing
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  console.log(`\n  ========================================`);
  console.log(`  iPrompt HSE Reporting System is running!`);
  console.log(`  ========================================`);
  console.log(`\n  For YOU (this computer):`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`\n  For YOUR COLLEAGUES (share this link):`);
  console.log(`    http://${localIP}:${PORT}`);
  console.log(`\n  Keep this window open while people are using the app.\n`);
});
