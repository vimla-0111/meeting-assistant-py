import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(params) {
        params.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await client.post('/auth/login', { email, password });
            login(response.data.access_token, response.data.user);
            navigate('/dashboard');

        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to login');
        }
        finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
            <h2>Login to Meeting Assistant</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}

