// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ProtectedRoute = ({ children }) => {
    const { token } = useAuth();
    if (!token) {
        // User not authenticated, redirect to login page
        return <Navigate to="/login" />;
    }
    return children;
};

export default ProtectedRoute;