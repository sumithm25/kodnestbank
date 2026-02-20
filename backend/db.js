const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to Aiven MySQL');

    // Create KodUser table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS KodUser (
        uid INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        balance DECIMAL(15, 2) DEFAULT 100000.00,
        phone VARCHAR(20),
        role ENUM('Customer', 'Manager', 'Admin') DEFAULT 'Customer'
      )
    `);
    console.log('KodUser table verified');

    // Create UserToken table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS UserToken (
        tid INT AUTO_INCREMENT PRIMARY KEY,
        token TEXT NOT NULL,
        uid INT NOT NULL,
        expiry DATETIME NOT NULL,
        FOREIGN KEY (uid) REFERENCES KodUser(uid) ON DELETE CASCADE
      )
    `);
    console.log('UserToken table verified');

    connection.release();
  } catch (error) {
    console.error('Database setup error:', error);
    process.exit(1);
  }
}

module.exports = { pool, setupDatabase };
