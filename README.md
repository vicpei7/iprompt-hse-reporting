# iPrompt HSE Reporting

A web app for tracking Health, Safety, and Environment (HSE) indicators across multiple oil and gas projects. Multiple contract focal persons can enter data online at the same time.

**Live site:** https://iprompt-hse-reporting.onrender.com

---

## Projects Tracked

| Project | Short Name | Contracts |
|---------|-----------|-----------|
| Sapih Tiram Wangsa | STW | P2 (MHB), P3 (HHA), P6 (WASCO), P7 (T&I), P8 (Drilling), P9 (TBA) |
| Chenda | CHD | P2 (MHB), P3 (HHA), P6 (WASCO), P7 (T&I), P8 (Drilling), P9 (TBA) |
| Sirung | SRG | P11 (BHSB), P3 (HHA), P6 (WASCO), P7 (T&I), P8 (Drilling), P9 (TBA) |

---

## Features

- **Manual input** — Type HSE values directly into the table
- **File upload** — Upload monthly HSE reports (PDF, Excel, Word) and the system extracts the data automatically
- **Multi-user** — Each contract saves independently, so multiple people can work at the same time without overwriting each other
- **Cumulative view** — See year-to-date totals across all months (March to December 2026)
- **Two indicator tables:**
  - Table 1: 13 count-based indicators (manhours, injuries, near misses, etc.)
  - Table 2: 6 planned-vs-actual indicators (audits, training, campaigns, etc.)

---

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML, CSS, JavaScript (single-page app)
- **Database:** MongoDB Atlas (free tier) with JSON file fallback
- **Hosting:** Render.com (free tier)
- **File parsing:** pdf-parse, xlsx, mammoth (for PDF, Excel, Word)

---

## Run Locally

1. Make sure you have [Node.js](https://nodejs.org/) installed
2. Clone the repo and navigate to the project folder
3. Install dependencies:
   ```
   npm install
   ```
4. Start the server:
   ```
   node server.js
   ```
5. Open http://localhost:3000 in your browser

The app works without MongoDB — it will save data to JSON files in a `data/` folder instead.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | No | MongoDB connection string. If not set, the app uses local JSON files instead. |
| `PORT` | No | Server port. Defaults to 3000. |

---

## Folder Structure

```
hse-app/
  server.js        — Backend API and routes
  database.js      — MongoDB connection + JSON fallback
  config.js        — Project, contract, and indicator definitions
  render.yaml      — Render.com deployment settings
  package.json     — Dependencies and project info
  public/
    index.html     — The web page
    js/app.js      — Frontend logic
    css/styles.css — Styling
  data/            — Local JSON data files (when not using MongoDB)
  uploads/         — Temporary folder for uploaded HSE reports
```
