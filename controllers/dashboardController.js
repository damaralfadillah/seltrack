const db = require('../config/db');

const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const bulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [[stokInfo]] = await db.query(
      `SELECT COUNT(*) as total_produk, COALESCE(SUM(stok), 0) as total_stok,
       COUNT(CASE WHEN stok < stok_minimum THEN 1 END) as stok_menipis
       FROM produk WHERE user_id = ?`,
      [userId]
    );

    const [[pemasukan]] = await db.query(
      `SELECT COALESCE(SUM(total), 0) as total FROM pemasukan
       WHERE user_id = ? AND DATE_FORMAT(tanggal, '%Y-%m') = ?`,
      [userId, bulanIni]
    );

    const [[pengeluaran]] = await db.query(
      `SELECT COALESCE(SUM(nominal), 0) as total FROM pengeluaran
       WHERE user_id = ? AND DATE_FORMAT(tanggal, '%Y-%m') = ?`,
      [userId, bulanIni]
    );

    const [grafik7Hari] = await db.query(
      `SELECT DATE(tanggal) as tanggal, COALESCE(SUM(total), 0) as total
       FROM pemasukan
       WHERE user_id = ? AND tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(tanggal) ORDER BY tanggal ASC`,
      [userId]
    );

    const grafikData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = grafik7Hari.find((g) => {
        const gDate = new Date(g.tanggal).toISOString().split('T')[0];
        return gDate === dateStr;
      });
      grafikData.push({
        tanggal: dateStr,
        label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
        total: found ? Number(found.total) : 0,
      });
    }

    const [topProduk] = await db.query(
      `SELECT p.id, p.nama_produk, p.foto_produk,
       COALESCE(SUM(pm.jumlah_terjual), 0) as total_terjual,
       COALESCE(SUM(pm.total), 0) as total_pendapatan
       FROM produk p
       LEFT JOIN pemasukan pm ON p.id = pm.produk_id
       WHERE p.user_id = ?
       GROUP BY p.id ORDER BY total_terjual DESC LIMIT 5`,
      [userId]
    );

    const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

    const [stokMenipis] = await db.query(
      `SELECT id, nama_produk, stok, stok_minimum FROM produk
       WHERE user_id = ? AND stok < stok_minimum ORDER BY stok ASC LIMIT 10`,
      [userId]
    );

    const [pesananTerbaru] = await db.query(
      `SELECT id, nomor_pesanan, nama_pembeli, status, total_harga, tanggal_pesanan
       FROM pesanan WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    res.json({
      stok: stokInfo,
      keuangan: {
        pemasukan: pemasukan.total,
        pengeluaran: pengeluaran.total,
        profit: pemasukan.total - pengeluaran.total,
      },
      grafik: grafikData,
      top_produk: topProduk.map((p) => ({
        ...p,
        foto_produk: p.foto_produk ? `${BASE_URL}/uploads/produk/${p.foto_produk}` : null,
      })),
      stok_menipis: stokMenipis,
      pesanan_terbaru: pesananTerbaru,
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).json({ message: 'Gagal mengambil data dashboard.' });
  }
};

module.exports = { getDashboard };