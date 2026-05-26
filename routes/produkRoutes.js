const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { uploadProduk } = require('../middleware/uploadMiddleware');
const {
  getAllProduk, createProduk, updateProduk, deleteProduk, getLowStock,
  getAllKategori, createKategori, deleteKategori,
  stokMasuk, stokKeluar, getRiwayatStok,
} = require('../controllers/produkController');

router.get('/produk', auth, getAllProduk);
router.post('/produk', auth, uploadProduk.single('foto_produk'), createProduk);
router.put('/produk/:id', auth, uploadProduk.single('foto_produk'), updateProduk);
router.delete('/produk/:id', auth, deleteProduk);
router.get('/produk/low-stock', auth, getLowStock);

router.get('/kategori', auth, getAllKategori);
router.post('/kategori', auth, createKategori);
router.delete('/kategori/:id', auth, deleteKategori);

router.post('/stok/masuk', auth, stokMasuk);
router.post('/stok/keluar', auth, stokKeluar);
router.get('/stok/riwayat/:id', auth, getRiwayatStok);

module.exports = router;
