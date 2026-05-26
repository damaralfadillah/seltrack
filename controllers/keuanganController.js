const db = require('../config/db');

const getPemasukan = async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    let query = `SELECT pm.*, p.nama_produk FROM pemasukan pm
      LEFT JOIN produk p ON pm.produk_id = p.id
      WHERE pm.user_id = ?`;
    const params = [req.user.id];

    if (dari) { query += ' AND pm.tanggal >= ?'; params.push(dari); }
    if (sampai) { query += ' AND pm.tanggal <= ?'; params.push(sampai); }
    query += ' ORDER BY pm.tanggal DESC, pm.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data pemasukan.' });
  }
};

const createPemasukan = async (req, res) => {
  try {
    const { produk_id, jumlah_terjual, harga_satuan, keterangan, tanggal } = req.body;
    if (!harga_satuan || !tanggal)
      return res.status(400).json({ message: 'Harga satuan dan tanggal wajib diisi.' });

    const qty = jumlah_terjual || 1;
    const total = qty * harga_satuan;

    const [result] = await db.query(
      `INSERT INTO pemasukan (user_id, produk_id, jumlah_terjual, harga_satuan, total, keterangan, tanggal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, produk_id || null, qty, harga_satuan, total, keterangan || null, tanggal]
    );
    res.status(201).json({ message: 'Pemasukan berhasil dicatat.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mencatat pemasukan.' });
  }
};

const deletePemasukan = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id FROM pemasukan WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Data pemasukan tidak ditemukan.' });

    await db.query('DELETE FROM pemasukan WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pemasukan berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus pemasukan.' });
  }
};

const getPengeluaran = async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    let query = 'SELECT * FROM pengeluaran WHERE user_id = ?';
    const params = [req.user.id];

    if (dari) { query += ' AND tanggal >= ?'; params.push(dari); }
    if (sampai) { query += ' AND tanggal <= ?'; params.push(sampai); }
    query += ' ORDER BY tanggal DESC, created_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data pengeluaran.' });
  }
};

const createPengeluaran = async (req, res) => {
  try {
    const { kategori_pengeluaran, nominal, keterangan, tanggal } = req.body;
    if (!kategori_pengeluaran || !nominal || !tanggal)
      return res.status(400).json({ message: 'Kategori, nominal, dan tanggal wajib diisi.' });

    const [result] = await db.query(
      `INSERT INTO pengeluaran (user_id, kategori_pengeluaran, nominal, keterangan, tanggal)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, kategori_pengeluaran, nominal, keterangan || null, tanggal]
    );
    res.status(201).json({ message: 'Pengeluaran berhasil dicatat.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mencatat pengeluaran.' });
  }
};

const deletePengeluaran = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id FROM pengeluaran WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Data pengeluaran tidak ditemukan.' });

    await db.query('DELETE FROM pengeluaran WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pengeluaran berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus pengeluaran.' });
  }
};

const getSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const bulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [[pemasukanBulan]] = await db.query(
      `SELECT COALESCE(SUM(total), 0) as total FROM pemasukan
       WHERE user_id = ? AND DATE_FORMAT(tanggal, '%Y-%m') = ?`,
      [userId, bulanIni]
    );
    const [[pengeluaranBulan]] = await db.query(
      `SELECT COALESCE(SUM(nominal), 0) as total FROM pengeluaran
       WHERE user_id = ? AND DATE_FORMAT(tanggal, '%Y-%m') = ?`,
      [userId, bulanIni]
    );
    const [[pemasukanAll]] = await db.query(
      'SELECT COALESCE(SUM(total), 0) as total FROM pemasukan WHERE user_id = ?', [userId]
    );
    const [[pengeluaranAll]] = await db.query(
      'SELECT COALESCE(SUM(nominal), 0) as total FROM pengeluaran WHERE user_id = ?', [userId]
    );

    res.json({
      bulan_ini: {
        pemasukan: pemasukanBulan.total,
        pengeluaran: pengeluaranBulan.total,
        profit: pemasukanBulan.total - pengeluaranBulan.total,
      },
      keseluruhan: {
        pemasukan: pemasukanAll.total,
        pengeluaran: pengeluaranAll.total,
        profit: pemasukanAll.total - pengeluaranAll.total,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil ringkasan keuangan.' });
  }
};

module.exports = {
  getPemasukan, createPemasukan, deletePemasukan,
  getPengeluaran, createPengeluaran, deletePengeluaran,
  getSummary,
};
