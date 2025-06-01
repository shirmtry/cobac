import { getSheetsClient } from '../../utils/sheets';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const REQUEST_SHEET = 'requests';

export default async function handler(req, res) {
  if (!SPREADSHEET_ID) {
    return res.status(500).json({ error: 'Missing GOOGLE_SHEET_ID env' });
  }
  const sheets = await getSheetsClient();

  if (req.method === 'POST') {
    try {
      const { username, type, amount, status, bank_code } = req.body;
      if (!username || !type || !amount || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: REQUEST_SHEET,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[Date.now(), username, type, amount, status, bank_code || '']]
        }
      });
      return res.status(201).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'GET') {
    try {
      const rows = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${REQUEST_SHEET}!A2:Z`,
      });
      return res.json({ requests: rows.data.values || [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(405).end();
}
