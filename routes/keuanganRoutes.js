const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const {
  getPemasukan, createPemasukan, deletePemasukan,
  getPengeluaran, createPengeluaran, deletePengeluaran,
  getSummary,
} = require('../controllers/keuanganController');

router.get('/pemasukan', auth, getPemasukan);
router.post('/pemasukan', auth, createPemasukan);
router.delete('/pemasukan/:id', auth, deletePemasukan);

router.get('/pengeluaran', auth, getPengeluaran);
router.post('/pengeluaran', auth, createPengeluaran);
router.delete('/pengeluaran/:id', auth, deletePengeluaran);

router.get('/keuangan/summary', auth, getSummary);

module.exports = router;
    