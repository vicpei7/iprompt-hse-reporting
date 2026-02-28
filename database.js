// ============================================================
// database.js — MongoDB storage for iPrompt HSE Reporting
// Falls back to JSON files if no MongoDB connection configured
// ============================================================

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// --- Data directory for file-based fallback ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- MongoDB connection state ---
let isMongoConnected = false;

// --- MongoDB Schema ---
const hseDataSchema = new mongoose.Schema({
  // Unique key: "projectId_monthId" e.g. "sirung_Mar-26"
  key: { type: String, required: true, unique: true, index: true },
  projectId: { type: String, required: true },
  monthId: { type: String, required: true },
  table1: { type: mongoose.Schema.Types.Mixed, default: {} },
  table2: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

const HseData = mongoose.model('HseData', hseDataSchema);

// --- Connect to MongoDB ---
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('  [DB] No MONGODB_URI set — using JSON file storage (data resets on restart)');
    return false;
  }

  try {
    await mongoose.connect(uri);
    isMongoConnected = true;
    console.log('  [DB] Connected to MongoDB — data will persist permanently!');
    return true;
  } catch (err) {
    console.log('  [DB] MongoDB connection failed — falling back to JSON files');
    console.log('  [DB] Error:', err.message);
    return false;
  }
}

// --- Helper: build key ---
function makeKey(projectId, monthId) {
  return `${projectId}_${monthId}`;
}

// --- Helper: file path for JSON fallback ---
function getFilePath(projectId, monthId) {
  return path.join(DATA_DIR, `${projectId}_${monthId}.json`);
}

// ============================================================
// LOAD DATA
// ============================================================
async function loadData(projectId, monthId, emptyTemplate) {
  if (isMongoConnected) {
    try {
      const doc = await HseData.findOne({ key: makeKey(projectId, monthId) });
      if (doc) {
        return {
          table1: doc.table1 || emptyTemplate.table1,
          table2: doc.table2 || emptyTemplate.table2,
          lastUpdated: doc.lastUpdated
        };
      }
    } catch (err) {
      console.error('[DB] Load error:', err.message);
    }
  }

  // Fallback: JSON file
  const filePath = getFilePath(projectId, monthId);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {}
  }

  return emptyTemplate;
}

// ============================================================
// SAVE DATA
// ============================================================
async function saveData(projectId, monthId, data) {
  data.lastUpdated = new Date().toISOString();

  if (isMongoConnected) {
    try {
      await HseData.findOneAndUpdate(
        { key: makeKey(projectId, monthId) },
        {
          key: makeKey(projectId, monthId),
          projectId,
          monthId,
          table1: data.table1,
          table2: data.table2,
          lastUpdated: new Date()
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('[DB] Save error:', err.message);
    }
  }

  // Always also save to JSON file as backup
  const filePath = getFilePath(projectId, monthId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

// ============================================================
// LOAD ALL MONTHS (for cumulative)
// ============================================================
async function loadAllMonths(projectId, months, emptyTemplate) {
  const results = {};

  if (isMongoConnected) {
    try {
      const docs = await HseData.find({ projectId });
      docs.forEach(doc => {
        results[doc.monthId] = {
          table1: doc.table1 || {},
          table2: doc.table2 || {}
        };
      });
      // Fill in any missing months with empty template
      months.forEach(m => {
        if (!results[m.id]) {
          results[m.id] = { ...emptyTemplate };
        }
      });
      return results;
    } catch (err) {
      console.error('[DB] LoadAll error:', err.message);
    }
  }

  // Fallback: load each JSON file
  months.forEach(m => {
    const filePath = getFilePath(projectId, m.id);
    if (fs.existsSync(filePath)) {
      try {
        results[m.id] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        results[m.id] = { ...emptyTemplate };
      }
    } else {
      results[m.id] = { ...emptyTemplate };
    }
  });

  return results;
}

module.exports = {
  connectDB,
  loadData,
  saveData,
  loadAllMonths,
  isConnected: () => isMongoConnected
};
