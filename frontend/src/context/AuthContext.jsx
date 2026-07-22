import { createContext, useContext, useState } from 'react';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => {
       return localStorage.getItem('token');
    });

    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });

    function login(newToken, newUser) {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }

    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }

    return <AuthContext.Provider value={{ token, user, login, logout }}>
        {children}
    </AuthContext.Provider>
}

export function useAuth() {
    return useContext(AuthContext);
}