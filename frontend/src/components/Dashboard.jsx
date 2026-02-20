import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import confetti from 'canvas-confetti';

export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (!savedUser) {
            navigate('/login');
        } else {
            setUser(JSON.parse(savedUser));
        }
    }, [navigate]);

    const checkBalance = async () => {
        setLoading(true);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
            const res = await axios.get(`${API_BASE_URL}/api/balance`, {
                withCredentials: true
            });
            setBalance(res.data.balance);

            // Trigger party popper animation
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b']
            });
        } catch (err) {
            if (err.response?.status === 401 || err.response?.status === 403) {
                localStorage.removeItem('user');
                navigate('/login');
            }
            alert('Error fetching balance');
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (!user) return null;

    return (
        <div className="dashboard-container">
            <h1 className="auth-title">Welcome, {user.username}!</h1>
            <p className="auth-subtitle">Manage your Kodbank account securely</p>

            <div className="balance-card">
                {balance !== null ? (
                    <div>
                        <p style={{ color: 'var(--text-muted)' }}>Your Current Balance</p>
                        <h2 className="balance-amount">₹{parseFloat(balance).toLocaleString()}</h2>
                        <p style={{ fontSize: '0.9rem', color: '#10b981' }}>Your balance is : {balance}</p>
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-muted)' }}>Click below to view your account balance</p>
                )}
            </div>

            <button className="btn" onClick={checkBalance} disabled={loading}>
                {loading ? 'Fetching Balance...' : 'Check Balance'}
            </button>

            <button
                className="btn"
                onClick={logout}
                style={{ background: 'transparent', border: '1px solid var(--glass-border)', marginTop: '1rem' }}
            >
                Sign Out
            </button>
        </div>
    );
}
