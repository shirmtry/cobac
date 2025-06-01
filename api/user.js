// API route: /api/user (register, login, get-user, etc)
import { getSheetsClient } from './googleSheet';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID; // Set in Vercel project env
const USER_SHEET = 'users';

export default async function handler(req, res) {
  const sheets = await getSheetsClient();
  if (req.method === 'POST') {
    // Register user
    const { username, passwordHash, ip } = req.body;
    // Check if user exists
    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USER_SHEET}!A2:Z`,
    });
    if (rows.data.values?.some(row => row[0] === username)) {
      return res.status(400).json({ error: 'Username exists' });
    }
    // Append user
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: USER_SHEET,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[username, passwordHash, 10000, ip, 'user']]
      }
    });
    return res.json({ success: true });
  }
  if (req.method === 'GET') {
    // Get user info
    const { username } = req.query;
    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USER_SHEET}!A2:Z`,
    });
    const row = rows.data.values?.find(row => row[0] === username);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json({
      username: row[0],
      balance: row[2],
      ip: row[3],
      role: row[4],
    });
  }
  res.status(405).end();
}
