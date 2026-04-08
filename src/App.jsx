// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import MapPage from "./pages/MapPage.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SessionExpiredModal from "./components/SessionExpiredModal.jsx";
import { setupInterceptors } from './services/api.js';

function AppContent() {
    const { isSessionExpired, setIsSessionExpired, handleSessionExpired } = useAuth();

    useEffect(() => {
        setupInterceptors(handleSessionExpired);
    }, [handleSessionExpired]);

    return (
        <>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                    path="/map"
                    element={
                        <ProtectedRoute>
                            <MapPage />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
            <ToastContainer theme="dark" />
            <SessionExpiredModal
                isOpen={isSessionExpired}
                onClose={() => setIsSessionExpired(false)}
            />
        </>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;