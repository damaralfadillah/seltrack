const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getLaporanKeuangan, getLaporanStok, exportPDF, exportExcel } = require('../controllers/laporanController');

router.get('/laporan/keuangan', auth, getLaporanKeuangan);
router.get('/laporan/stok', auth, getLaporanStok);
router.get('/laporan/export/pdf', auth, exportPDF);
router.get('/laporan/export/excel', auth, exportExcel);

module.exports = router;
