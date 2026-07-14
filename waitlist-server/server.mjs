import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_PATH = path.join(__dirname, 'waitlist.xlsx');
const SHEET_NAME = 'Waitlist';

// Practical email check: something@something.tld, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Set this in Render's Environment tab to a long random string.
// Without it, the export endpoint below is disabled.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const app = express();
app.use(cors());
app.use(express.json());

async function loadWorkbook() {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(FILE_PATH)) {
    await wb.xlsx.readFile(FILE_PATH);
  }
  let ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) {
    ws = wb.addWorksheet(SHEET_NAME);
    ws.addRow(['Email', 'Signed up at (UTC)']);
  }
  return { wb, ws };
}

// Simple in-process queue so concurrent requests don't clobber each other's
// read-modify-write of the spreadsheet file.
let queue = Promise.resolve();

app.post('/api/waitlist', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  queue = queue.then(async () => {
    const { wb, ws } = await loadWorkbook();

    let alreadyOnList = false;
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header row
      const val = String(row.getCell(1).value || '').toLowerCase();
      if (val === email) alreadyOnList = true;
    });

    if (alreadyOnList) {
      return { ok: true, duplicate: true };
    }

    ws.addRow([email, new Date().toISOString()]);
    await wb.xlsx.writeFile(FILE_PATH);
    return { ok: true, duplicate: false };
  });

  queue.then(
    (result) => res.json(result),
    (err) => {
      console.error('waitlist write failed:', err);
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  );
});

// Download the current waitlist.xlsx. Requires ?token=<ADMIN_TOKEN>.
// Visit: https://<your-service>.onrender.com/api/waitlist/export?token=YOUR_SECRET
app.get('/api/waitlist/export', (req, res) => {
  if (!ADMIN_TOKEN || req.query.token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!fs.existsSync(FILE_PATH)) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  res.download(FILE_PATH, 'waitlist.xlsx');
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Waitlist server listening on port ${PORT}`);
  console.log(`Emails are being saved to ${FILE_PATH}`);
  if (!ADMIN_TOKEN) {
    console.log('ADMIN_TOKEN is not set — /api/waitlist/export is disabled until you set it.');
  }
});
