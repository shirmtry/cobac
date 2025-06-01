import { google } from 'googleapis';

export async function getSheetsClient() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in environment variables.');
  }

  const jwt = new google.auth.JWT(email, null, key, scopes);
  await jwt.authorize();
  return google.sheets({ version: 'v4', auth: jwt });
}
