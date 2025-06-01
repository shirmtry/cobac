// common utils for Google Sheet API using service account

import { google } from 'googleapis';

export async function getSheetsClient() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const jwt = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes
  );
  await jwt.authorize();
  const sheets = google.sheets({ version: 'v4', auth: jwt });
  return sheets;
}
