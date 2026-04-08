// src/components/SessionExpiredModal.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SessionExpiredModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { logout } = useAuth();

    if (!isOpen) {
        return null;
    }

    const handleRedirect = () => {
        logout();
        onClose();
        navigate('/login');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
            <div
                className="rounded-2xl p-8 shadow-xl w-full max-w-md text-center"
                style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}
            >
                <h2 className="text-white text-2xl font-bold mb-4">Session Expired</h2>
                <p className="text-gray-300 mb-8">Your session has expired. Please log in again to continue.</p>

                {/* --- MODIFICATION START --- */}
                {/* Wrapper for the buttons */}
                <div className="flex justify-center space-x-4">
                    {/* Cancel Button */}
                    <button
                        onClick={onClose} // Simply closes the modal
                        className="px-8 py-2 bg-transparent text-white text-sm font-medium rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors"
                    >
                        Cancel
                    </button>

                    {/* Go to Login Button */}
                    <button
                        onClick={handleRedirect}
                        className="px-8 py-2 bg-gray-300 hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors"
                    >
                        Go to Login
                    </button>
                </div>
                {/* --- MODIFICATION END --- */}

            </div>
        </div>
    );
};

export default SessionExpiredModal;