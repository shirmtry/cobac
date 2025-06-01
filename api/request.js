// API route: /api/request (deposit/withdraw requests)

import { getSheetsClient } from './googleSheet';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const REQUEST_SHEET = 'requests';

export default async function handler(req, res) {
  const sheets = await getSheetsClient();
  if (req.method === 'POST') {
    // Add deposit/withdraw request
    const { username, type, amount, status, bank_code } = req.body;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: REQUEST_SHEET,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[Date.now(), username, type, amount, status, bank_code]]
      }
    });
    return res.json({ success: true });
  }
  if (req.method === 'GET') {
    // Get all requests
    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${REQUEST_SHEET}!A2:Z`,
    });
    return res.json({ requests: rows.data.values });
  }
  res.status(405).end();
}
