import { google } from "googleapis";

// Biến môi trường
const SPREADSHEET_ID = 1_fvM8R8nmyY0WeYdJwBveYRxoFp3P6nIsa862X5GlCQ;
const SHEET_NAME = "users";

const clientEmail = ok-huy-api@imposing-volt-451301-a8.iam.gserviceaccount.com;
const privateKey = -----BEGIN PRIVATE KEY-----\nMIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQDGxZah06DRIvpa\nnjXOV47APNSk7is3voNOOnHwHj9b2GuzbYY5rkHIYWgCLFrDay+EbB8vPVZXfFXK\n3WyZwFKpoz6pZSevukpTHZET4V+ko2vkYGduUt6rnD5e7cbaxy4mC5FTFS0/AFKF\njFMEtgAWGWZHYQmrbGX0w+V+7+KbAyhmZJ1HkjlSA+AHAf2K3Ht2Qr/cCIBpcN04\nPnN6DrYXEjPEJWWdyPb05lnMOK90U/eX+tY+DER8Ev02+XY3D+oQ5slQTlM7sEzd\n+nRwlHZucj/Q2QCJ3x4t0u3JzpYtxV7yXMfhSi5KX9i9cHUk7JmkTyfDlgusvrM5\nqMSzuqwlAgMBAAECgf8sAtAhFxkq+RcHS3Wod4AAE/PNfoo9AIrwycjWoIaO/zNi\nz+g7Nfaka7WlAccTnaIhg6BOQUxh1Kk0Wg0zbfzIJ7TkfJ6QsRxmIq4pGO1xRlY0\nvInMiioNFOt8iXgBjegPKhp18WbCIhgWGMczM+9LGirKDJoU/dnHhkMkmvV2HSHE\nYXYCDg1gVuSsQyohqCcXFPh3pCHC44hEJMLXYjvi5gGbqX6g3v1tJzZP8l97SXlk\nSRAzezk9BODF+j0HWSuEagDR0F2vNepeYJlc7luLOswCas+Yo77YDlr6l2pu6cPA\ntGfWQdfMahh0FarSQxLlnunrpFDSIYXyY64PTncCgYEA43lSbWndfe3WuBenn78T\n9UbZbcMGlfj6rUgzXJj3m0x1IvhLiS/3PL7wOJGKHca/EpQ9b2BKAM52H8b2xfVH\nv+WePB1VadKkXCJPexF+u/4OfOWhLrPsii89hDrTPvm95otS9r+JAynKGu4SGfDf\n7J6A2eAsiFz91VeSrqyB0C8CgYEA37LVO/CZnNNUsFvHybGUjq2MJNv9ZOFdjnMu\nqzvigISWfuaWUPSLJS+abKwgltPxEwJRCRo0B5q/KBVCO7gVo6Pe9bPKc+tGv2da\nkEbzNq2G7b9vJty5WQ+VDt3+ADuuBUxYI0GfXnHaZK9WyRzIl6vXCmZTrg+GlABD\n5uy7P+sCgYEAk2LFbI0ebPyQliEFg/TLWq34LS0i9EMpMONKHCIktKPadbkJQC8q\n81oHza9HHTnsDX6tO5/Y8yLS2I4S0Hq3bXe6idq7v+AyjFvSwbu5MNdQzc3/HIKJ\nrZMkOavfubsZNupo6+V4QetuvvooElTG0cp1VDXyxLvz36ppKPIu/hMCgYAzXtQN\nAcGk+/r0zP7iWH9vDHekd0iHhCGB9v1+oS/wp4IP/lACo0XY8keaMSUCvgUcgmmt\nl3DfVjATul4NbMa7X4RyFCmn2R3UEp3/h+uOYOcdbdrOp92AkE2AroYH86yQ1ule\nn1FD1Q18Fa/uW0fNXM7zOnB5BmO3VSBCxZZypQKBgBYGz9hJS/9qt2ZUcjkdvZkX\nIauStg8YXdm0pfsSxDd8qBoAg7Aty0+IgeEwnbWOwS4a6rsvOO6XSPyezVq+2d00\nmQZEDmtxIb+9uXFC/v4LIHILSjdrp/Eu02boGvBc5wVNr6kBTels4fwJAHyYXLsx\n0mUhfe7RHMHmFXETDOC5\n-----END PRIVATE KEY-----\n;

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
  const sheets = await getSheetsClient();

  // Đăng ký user
  if (req.method === "POST") {
    const { username, passwordHash, ip } = req.body;
    if (!username || !passwordHash) {
      res.status(400).json({ error: "Thiếu username hoặc password." });
      return;
    }
    const exists = await findUser(sheets, username);
    if (exists) {
      res.status(400).json({ error: "Username đã tồn tại." });
      return;
    }
    // Thêm user mới
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
      valueInputOption: 'RAW',
      requestBody: { values: [[username, passwordHash, 10000, ip, "user"]] }
    });
    res.json({ success: true });
    return;
  }

  // Lấy thông tin user
  if (req.method === "GET") {
    const { username, all } = req.query;
    if (all) {
      const rows = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:E`,
      });
      const users = (rows.data.values || []).map(row => ({
        username: row[0],
        passwordHash: row[1],
        balance: row[2],
        ip: row[3],
        role: row[4] || "user"
      }));
      res.json(users);
      return;
    }
    if (!username) {
      res.status(400).json({ error: "Thiếu username." });
      return;
    }
    const user = await findUser(sheets, username);
    if (!user) {
      res.status(404).json({ error: "Không tìm thấy user." });
      return;
    }
    res.json(user);
    return;
  }

  // Cập nhật số dư user
  if (req.method === "PATCH") {
    const { username, balance } = req.body;
    if (!username || typeof balance === "undefined") {
      res.status(400).json({ error: "Thiếu username hoặc balance." });
      return;
    }
    const user = await findUser(sheets, username);
    if (!user) {
      res.status(404).json({ error: "User không tồn tại." });
      return;
    }
    // Update balance
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!C${user.rowIndex}`, // C = balance
      valueInputOption: 'RAW',
      requestBody: { values: [[balance]] }
    });
    res.json({ success: true });
    return;
  }

  // Xóa user
  if (req.method === "DELETE") {
    const { username } = req.query;
    if (!username) {
      res.status(400).json({ error: "Thiếu username." });
      return;
    }
    const user = await findUser(sheets, username);
    if (!user) {
      res.status(404).json({ error: "Không tìm thấy user." });
      return;
    }
    // Xóa user bằng clear giá trị dòng đó (không thật sự delete row)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${user.rowIndex}:E${user.rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [["", "", "", "", ""]] }
    });
    res.json({ success: true });
    return;
  }

  res.status(405).json({ error: "Phương thức không hỗ trợ." });
}
