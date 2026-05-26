const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'seltrack',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL terhubung ke database:', process.env.DB_NAME);
    connection.release();
  } catch (err) {
    console.error('❌ Gagal koneksi MySQL:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;