import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        phone: '',
        role: 'Customer'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
            await axios.post(`${API_BASE_URL}/api/register`, formData, {
                withCredentials: true
            });
            navigate('/login');
        } catch (err) {
            console.error('Registration error:', err);
            const msg = err.response?.data?.details
                ? `${err.response.data.message}: ${err.response.data.details}`
                : (err.response?.data?.message || 'Registration failed. Is the backend URL correct?');
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <h1 className="auth-title">Kodbank</h1>
            <p className="auth-subtitle">Create your secure bank account</p>

            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Username</label>
                    <input type="text" name="username" value={formData.username} onChange={handleChange} required placeholder="Choose a username" />
                </div>

                <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="your@email.com" />
                </div>

                <div className="form-group">
                    <label>Password</label>
                    <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="••••••••" />
                </div>

                <div className="form-group">
                    <label>Phone Number</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" />
                </div>

                <div className="form-group">
                    <label>Role</label>
                    <select name="role" value={formData.role} onChange={handleChange} disabled>
                        <option value="Customer">Customer</option>
                    </select>
                </div>

                <button type="submit" className="btn" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Register Now'}
                </button>
            </form>

            <p className="link-text">
                Already have an account? <Link to="/login">Sign In</Link>
            </p>
        </div>
    );
}
