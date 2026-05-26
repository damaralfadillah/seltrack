const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storageProduk = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/produk');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, `${Date.now()}-${cleanName}`);
  },
});

const storageToko = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/toko');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, `${Date.now()}-${cleanName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.'), false);
  }
};

const uploadProduk = multer({
  storage: storageProduk,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

const uploadToko = multer({
  storage: storageToko,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

module.exports = { uploadProduk, uploadToko };