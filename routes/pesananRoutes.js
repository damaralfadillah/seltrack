const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getPesanan, getPesananById, createPesanan, updateStatusPesanan, deletePesanan } = require('../controllers/pesananController');

router.get('/pesanan', auth, getPesanan);
router.get('/pesanan/:id', auth, getPesananById);
router.post('/pesanan', auth, createPesanan);
router.put('/pesanan/:id/status', auth, updateStatusPesanan);
router.delete('/pesanan/:id', auth, deletePesanan);

module.exports = router;
