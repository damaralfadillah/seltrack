const db = require('../config/db');

const getPesanan = async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT ps.*, COUNT(pd.id) as jumlah_item
      FROM pesanan ps
      LEFT JOIN pesanan_detail pd ON ps.id = pd.pesanan_id
      WHERE ps.user_id = ?`;
    const params = [req.user.id];

    if (status) { query += ' AND ps.status = ?'; params.push(status); }
    query += ' GROUP BY ps.id ORDER BY ps.created_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil data pesanan.' });
  }
};

const getPesananById = async (req, res) => {
  try {
    const [pesanan] = await db.query(
      'SELECT * FROM pesanan WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
    );
    if (pesanan.length === 0)
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });

    const [detail] = await db.query(
      `SELECT pd.*, p.nama_produk FROM pesanan_detail pd
       JOIN produk p ON pd.produk_id = p.id
       WHERE pd.pesanan_id = ?`,
      [req.params.id]
    );
    res.json({ ...pesanan[0], detail });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil detail pesanan.' });
  }
};

const createPesanan = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { nomor_pesanan, nama_pembeli, tanggal_pesanan, detail } = req.body;

    if (!nomor_pesanan || !nama_pembeli || !tanggal_pesanan || !detail?.length) {
      await conn.rollback();
      return res.status(400).json({ message: 'Semua field pesanan wajib diisi.' });
    }

    let total_harga = 0;
    for (const item of detail) {
      total_harga += item.jumlah * item.harga_satuan;
    }

    const [pesananResult] = await conn.query(
      `INSERT INTO pesanan (user_id, nomor_pesanan, nama_pembeli, total_harga, tanggal_pesanan)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, nomor_pesanan, nama_pembeli, total_harga, tanggal_pesanan]
    );
    const pesananId = pesananResult.insertId;

    for (const item of detail) {
      const subtotal = item.jumlah * item.harga_satuan;

      const [[produk]] = await conn.query(
        'SELECT stok FROM produk WHERE id = ? AND user_id = ?', [item.produk_id, req.user.id]
      );
      if (!produk) {
        await conn.rollback();
        return res.status(404).json({ message: `Produk ID ${item.produk_id} tidak ditemukan.` });
      }
      if (produk.stok < item.jumlah) {
        await conn.rollback();
        return res.status(400).json({ message: `Stok tidak mencukupi untuk produk ID ${item.produk_id}.` });
      }

      await conn.query(
        `INSERT INTO pesanan_detail (pesanan_id, produk_id, jumlah, harga_satuan, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [pesananId, item.produk_id, item.jumlah, item.harga_satuan, subtotal]
      );
      await conn.query('UPDATE produk SET stok = stok - ? WHERE id = ?', [item.jumlah, item.produk_id]);
      await conn.query(
        'INSERT INTO stok_log (produk_id, jenis, jumlah, keterangan) VALUES (?, ?, ?, ?)',
        [item.produk_id, 'keluar', item.jumlah, `Pesanan #${nomor_pesanan}`]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Pesanan berhasil dibuat.', pesananId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Gagal membuat pesanan.' });
  } finally {
    conn.release();
  }
};

const updateStatusPesanan = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatus = ['diproses', 'dikirim', 'selesai', 'dibatalkan'];
    if (!validStatus.includes(status))
      return res.status(400).json({ message: 'Status tidak valid.' });

    const [rows] = await db.query(
      'SELECT id FROM pesanan WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });

    await db.query('UPDATE pesanan SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status pesanan berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memperbarui status pesanan.' });
  }
};

const deletePesanan = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id FROM pesanan WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });

    await db.query('DELETE FROM pesanan WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pesanan berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus pesanan.' });
  }
};

module.exports = { getPesanan, getPesananById, createPesanan, updateStatusPesanan, deletePesanan };