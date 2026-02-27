// ============================================================
// config.js — All project/indicator/contract definitions
// This is the "single source of truth" for the data structure
// ============================================================

const PROJECTS = {
  "sapih-tiram-wangsa": {
    id: "sapih-tiram-wangsa",
    name: "Sapih Tiram Wangsa",
    shortName: "STW",
    description: "Sapih Tiram and Wangsa FDP",
    color: "#1a5276",
    contracts: [
      { id: "P2", label: "P2 (MHB)" },
      { id: "P3", label: "P3 (HHA)" },
      { id: "P6", label: "P6 (WASCO)" },
      { id: "P7", label: "P7 (T&I)" },
      { id: "P8", label: "P8 (Drilling)" },
      { id: "P9", label: "P9 (TBA)" }
    ]
  },
  "chenda": {
    id: "chenda",
    name: "Chenda",
    shortName: "CHD",
    description: "Chenda Project",
    color: "#117a65",
    contracts: [
      { id: "P2", label: "P2 (MHB)" },
      { id: "P3", label: "P3 (HHA)" },
      { id: "P6", label: "P6 (WASCO)" },
      { id: "P7", label: "P7 (T&I)" },
      { id: "P8", label: "P8 (Drilling)" },
      { id: "P9", label: "P9 (TBA)" }
    ]
  },
  "sirung": {
    id: "sirung",
    name: "Sirung",
    shortName: "SRG",
    description: "Sirung Project",
    color: "#7d3c98",
    contracts: [
      { id: "P11", label: "P11 (BHSB)" },
      { id: "P3", label: "P3 (HHA)" },
      { id: "P6", label: "P6 (WASCO)" },
      { id: "P7", label: "P7 (T&I)" },
      { id: "P8", label: "P8 (Drilling)" },
      { id: "P9", label: "P9 (TBA)" }
    ]
  }
};

// Table 1: Count-based indicators (single numeric value per contract)
const TABLE1_INDICATORS = [
  "Manhours",
  "Fatality",
  "Loss Time Injury (LTI)",
  "Loss Time Injury Frequency (LTIF)",
  "Major Oil Spills",
  "Major Fire",
  "Major Loss of Primary Containment (LOPC)",
  "Medical Treatment / Restricted Work Case (MTC/RWC)",
  "First Aid Cases (FAC)",
  "Property Damage",
  "Near Miss Case",
  "Unsafe Act / Unsafe Condition",
  "Stop Work"
];

// Table 2: Planned vs Actual indicators (two values per contract)
const TABLE2_INDICATORS = [
  "Permanent Total / Partial Disability (PPD/PTD)",
  "Management Walkabout",
  "HSSE Safe Work Campaign",
  "HSSE Training Compliance",
  "HSSE Audit",
  "Safety Training"
];

// Months available for input (March to December 2026)
const MONTHS = [
  { id: "Mar-26", label: "March 2026" },
  { id: "Apr-26", label: "April 2026" },
  { id: "May-26", label: "May 2026" },
  { id: "Jun-26", label: "June 2026" },
  { id: "Jul-26", label: "July 2026" },
  { id: "Aug-26", label: "August 2026" },
  { id: "Sep-26", label: "September 2026" },
  { id: "Oct-26", label: "October 2026" },
  { id: "Nov-26", label: "November 2026" },
  { id: "Dec-26", label: "December 2026" }
];

// Keywords to search for in uploaded HSE reports
// Maps indicator names to possible keywords found in reports
const INDICATOR_KEYWORDS = {
  "Manhours": ["manhours", "man-hours", "man hours", "working hours", "total hours", "exposure hours"],
  "Fatality": ["fatality", "fatalities", "fatal", "death"],
  "Loss Time Injury (LTI)": ["loss time injury", "lti", "lost time injury", "lost time incident"],
  "Loss Time Injury Frequency (LTIF)": ["ltif", "loss time injury frequency", "lost time injury frequency"],
  "Major Oil Spills": ["oil spill", "oil spills", "major spill"],
  "Major Fire": ["major fire", "fire incident", "fire"],
  "Major Loss of Primary Containment (LOPC)": ["lopc", "loss of primary containment", "loss of containment"],
  "Medical Treatment / Restricted Work Case (MTC/RWC)": ["medical treatment case", "mtc", "restricted work case", "rwc", "mtc/rwc"],
  "First Aid Cases (FAC)": ["first aid case", "first aid", "fac"],
  "Property Damage": ["property damage", "damage to property"],
  "Near Miss Case": ["near miss", "near-miss", "nearmiss"],
  "Unsafe Act / Unsafe Condition": ["unsafe act", "unsafe condition", "unsafe act/condition"],
  "Stop Work": ["stop work", "stopwork", "stop work authority", "swa"],
  "Permanent Total / Partial Disability (PPD/PTD)": ["ppd", "ptd", "permanent disability", "partial disability"],
  "Management Walkabout": ["management walkabout", "management visit", "walkabout"],
  "HSSE Safe Work Campaign": ["safe work campaign", "safety campaign", "hsse campaign"],
  "HSSE Training Compliance": ["training compliance", "hsse training"],
  "HSSE Audit": ["hsse audit", "safety audit", "audit"],
  "Safety Training": ["safety training", "training session", "safety course"]
};

module.exports = {
  PROJECTS,
  TABLE1_INDICATORS,
  TABLE2_INDICATORS,
  MONTHS,
  INDICATOR_KEYWORDS
};
