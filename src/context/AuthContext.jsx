// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('accessToken'));
    const [userRole, setUserRole] = useState(localStorage.getItem('userRole'));
    const [isSessionExpired, setIsSessionExpired] = useState(false);

    useEffect(() => {
        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
    }, [token]);

    const login = async (email, password) => {
        try {
            const params = new URLSearchParams();
            params.append('username', email);
            params.append('password', password);

            const response = await api.post('/token', params);
            const { access_token } = response.data;
            const decodedToken = jwtDecode(access_token);
            const role = decodedToken.role;

            localStorage.setItem('accessToken', access_token);
            localStorage.setItem('userRole', role);

            setToken(access_token);
            setUserRole(role);
            setIsSessionExpired(false);

            api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            return true;
        } catch (error) {
            console.error("Login failed:", error);
            return false;
        }
    };

    const loginWithMicrosoftToken = async (msAccessToken) => {
        try {
            // Send the MICROSOFT token to backend for verification
            const response = await api.post('/auth/microsoft', { 
                access_token: msAccessToken 
            });

            // Backend verified it and sent us OUR App Token
            const { access_token } = response.data;
            const decodedToken = jwtDecode(access_token);
            const role = decodedToken.role;

            // Save session
            localStorage.setItem('accessToken', access_token);
            localStorage.setItem('userRole', role);

            setToken(access_token);
            setUserRole(role);
            setIsSessionExpired(false);

            api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            return true; 

        } catch (error) {
            console.error("Secure Microsoft Login Failed:", error);
            // If error is 403, it means user is not in DB
            if (error.response && error.response.status === 403) {
                alert(error.response.data.detail); // "User not registered..."
            }
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userRole');
        setToken(null);
        setUserRole(null);
        delete api.defaults.headers.common['Authorization'];
    };

    // --- MODIFICATION START ---
    // This function will now ONLY set the state to show the modal.
    // It will NOT log the user out immediately, preventing the premature redirect.
    const handleSessionExpired = () => {
        setIsSessionExpired(true);
    };
    // --- MODIFICATION END ---

    const value = { token, userRole, login, loginWithMicrosoftToken, logout, isSessionExpired, setIsSessionExpired, handleSessionExpired };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    return useContext(AuthContext);
};