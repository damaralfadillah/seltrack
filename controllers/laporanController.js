const db = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getLaporanKeuangan = async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    const userId = req.user.id;
    const params = [userId];
    const extraParams = [];

    if (dari) extraParams.push(dari);
    if (sampai) extraParams.push(sampai);

    let pmQuery = 'SELECT tanggal, keterangan, total as nominal, "pemasukan" as jenis FROM pemasukan WHERE user_id = ?';
    let peQuery = 'SELECT tanggal, keterangan, nominal, "pengeluaran" as jenis FROM pengeluaran WHERE user_id = ?';

    if (dari) { pmQuery += ' AND tanggal >= ?'; peQuery += ' AND tanggal >= ?'; }
    if (sampai) { pmQuery += ' AND tanggal <= ?'; peQuery += ' AND tanggal <= ?'; }

    const [pemasukan] = await db.query(pmQuery, [...params, ...extraParams]);
    const [pengeluaran] = await db.query(peQuery, [...params, ...extraParams]);

    const all = [...pemasukan, ...pengeluaran].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    let saldo = 0;
    const rekap = all.map((item) => {
      saldo += item.jenis === 'pemasukan' ? Number(item.nominal) : -Number(item.nominal);
      return { ...item, saldo };
    });

    const totalPemasukan = pemasukan.reduce((s, i) => s + Number(i.nominal), 0);
    const totalPengeluaran = pengeluaran.reduce((s, i) => s + Number(i.nominal), 0);

    res.json({
      rekap,
      total_pemasukan: totalPemasukan,
      total_pengeluaran: totalPengeluaran,
      profit: totalPemasukan - totalPengeluaran,
    });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil laporan keuangan.' });
  }
};

const getLaporanStok = async (req, res) => {
  try {
    const [produk] = await db.query(
      `SELECT p.id, p.nama_produk, p.stok as stok_akhir,
       COALESCE(SUM(CASE WHEN sl.jenis = 'masuk' THEN sl.jumlah END), 0) as total_masuk,
       COALESCE(SUM(CASE WHEN sl.jenis = 'keluar' THEN sl.jumlah END), 0) as total_keluar
       FROM produk p
       LEFT JOIN stok_log sl ON p.id = sl.produk_id
       WHERE p.user_id = ?
       GROUP BY p.id ORDER BY p.nama_produk`,
      [req.user.id]
    );

    res.json(produk.map((p) => ({
      ...p,
      stok_awal: Number(p.stok_akhir) + Number(p.total_keluar) - Number(p.total_masuk),
    })));
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil laporan stok.' });
  }
};

const exportPDF = async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    const userId = req.user.id;
    const [[user]] = await db.query('SELECT nama, nama_toko FROM users WHERE id = ?', [userId]);

    const params = [userId];
    const extra = [];
    if (dari) extra.push(dari);
    if (sampai) extra.push(sampai);

    let pmQ = 'SELECT * FROM pemasukan WHERE user_id = ?';
    let peQ = 'SELECT * FROM pengeluaran WHERE user_id = ?';
    if (dari) { pmQ += ' AND tanggal >= ?'; peQ += ' AND tanggal >= ?'; }
    if (sampai) { pmQ += ' AND tanggal <= ?'; peQ += ' AND tanggal <= ?'; }

    const [pemasukan] = await db.query(pmQ, [...params, ...extra]);
    const [pengeluaran] = await db.query(peQ, [...params, ...extra]);

    const totalPm = pemasukan.reduce((s, i) => s + Number(i.total), 0);
    const totalPe = pengeluaran.reduce((s, i) => s + Number(i.nominal), 0);
    const fmt = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="laporan-keuangan.pdf"');
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('LAPORAN KEUANGAN', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(user.nama_toko || user.nama, { align: 'center' });
    doc.fontSize(10).text(`Periode: ${dari || 'Semua'} s/d ${sampai || 'Semua'}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text('RINGKASAN');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Pemasukan  : ${fmt(totalPm)}`);
    doc.text(`Total Pengeluaran: ${fmt(totalPe)}`);
    doc.text(`Profit           : ${fmt(totalPm - totalPe)}`);
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text('PEMASUKAN');
    doc.fontSize(9).font('Helvetica');
    pemasukan.forEach((item, i) => {
      doc.text(`${i + 1}. ${item.tanggal} | ${item.keterangan || '-'} | ${fmt(item.total)}`);
    });
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text('PENGELUARAN');
    doc.fontSize(9).font('Helvetica');
    pengeluaran.forEach((item, i) => {
      doc.text(`${i + 1}. ${item.tanggal} | ${item.kategori_pengeluaran} - ${item.keterangan || '-'} | ${fmt(item.nominal)}`);
    });

    doc.moveDown();
    doc.fontSize(8).text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, { align: 'right' });
    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Gagal membuat laporan PDF.' });
  }
};

const exportExcel = async (req, res) => {
  try {
    const { dari, sampai } = req.query;
    const userId = req.user.id;
    const [[user]] = await db.query('SELECT nama, nama_toko FROM users WHERE id = ?', [userId]);

    const params = [userId];
    const extra = [];
    if (dari) extra.push(dari);
    if (sampai) extra.push(sampai);

    let pmQ = 'SELECT * FROM pemasukan WHERE user_id = ?';
    let peQ = 'SELECT * FROM pengeluaran WHERE user_id = ?';
    if (dari) { pmQ += ' AND tanggal >= ?'; peQ += ' AND tanggal >= ?'; }
    if (sampai) { pmQ += ' AND tanggal <= ?'; peQ += ' AND tanggal <= ?'; }

    const [pemasukan] = await db.query(pmQ, [...params, ...extra]);
    const [pengeluaran] = await db.query(peQ, [...params, ...extra]);

    const workbook = new ExcelJS.Workbook();

    const sheetPm = workbook.addWorksheet('Pemasukan');
    sheetPm.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Tanggal', key: 'tanggal', width: 15 },
      { header: 'Keterangan', key: 'keterangan', width: 30 },
      { header: 'Jumlah Terjual', key: 'jumlah_terjual', width: 15 },
      { header: 'Harga Satuan', key: 'harga_satuan', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
    ];
    pemasukan.forEach((item, i) => sheetPm.addRow({ no: i + 1, ...item }));
    sheetPm.getRow(1).font = { bold: true };

    const sheetPe = workbook.addWorksheet('Pengeluaran');
    sheetPe.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Tanggal', key: 'tanggal', width: 15 },
      { header: 'Kategori', key: 'kategori_pengeluaran', width: 20 },
      { header: 'Keterangan', key: 'keterangan', width: 30 },
      { header: 'Nominal', key: 'nominal', width: 15 },
    ];
    pengeluaran.forEach((item, i) => sheetPe.addRow({ no: i + 1, ...item }));
    sheetPe.getRow(1).font = { bold: true };

    const totalPm = pemasukan.reduce((s, i) => s + Number(i.total), 0);
    const totalPe = pengeluaran.reduce((s, i) => s + Number(i.nominal), 0);
    const sheetSum = workbook.addWorksheet('Summary');
    sheetSum.addRows([
      ['Toko', user.nama_toko || user.nama],
      ['Total Pemasukan', totalPm],
      ['Total Pengeluaran', totalPe],
      ['Profit', totalPm - totalPe],
    ]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="laporan-keuangan.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: 'Gagal membuat laporan Excel.' });
  }
};

module.exports = { getLaporanKeuangan, getLaporanStok, exportPDF, exportExcel };