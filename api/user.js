import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = "users";
const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

async function getSheetsClient() {
  const jwt = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  await jwt.authorize();
  return google.sheets({ version: "v4", auth: jwt });
}

// Helper: Tìm user theo username
async function findUser(sheets, username) {
  const rows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:E`,
  });
  if (!rows.data.values) return null;
  const idx = rows.data.values.findIndex(row => row[0] === username);
  if (idx === -1) return null;
  const row = rows.data.values[idx];
  return {
    username: row[0],
    passwordHash: row[1],
    balance: row[2],
    ip: row[3],
    role: row[4] || "user",
    rowIndex: idx + 2 // index for updating (A2 là dòng 2)
  };
}

export default async function handler(req, res) {
  if (!SPREADSHEET_ID || !clientEmail || !privateKey) {
    return res.status(500).json({ error: "Missing Google Sheets credentials" });
  }

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (e) {
    return res.status(500).json({ error: "Google Sheets auth failed" });
  }

  // Đăng ký user
  if (req.method === "POST") {
    try {
      const { username, passwordHash, ip } = req.body;
      if (!username || !passwordHash) {
        return res.status(400).json({ error: "Thiếu username hoặc password." });
      }
      const exists = await findUser(sheets, username);
      if (exists) {
        return res.status(400).json({ error: "Username đã tồn tại." });
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_NAME,
        valueInputOption: 'RAW',
        requestBody: { values: [[username, passwordHash, 10000, ip, "user"]] }
      });
      return res.status(201).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Lấy thông tin user
  if (req.method === "GET") {
    try {
      const { username, all } = req.query;
      if (all) {
        const rows = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A2:E`,
        });
        // KHÔNG trả về passwordHash khi trả về danh sách
        const users = (rows.data.values || []).map(row => ({
          username: row[0],
          balance: row[2],
          ip: row[3],
          role: row[4] || "user"
        }));
        return res.status(200).json(users);
      }
      if (!username) {
        return res.status(400).json({ error: "Thiếu username." });
      }
      const user = await findUser(sheets, username);
      if (!user) {
        return res.status(404).json({ error: "Không tìm thấy user." });
      }
      // KHÔNG trả passwordHash nếu bạn không cần
      return res.status(200).json({
        username: user.username,
        balance: user.balance,
        ip: user.ip,
        role: user.role
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Cập nhật số dư user
  if (req.method === "PATCH") {
    try {
      const { username, balance } = req.body;
      if (!username || typeof balance === "undefined") {
        return res.status(400).json({ error: "Thiếu username hoặc balance." });
      }
      const user = await findUser(sheets, username);
      if (!user) {
        return res.status(404).json({ error: "User không tồn tại." });
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!C${user.rowIndex}`, // C = balance
        valueInputOption: 'RAW',
        requestBody: { values: [[balance]] }
      });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Xóa user
  if (req.method === "DELETE") {
    try {
      const { username } = req.query;
      if (!username) {
        return res.status(400).json({ error: "Thiếu username." });
      }
      const user = await findUser(sheets, username);
      if (!user) {
        return res.status(404).json({ error: "Không tìm thấy user." });
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${user.rowIndex}:E${user.rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [["", "", "", "", ""]] }
      });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: "Phương thức không hỗ trợ." });
}
