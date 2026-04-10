// src/pages/LoginPage.jsx

import React, { useState, useEffect } from 'react'; // Added useEffect
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoginMap from '../components/LoginMap.jsx';
import logo from '../assets/logo.png';
import { msalInstance } from '../authConfig';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login, loginWithMicrosoftToken } = useAuth();

    useEffect(() => {
        const initializeMsal = async () => {
            try {
                if (!msalInstance.getActiveAccount()) {
                    await msalInstance.initialize();
                }
            } catch (e) {
                console.error("MSAL Init Error:", e);
            }
        };
        initializeMsal();
    }, []);

    // 2. Microsoft Login Handler
    const handleMicrosoftLogin = async () => {
        setError('');
        try {
            const loginResponse = await msalInstance.loginPopup({
                scopes: ["User.Read", "email"],
                prompt: "select_account"
            });

            // 1. Get the Access Token from Microsoft
            const msAccessToken = loginResponse.accessToken;

            if (msAccessToken) {
                console.log("Got Microsoft Token. Verifying with Backend...");
                
                // 2. Send Token to Backend for secure verification
                const success = await loginWithMicrosoftToken(msAccessToken);
                
                if (success) {
                    navigate('/map');
                } else {
                    // Specific error (e.g. "User not found") is handled in Context via alert
                    setError("Login Failed. Please ensure your account is registered.");
                }
            }
        } catch (err) {
            console.error("Microsoft Login Error:", err);
            setError("Microsoft login was canceled or failed.");
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const success = await login(email, password);

        setLoading(false);

        if (success) {
            navigate('/map');
        } else {
            setError('Invalid email or password. Please try again.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{backgroundColor: '#0b0b0b'}}>
            <div className={"fixed w-full flex justify-center z-50 bottom-[16px] text-gray-500"}>
                Developed by H-One - a Dialog Company
            </div>
            <div className="w-full max-w-4xl -mt-16">
                {<div className={"w-full flex justify-center"}>
                    <img src={logo} className={"w-[210px] mb-0 h-28 "}/>
                </div>}
                <h2 className="text-white text-4xl font-medium mb-8 text-center">Welcome Back To Crowd Analytics!</h2>
                <div
                    className="rounded-3xl p-12 shadow-xl"
                    style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}
                >
                    <div className="grid grid-cols-2 gap-16 items-center">
                        <div>
                            <LoginMap />
                        </div>
                        
                        <form onSubmit={handleLogin} className="flex flex-col space-y-4">
                            <div className="mb-4">
                                <h1 className="text-white text-xl font-medium mb-2">Login to your account</h1>
                                <p className="text-gray-300 text-sm">Enter your email and password below.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-white text-sm font-medium">Email</label>
                                <input
                                    type="email"
                                    placeholder="enter your email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className="w-full p-2 rounded-lg border border-zinc-500 bg-transparent text-gray-300 focus:border-gray-400 focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-white text-sm font-medium">Password</label>
                                </div>
                                <input
                                    type="password"
                                    placeholder="enter your password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="w-full p-2 rounded-lg border border-zinc-500 bg-transparent text-gray-300 focus:border-gray-400 focus:outline-none transition-colors"
                                />
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm text-center pt-2">{error}</p>
                            )}

                            <button
                                type="submit" 
                                className="w-full bg-gray-300 hover:bg-gray-200 text-black py-2 rounded-lg font-medium transition-colors mt-6 disabled:opacity-50 disabled:cursor-wait"
                                disabled={loading}
                            >
                                {loading ? 'Logging in...' : 'Login'}
                            </button>
                            
                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-zinc-700"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">Or</span>
                                <div className="flex-grow border-t border-zinc-700"></div>
                            </div>

                            <button
                                type="button"
                                onClick={handleMicrosoftLogin}
                                className="w-full bg-[#2f2f2f] hover:bg-[#3f3f3f] text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center border border-zinc-600"
                            >
                                <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M0 0H10.8964V10.8964H0V0Z" fill="#F25022"/>
                                    <path d="M11.9863 0H22.8827V10.8964H11.9863V0Z" fill="#7FBA00"/>
                                    <path d="M0 11.9863H10.8964V22.8827H0V11.9863Z" fill="#00A4EF"/>
                                    <path d="M11.9863 11.9863H22.8827V22.8827H11.9863V11.9863Z" fill="#FFB900"/>
                                </svg>
                                Sign in with Microsoft
                            </button>

                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
