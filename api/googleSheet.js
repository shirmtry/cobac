const { google } = require('googleapis');
const sheets = google.sheets('v4');
const key = require('../credentials.json'); // Đường dẫn file service account
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = '1_fvM8R8nmyY0WeYdJwBveYRxoFp3P6nIsa862X5GlCQ'; // Google Sheet ID

function getAuth() {
  return new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    SCOPES
  );
}

async function getSheet(sheetName, range) {
  const auth = getAuth();
  const res = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!${range}`
  });
  return res.data.values;
}

async function appendSheet(sheetName, values) {
  const auth = getAuth();
  await sheets.spreadsheets.values.append({
    auth,
    spreadsheetId: SHEET_ID,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] }
  });
}

module.exports = { getSheet, appendSheet };
