require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const produkRoutes = require('./routes/produkRoutes');
const keuanganRoutes = require('./routes/keuanganRoutes');
const pesananRoutes = require('./routes/pesananRoutes');
const laporanRoutes = require('./routes/laporanRoutes');

const { getDashboard } = require('./controllers/dashboardController');
const authMiddleware = require('./middleware/authMiddleware.js');

require('./config/db');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://seltrack-frontend.vercel.app',
    process.env.FRONTEND_URL,
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api', produkRoutes);
app.use('/api', keuanganRoutes);
app.use('/api', pesananRoutes);
app.use('/api', laporanRoutes);

app.get('/api/dashboard', authMiddleware, getDashboard);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Ukuran file terlalu besar. Maksimal 2MB.' });
  }
  if (err.message && err.message.includes('Format file')) {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: 'Terjadi kesalahan server.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
