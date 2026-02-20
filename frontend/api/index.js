const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Switched to bcryptjs for serverless compatibility
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

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Database Setup Helper
async function ensureTables() {
    console.log('Ensuring tables exist...');
    try {
        const connection = await pool.getConnection();
        console.log('DB Connection obtained.');
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
        console.log('Tables verified.');
    } catch (err) {
        console.error('CRITICAL: API DB Init Error:', err);
        throw err; // Re-throw to be caught by request handler
    }
}

// 0. Diagnostic Endpoint (for debugging 500 errors)
app.get('/api/diag', async (req, res) => {
    const configStatus = {
        DB_HOST: !!process.env.DB_HOST,
        DB_PORT: !!process.env.DB_PORT,
        DB_USER: !!process.env.DB_USER,
        DB_PASSWORD: !!process.env.DB_PASSWORD,
        DB_NAME: !!process.env.DB_NAME,
        JWT_SECRET: !!process.env.JWT_SECRET,
        NODE_ENV: process.env.NODE_ENV
    };

    let dbStatus = 'Not tested';
    let dbError = null;

    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        dbStatus = 'Connected Successfully 🚀';
    } catch (err) {
        dbStatus = 'Failed to Connect ❌';
        dbError = {
            message: err.message,
            code: err.code,
            syscall: err.syscall,
            hostname: err.hostname
        };
    }

    res.json({
        message: 'Kodbank API Diagnostic Report',
        config: configStatus,
        database: {
            status: dbStatus,
            error: dbError
        },
        time: new Date().toISOString()
    });
});

// 1. User Registration
app.post('/api/register', async (req, res) => {
    console.log('Registration attempt:', req.body.username);
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Missing required fields' });

    try {
        await ensureTables();
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO KodUser (username, email, password, phone, role, balance) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, phone, 'Customer', 100000.00]
        );
        console.log('Registration success:', username);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Username or Email already exists' });
        // Return details to frontend for easier debugging
        res.status(500).json({
            message: 'Database/Server Error during registration',
            details: error.message,
            code: error.code
        });
    }
});

// 2. User Login
app.post('/api/login', async (req, res) => {
    console.log('Login attempt:', req.body.username);
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

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 3600000
        });
        console.log('Login success:', username);
        res.json({ message: 'Login successful', user: { uid: user.uid, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Database/Server Error during login',
            details: error.message,
            code: error.code
        });
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
        console.error('Balance check error:', error);
        res.status(403).json({ message: 'Invalid token' });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('UNHANDLED API ERROR:', err);
    res.status(500).json({ message: 'Internal server error', details: err.message });
});

// Vercel Export
module.exports = app;
