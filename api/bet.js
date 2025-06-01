import { getSheetsClient } from '../../utils/sheets';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const BET_SHEET = 'bets';

export default async function handler(req, res) {
  if (!SPREADSHEET_ID) {
    return res.status(500).json({ error: 'Missing GOOGLE_SHEET_ID env' });
  }
  const sheets = await getSheetsClient();

  if (req.method === 'POST') {
    try {
      const { username, side, amount } = req.body;
      if (!username || !side || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: BET_SHEET,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[Date.now(), username, side, amount]]
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
        range: `${BET_SHEET}!A2:Z`,
      });
      return res.json({ bets: rows.data.values || [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'DELETE') {
    try {
      // Update header row (nếu sheet header khác thì sửa lại)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: BET_SHEET,
        valueInputOption: 'RAW',
        requestBody: { values: [['timestamp','username','side','amount']] }
      });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(405).end();
}
