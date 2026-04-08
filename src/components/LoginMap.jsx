import React from 'react';

const cityData = [
    { label: "Beach city", icon: "🏖️", left: "5%", top: "67%" },
    { label: "Flower city", icon: "🌷", left: "32%", top: "32%", anim: "anim-grow" },
    { label: "Surf city", icon: "🏄", left: "58%", top: "83%", anim: "anim-slidein" },
    { label: "Capital city", icon: "🏛️", left: "65%", top: "22%" },
    { label: "Funland", icon: "🎢", left: "87%", top: "58%" },
    { label: "Coast city", icon: "🌊", left: "94%", top: "38%", anim: "anim-slidein" },
];

const LoginMap = () => {
    return (
        <div className="relative w-full aspect-square">
            {/* Map Background with clipping */}
            <div className="w-full h-full rounded-lg overflow-hidden shadow-lg">
                <svg viewBox="0 0 500 500" className="w-full h-full">
                    <rect style={{ fill: '#f5f0e5' }} width={500} height={500} />
                    <path style={{ fill: '#90daee' }} d="M0,367.82c5.83-4.39,14.42-10.16,25.59-15.34,4.52-2.09,43.19-19.51,79.55-11.93,36.1,7.52,35.75,32.55,78.41,60.23,46.34,30.06,109.47,41.21,123.32,22.1,11.95-16.49-22.61-41.92-13.66-84.6,4.85-23.1,22.33-50.71,47.73-58.52,42.42-13.05,78.83,39.45,102.84,23.86,15.81-10.26.01-32.87,22.73-74.43,5.8-10.62,11.65-21.15,11.93-36.93.28-15.69-5.63-26.64-7.95-32.39-6.66-16.45-6.21-45.15,28.84-98.55.23,146.23.46,292.46.69,438.69H0v-132.18Z" />
                </svg>
            </div>

            {/* Cities Container - positioned absolutely to match map but allows overflow for labels */}
            <div className="absolute inset-0 w-full h-full">
                {cityData.map((city, idx) => (
                    <div
                        key={city.label}
                        className="absolute group cursor-pointer"
                        style={{
                            left: city.left,
                            top: city.top,
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        {/* Pin */}
                        <div className="relative">
                            <div className="text-lg transition-transform duration-300 group-hover:scale-110 group-hover:translate-y-1">
                                📍
                            </div>
                        </div>

                        {/* Label that appears on hover */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                            <div className="bg-teal-600 text-white px-3 py-2 rounded border-2 border-white shadow-lg whitespace-nowrap flex items-center gap-2 text-sm font-bold">
                                <span>{city.icon}</span>
                                <span>{city.label}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LoginMap;