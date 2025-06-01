// API route: /api/bet (add bet, get bets, clear bets, etc)
import { getSheetsClient } from './googleSheet';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const BET_SHEET = 'bets';

export default async function handler(req, res) {
  const sheets = await getSheetsClient();
  if (req.method === 'POST') {
    // Add a bet
    const { username, side, amount } = req.body;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: BET_SHEET,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[Date.now(), username, side, amount]]
      }
    });
    return res.json({ success: true });
  }
  if (req.method === 'GET') {
    // Get all bets
    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BET_SHEET}!A2:Z`,
    });
    return res.json({ bets: rows.data.values });
  }
  if (req.method === 'DELETE') {
    // Clear all bets: overwrite with header only
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: BET_SHEET,
      valueInputOption: 'RAW',
      requestBody: { values: [['timestamp','username','side','amount']] }
    });
    return res.json({ success: true });
  }
  res.status(405).end();
}
