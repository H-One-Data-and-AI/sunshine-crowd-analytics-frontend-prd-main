import React from 'react';
import { ImSpinner2 } from 'react-icons/im';

const labelMapping = {
    Population: 'Population',
    Latch: 'Visitors',
    Bank: 'Bank & ATM Count',
    Pharmacy: 'Pharmacy Count',
    Fuel_Station: 'Fuel Station Count',
    School: 'School Count',
    Supermarket: 'Supermarket Count',
    Bank_User_5: 'Bank Users',
    Eat_Out_5: 'Eating Out Seekers',
    Tourists: 'Tourists'
};

export default function WeightUpdateModal({
                                              isOpen,
                                              onClose,
                                              weights,
                                              setWeights,
                                              onSubmit,
                                              weightsLoading,
                                              weightsButtonStatus
                                          }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-60 p-4">
            <div className="rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]" style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}>

                <h2 className="text-white text-xl font-semibold px-8 pt-8 pb-4 flex-shrink-0">Adjust Map Weights</h2>

                <form
                    onSubmit={e => { e.preventDefault(); onSubmit(); }}
                    className="flex flex-col flex-grow min-h-0"
                >
                    {/* --- MODIFICATION: Added the inline style from Map.jsx --- */}
                    <div
                        className="space-y-4 overflow-y-auto px-8 scrollbar-hide"
                        style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}
                    >
                        {Object.keys(weights).map(key => (
                            <div key={key} className="flex flex-col">
                                <label className="text-gray-300 text-sm mb-1">{labelMapping[key] || key}</label>
                                <input
                                    type="range"
                                    min={0}
                                    max={5}
                                    step={0.5}
                                    value={weights[key]}
                                    onChange={e => setWeights({ ...weights, [key]: parseFloat(e.target.value) })}
                                    className="range-slider-bw"
                                />
                                <span className="text-gray-400 text-xs mt-1 text-right">Value: {weights[key]}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center space-x-3 pt-6 px-8 pb-8 flex-shrink-0">
                        <button
                            type="button"
                            className="px-6 py-1 bg-transparent text-white text-sm rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors min-w-[130px]"
                            onClick={onClose}
                            disabled={weightsLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 rounded-lg bg-gray-300 hover:bg-gray-200 text-black flex items-center justify-center min-w-[130px] transition-colors"
                            disabled={weightsLoading}
                        >
                            {weightsLoading ? (
                                <>
                                    <ImSpinner2 className="animate-spin h-5 w-5 mr-3" />
                                    <span>
                                        {weightsButtonStatus === 'recalculating' && 'Recalculating'}
                                        {weightsButtonStatus === 'loadingMap' && 'Loading Map'}
                                    </span>
                                </>
                            ) : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}