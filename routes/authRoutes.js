const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { uploadToko } = require('../middleware/uploadMiddleware');
const { register, login, logout, getProfil, updateProfil, gantiPassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', auth, logout);
router.get('/profil', auth, getProfil);
router.put('/profil', auth, uploadToko.single('foto_toko'), updateProfil);
router.put('/ganti-password', auth, gantiPassword);

module.exports = router;
