const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Import các route backend (ví dụ: api/user.js, api/bet.js, ...)
const userRouter = require('./api/user');
const betRouter = require('./api/bet');
const googleSheetRouter = require('./api/googleSheet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API routes
app.use('/api/user', userRouter);
app.use('/api/bet', betRouter);
app.use('/api/sheet', googleSheetRouter);

// Phục vụ file tĩnh (frontend)
app.use(express.static(path.join(__dirname, '/')));

// Trang chủ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
