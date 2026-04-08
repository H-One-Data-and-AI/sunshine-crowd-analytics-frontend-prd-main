// src/components/ProgressBar.jsx
import React from 'react';

export default function ProgressBar({ progress, label }) {
    return (
        <div className="w-full my-3">
            <p className="text-white text-sm mb-1 text-left">{label}: {progress}%</p>
            <div className="w-full bg-zinc-700 rounded-full h-2">
                <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
}