const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();

// Aiven MySQL Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Database Setup Helper
async function ensureTables() {
    try {
        const connection = await pool.getConnection();
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
        await connection.query(`
            CREATE TABLE IF NOT EXISTS UserToken (
                tid INT AUTO_INCREMENT PRIMARY KEY,
                token TEXT NOT NULL,
                uid INT NOT NULL,
                expiry DATETIME NOT NULL,
                FOREIGN KEY (uid) REFERENCES KodUser(uid) ON DELETE CASCADE
            )
        `);
        connection.release();
    } catch (err) {
        console.error('API DB Init Error:', err);
    }
}

// 1. User Registration
app.post('/api/register', async (req, res) => {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Missing required fields' });

    try {
        await ensureTables();
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO KodUser (username, email, password, phone, role, balance) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, phone, 'Customer', 100000.00]
        );
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Username or Email already exists' });
        res.status(500).json({ message: 'Internal server error', details: error.message });
    }
});

// 2. User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Missing required fields' });

    try {
        await ensureTables();
        const [users] = await pool.query('SELECT * FROM KodUser WHERE username = ?', [username]);
        const user = users[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign({ username: user.username, role: user.role, uid: user.uid }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const expiry = new Date(Date.now() + 3600000);
        await pool.query('INSERT INTO UserToken (token, uid, expiry) VALUES (?, ?, ?)', [token, user.uid, expiry]);

        res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 3600000 });
        res.json({ message: 'Login successful', user: { uid: user.uid, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', details: error.message });
    }
});

// 3. Check Balance
app.get('/api/balance', async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Access denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [users] = await pool.query('SELECT balance FROM KodUser WHERE username = ?', [decoded.username]);
        if (!users[0]) return res.status(404).json({ message: 'User not found' });
        res.json({ balance: users[0].balance });
    } catch (error) {
        res.status(403).json({ message: 'Invalid token' });
    }
});

// Vercel Export
module.exports = app;
