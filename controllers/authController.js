const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
require('dotenv').config();

const register = async (req, res) => {
  try {
    const { nama, email, password, nama_toko } = req.body;

    if (!nama || !email || !password)
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Password minimal 6 karakter.' });

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(400).json({ message: 'Email sudah terdaftar.' });

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      'INSERT INTO users (nama, email, password, nama_toko) VALUES (?, ?, ?, ?)',
      [nama, email, hashedPassword, nama_toko || null]
    );

    res.status(201).json({ message: 'Registrasi berhasil! Silakan login.', userId: result.insertId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(401).json({ message: 'Email atau password salah.' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Email atau password salah.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, nama: user.nama },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        nama_toko: user.nama_toko,
        foto_toko: user.foto_toko
          ? `${process.env.BASE_URL}/uploads/toko/${path.basename(user.foto_toko)}`
          : null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logout berhasil.' });
};

const getProfil = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nama, email, nama_toko, foto_toko, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'User tidak ditemukan.' });

    const user = rows[0];
    if (user.foto_toko) {
      user.foto_toko = `${process.env.BASE_URL}/uploads/toko/${path.basename(user.foto_toko)}`;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const updateProfil = async (req, res) => {
  try {
    const { nama, email, nama_toko } = req.body;
    const userId = req.user.id;

    if (email) {
      const [existing] = await db.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      if (existing.length > 0)
        return res.status(400).json({ message: 'Email sudah digunakan akun lain.' });
    }

    let foto_toko = undefined;
    if (req.file) {
      const [oldUser] = await db.query('SELECT foto_toko FROM users WHERE id = ?', [userId]);
      if (oldUser[0]?.foto_toko) {
        const oldPath = path.join(__dirname, '../uploads/toko', path.basename(oldUser[0].foto_toko));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      foto_toko = req.file.filename;
    }

    const updates = [];
    const values = [];
    if (nama) { updates.push('nama = ?'); values.push(nama); }
    if (email) { updates.push('email = ?'); values.push(email); }
    if (nama_toko !== undefined) { updates.push('nama_toko = ?'); values.push(nama_toko); }
    if (foto_toko !== undefined) { updates.push('foto_toko = ?'); values.push(foto_toko); }

    if (updates.length === 0)
      return res.status(400).json({ message: 'Tidak ada data yang diubah.' });

    values.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Profil berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const gantiPassword = async (req, res) => {
  try {
    const { password_lama, password_baru, konfirmasi_password } = req.body;

    if (!password_lama || !password_baru || !konfirmasi_password)
      return res.status(400).json({ message: 'Semua field password wajib diisi.' });

    if (password_baru !== konfirmasi_password)
      return res.status(400).json({ message: 'Konfirmasi password tidak cocok.' });

    if (password_baru.length < 6)
      return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });

    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(password_lama, rows[0].password);
    if (!isMatch)
      return res.status(400).json({ message: 'Password lama tidak sesuai.' });

    const hashed = await bcrypt.hash(password_baru, 12);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ message: 'Password berhasil diubah.' });
  } catch (err) {
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

module.exports = { register, login, logout, getProfil, updateProfil, gantiPassword };