import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { ImSpinner2 } from 'react-icons/im';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function UserManagementModal({ isOpen, onClose }) {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // States for adding a new user
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('user');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    // State and Ref for the custom role dropdown
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const roleDropdownRef = useRef(null);

    const roleOptions = [
        { value: 'user', label: 'User' },
        { value: 'admin', label: 'Admin' },
    ];

    const selectedRoleLabel = roleOptions.find(option => option.value === newUserRole)?.label;

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/users/');
            setUsers(response.data);
        } catch (err) {
            // --- MODIFIED: More detailed error message ---
            const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch users.';
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // useEffect to close the role dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target)) {
                setIsRoleDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSuccessMessage('');
            // --- REMOVED: setError('') call ---
            loadUsers();
        }
    }, [isOpen]);

    const handleAddUser = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        setSuccessMessage('');
        try {
            const payload = { email: newUserEmail, role: newUserRole, password: newUserPassword };
            const response = await api.post('/users/', payload);
            setSuccessMessage(`User '${response.data.email}' was created successfully!`);
            toast.success(`User '${response.data.email}' created!`); // Added success toast

            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserRole('user');

            loadUsers();

            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (err) {
            // This part was already good, just ensuring consistency
            const errorMessage = err.response?.data?.detail || 'Failed to add user.';
            toast.error(errorMessage);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteUser = async (email) => {
        if (window.confirm(`Are you sure you want to delete user ${email}?`)) {
            try {
                await api.delete(`/users/${email}`);
                toast.success(`User '${email}' has been deleted.`); // Added success toast for delete
                loadUsers();
            } catch (err) {
                // --- MODIFIED: More detailed error message ---
                const errorMessage = err.response?.data?.detail || err.message || 'Failed to delete user.';
                toast.error(errorMessage);
            }
        }
    };

    const handleRoleSelect = (selectedValue) => {
        setNewUserRole(selectedValue);
        setIsRoleDropdownOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
            <div
                className="rounded-2xl p-6 shadow-xl w-full max-w-2xl flex flex-col"
                style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c', height: '80vh' }}
            >
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-white text-xl font-semibold">User Management</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <form onSubmit={handleAddUser} className="flex-shrink-0 mb-4 p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg flex flex-col md:flex-row gap-3 items-center">
                    <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="New user's email address"
                        required
                        className="w-full md:w-2/5 p-2 rounded-lg border border-zinc-500 bg-transparent text-gray-300 focus:border-gray-400 focus:outline-none transition-colors"
                    />
                    <input
                        type="text" // Changed to text to allow password visibility toggling in future
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Enter Password"
                        required
                        className="w-full md:w-1/3 p-2 rounded-lg border border-zinc-500 bg-transparent text-gray-300 focus:border-gray-400 focus:outline-none transition-colors"
                    />

                    {/* --- CUSTOM DROPDOWN COMPONENT --- */}
                    <div className="relative w-full md:w-auto" ref={roleDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                            className="w-full p-2 rounded-lg border border-zinc-500 bg-transparent text-gray-300 focus:border-gray-400 focus:outline-none transition-colors flex justify-between items-center"
                        >
                            <span>{selectedRoleLabel}</span>
                            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {isRoleDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 rounded-md shadow-lg" style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}>
                                {roleOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleRoleSelect(option.value)}
                                        className="w-full px-3 py-2 text-left text-white hover:bg-zinc-800 focus:outline-none"
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isAdding || !newUserEmail || !newUserPassword}
                        className="w-full md:w-auto px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-200 text-black flex items-center justify-center min-w-[100px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAdding ? (
                            <>
                                <ImSpinner2 className="animate-spin h-5 w-5 mr-2" />
                                <span>Adding...</span>
                            </>
                        ) : 'Add User'}
                    </button>
                </form>

                {successMessage && <div className="flex-shrink-0 p-3 mb-4 bg-green-900/50 border border-green-700 rounded-lg text-sm text-green-200">{successMessage}</div>}

                <div className="flex-grow overflow-y-auto border border-zinc-700 rounded-lg">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <ImSpinner2 className="animate-spin h-8 w-8 text-white" />
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-zinc-800/80 sticky top-0 backdrop-blur-sm">
                            <tr>
                                <th scope="col" className="px-4 py-3">Email</th>
                                <th scope="col" className="px-4 py-3">Role</th>
                                <th scope="col" className="px-4 py-3 text-right">Actions</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-700">
                            {users.map(user => (
                                <tr key={user.email} className="hover:bg-zinc-800/50">
                                    <td className="px-4 py-3 font-medium text-white">{user.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDeleteUser(user.email)}
                                            className="font-medium text-red-500 hover:text-red-400 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}