const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();
const { pool, setupDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://kodnestbank-n0scua8lh-sumith-ms-projects.vercel.app'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Initialize Database
setupDatabase();

// --- Routes ---

// 1. User Registration
app.post('/api/register', async (req, res) => {
    console.log('Registration request received:', req.body);
    const { username, email, password, phone } = req.body;

    if (!username || !email || !password) {
        console.log('Registration failed: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Inserting user into DB...');
        const [result] = await pool.query(
            'INSERT INTO KodUser (username, email, password, phone, role, balance) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, phone, 'Customer', 100000.00]
        );

        console.log('User registered successfully, ID:', result.insertId);
        res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log('Registration failed: Duplicate username or email');
            return res.status(400).json({ message: 'Username or Email already exists' });
        }
        console.error('Registration error details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 2. User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const [users] = await pool.query('SELECT * FROM KodUser WHERE username = ?', [username]);
        const user = users[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Generate JWT
        const token = jwt.sign(
            { username: user.username, role: user.role, uid: user.uid },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Save token to DB
        const expiry = new Date(Date.now() + 3600000); // 1 hour
        await pool.query(
            'INSERT INTO UserToken (token, uid, expiry) VALUES (?, ?, ?)',
            [token, user.uid, expiry]
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000 // 1 hour
        });

        res.json({
            message: 'Login successful',
            user: { uid: user.uid, username: user.username, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
        req.user = decoded;
        next();
    });
};

// 3. Check Balance
app.get('/api/balance', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT balance FROM KodUser WHERE username = ?', [req.user.username]);
        const user = users[0];

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({ balance: user.balance });
    } catch (error) {
        console.error('Balance check error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
