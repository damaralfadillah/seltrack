const path = require('path');
const fs = require('fs');
const db = require('../config/db');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const fotoUrl = (filename) => filename ? `${BASE_URL}/uploads/produk/${filename}` : null;

const getAllProduk = async (req, res) => {
  try {
    const { search, kategori_id } = req.query;
    let query = `SELECT p.*, k.nama_kategori FROM produk p
      LEFT JOIN kategori k ON p.kategori_id = k.id
      WHERE p.user_id = ?`;
    const params = [req.user.id];

    if (search) { query += ' AND p.nama_produk LIKE ?'; params.push(`%${search}%`); }
    if (kategori_id) { query += ' AND p.kategori_id = ?'; params.push(kategori_id); }
    query += ' ORDER BY p.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows.map((p) => ({ ...p, foto_produk: fotoUrl(p.foto_produk) })));
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data produk.' });
  }
};

const createProduk = async (req, res) => {
  try {
    const { nama_produk, kategori_id, deskripsi, harga_modal, harga_jual, stok, stok_minimum } = req.body;

    if (!nama_produk || !harga_modal || !harga_jual)
      return res.status(400).json({ message: 'Nama produk, harga modal, dan harga jual wajib diisi.' });

    const foto = req.file ? req.file.filename : null;

    const [result] = await db.query(
      `INSERT INTO produk (user_id, kategori_id, nama_produk, deskripsi, harga_modal, harga_jual, stok, stok_minimum, foto_produk)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, kategori_id || null, nama_produk, deskripsi || null,
        harga_modal, harga_jual, stok || 0, stok_minimum || 5, foto]
    );

    if (stok && parseInt(stok) > 0) {
      await db.query(
        'INSERT INTO stok_log (produk_id, jenis, jumlah, keterangan) VALUES (?, ?, ?, ?)',
        [result.insertId, 'masuk', stok, 'Stok awal saat produk dibuat']
      );
    }

    res.status(201).json({ message: 'Produk berhasil ditambahkan.', produkId: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menambahkan produk.' });
  }
};

const updateProduk = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_produk, kategori_id, deskripsi, harga_modal, harga_jual, stok_minimum } = req.body;

    const [rows] = await db.query('SELECT * FROM produk WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'Produk tidak ditemukan.' });

    const existing = rows[0];
    let foto_produk = existing.foto_produk;

    if (req.file) {
      if (existing.foto_produk) {
        const oldPath = path.join(__dirname, '../uploads/produk', existing.foto_produk);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      foto_produk = req.file.filename;
    }

    await db.query(
      `UPDATE produk SET nama_produk=?, kategori_id=?, deskripsi=?,
       harga_modal=?, harga_jual=?, stok_minimum=?, foto_produk=?
       WHERE id=? AND user_id=?`,
      [
        nama_produk || existing.nama_produk,
        kategori_id !== undefined ? (kategori_id || null) : existing.kategori_id,
        deskripsi !== undefined ? deskripsi : existing.deskripsi,
        harga_modal || existing.harga_modal,
        harga_jual || existing.harga_jual,
        stok_minimum !== undefined ? stok_minimum : existing.stok_minimum,
        foto_produk, id, req.user.id,
      ]
    );

    res.json({ message: 'Produk berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memperbarui produk.' });
  }
};

const deleteProduk = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM produk WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'Produk tidak ditemukan.' });

    if (rows[0].foto_produk) {
      const fotoPath = path.join(__dirname, '../uploads/produk', rows[0].foto_produk);
      if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
    }

    await db.query('DELETE FROM produk WHERE id = ?', [req.params.id]);
    res.json({ message: 'Produk berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus produk.' });
  }
};

const getLowStock = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, k.nama_kategori FROM produk p
       LEFT JOIN kategori k ON p.kategori_id = k.id
       WHERE p.user_id = ? AND p.stok < p.stok_minimum ORDER BY p.stok ASC`,
      [req.user.id]
    );
    res.json(rows.map((p) => ({ ...p, foto_produk: fotoUrl(p.foto_produk) })));
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data stok rendah.' });
  }
};

const getAllKategori = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM kategori WHERE user_id = ? ORDER BY nama_kategori', [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil kategori.' });
  }
};

const createKategori = async (req, res) => {
  try {
    const { nama_kategori } = req.body;
    if (!nama_kategori)
      return res.status(400).json({ message: 'Nama kategori wajib diisi.' });

    const [result] = await db.query(
      'INSERT INTO kategori (user_id, nama_kategori) VALUES (?, ?)',
      [req.user.id, nama_kategori]
    );
    res.status(201).json({ message: 'Kategori berhasil ditambahkan.', id: result.insertId, nama_kategori });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menambahkan kategori.' });
  }
};

const deleteKategori = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM kategori WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Kategori tidak ditemukan.' });

    await db.query('UPDATE produk SET kategori_id = NULL WHERE kategori_id = ?', [req.params.id]);
    await db.query('DELETE FROM kategori WHERE id = ?', [req.params.id]);
    res.json({ message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus kategori.' });
  }
};

const stokMasuk = async (req, res) => {
  try {
    const { produk_id, jumlah, keterangan } = req.body;
    if (!produk_id || !jumlah || jumlah <= 0)
      return res.status(400).json({ message: 'Produk dan jumlah wajib diisi.' });

    const [rows] = await db.query('SELECT * FROM produk WHERE id = ? AND user_id = ?', [produk_id, req.user.id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'Produk tidak ditemukan.' });

    await db.query('UPDATE produk SET stok = stok + ? WHERE id = ?', [jumlah, produk_id]);
    await db.query(
      'INSERT INTO stok_log (produk_id, jenis, jumlah, keterangan) VALUES (?, ?, ?, ?)',
      [produk_id, 'masuk', jumlah, keterangan || 'Stok masuk']
    );
    res.json({ message: `Stok berhasil ditambah sebanyak ${jumlah}.` });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menambah stok.' });
  }
};

const stokKeluar = async (req, res) => {
  try {
    const { produk_id, jumlah, keterangan } = req.body;
    if (!produk_id || !jumlah || jumlah <= 0)
      return res.status(400).json({ message: 'Produk dan jumlah wajib diisi.' });

    const [rows] = await db.query('SELECT * FROM produk WHERE id = ? AND user_id = ?', [produk_id, req.user.id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'Produk tidak ditemukan.' });

    if (rows[0].stok < jumlah)
      return res.status(400).json({ message: 'Stok tidak mencukupi.' });

    await db.query('UPDATE produk SET stok = stok - ? WHERE id = ?', [jumlah, produk_id]);
    await db.query(
      'INSERT INTO stok_log (produk_id, jenis, jumlah, keterangan) VALUES (?, ?, ?, ?)',
      [produk_id, 'keluar', jumlah, keterangan || 'Stok keluar']
    );
    res.json({ message: `Stok berhasil dikurangi sebanyak ${jumlah}.` });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengurangi stok.' });
  }
};

const getRiwayatStok = async (req, res) => {
  try {
    const [produk] = await db.query(
      'SELECT id, nama_produk FROM produk WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (produk.length === 0)
      return res.status(404).json({ message: 'Produk tidak ditemukan.' });

    const [logs] = await db.query(
      'SELECT * FROM stok_log WHERE produk_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ produk: produk[0], riwayat: logs });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil riwayat stok.' });
  }
};

module.exports = {
  getAllProduk, createProduk, updateProduk, deleteProduk, getLowStock,
  getAllKategori, createKategori, deleteKategori,
  stokMasuk, stokKeluar, getRiwayatStok,
};