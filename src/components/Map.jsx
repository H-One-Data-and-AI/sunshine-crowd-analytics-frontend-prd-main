import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Loader from './Loader';
import { decryptStreamedResponse } from '../utils/cryptoUtils.js';
import CountUp from 'react-countup'
import { ImSpinner2 } from 'react-icons/im';
import { useAuth } from '../context/AuthContext.jsx';
import UserManagementModal from './UserManagementModal';
import WeightUpdateModal from './WeightUpdateModal';
import api from '../services/api';
import { provinces, districts, ds } from '../data/regions.js';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


export default function Map() {
    const navigate = useNavigate();
    const { userRole, logout } = useAuth();
    const [expandedGroups, setExpandedGroups] = useState(new Set()); 
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [clientGeoJsonData, setclientGeoJsonData] = useState(null);
    const [competitorGeoJsonData, setCompetitorGeoJsonData] = useState(null);
    const [competitorSummary, setCompetitorSummary] = useState({ categories: [], grouped: {} });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // const [selectedRegion, setSelectedRegion] = useState('province:Western');
    const [selectedRegions, setSelectedRegions] = useState(new Set(['province:Western']));
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [selectedCompetitorCategories, setSelectedCompetitorCategories] = useState({});
    const [clientCount, setclientCount] = useState(0);
    const [uploadedAmenityVisibility, setUploadedAmenityVisibility] = useState({});
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsRef = useRef(null);

    const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
    const [weights, setWeights] = useState({
        Population: 3,
        Latch: 2,
        Bank: 1,
        Pharmacy: 1,
        Fuel_Station: 1,
        School: 1,
        Supermarket: 1,
        Bank_User_5: 2,
        Eat_Out_5: 2,
        Tourists: 2
    });

    const [weightsLoading, setWeightsLoading] = useState(false);
    const [weightsButtonStatus, setWeightsButtonStatus] = useState('idle'); // 'idle', 'recalculating', 'loadingMap'

    // Add these new states right after the weightsButtonStatus state
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle', 'uploading', 'success', 'error'
    const [uploadMessage, setUploadMessage] = useState('');

    // Add these states near your other modal states
    const [isViewDataModalOpen, setIsViewDataModalOpen] = useState(false);
    const [newDataRows, setNewDataRows] = useState([]);
    const [isNewDataLoading, setIsNewDataLoading] = useState(false);

    const [selectedRows, setSelectedRows] = useState(new Set());

    // Create all region options
    const allRegionOptions = [
        // {value: 'all:', label: 'ALL: Western Province', type: 'all' },
        ...provinces.map(province => ({ value: `province:${province}`, label: `Province: ${province}`, type: 'province' })),
        ...districts.map(district => ({ value: `district:${district}`, label: `District: ${district}`, type: 'district' })),
        ...ds.map(ds => ({ value: `ds:${ds}`, label: `DS: ${ds}`, type: 'ds' }))
    ];

    // Filter options based on search term
    const filteredOptions = allRegionOptions.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // // Get display text for selected region
    // const getDisplayText = () => {
    //     if (!selectedRegion) return 'Select or search for a region...';
    //     const option = allRegionOptions.find(opt => opt.value === selectedRegion);
    //     return option ? option.label : 'Select or search for a region...';
    // };

    const getDisplayText = () => {
        if (selectedRegions.size === 0) return 'Select regions...';
        if (selectedRegions.size === 1) {
            const val = Array.from(selectedRegions)[0];
            const option = allRegionOptions.find(opt => opt.value === val);
            return option ? option.label : val;
        }
        // If "ALL" is selected, just show that
        if (selectedRegions.has('all:')) return 'ALL: Sri Lanka';
        
        return `${selectedRegions.size} Regions Selected`;
    };

    const handleWeightsSubmit = async () => {
        setWeightsButtonStatus('recalculating');
        setWeightsLoading(true);
        try {
            await api.post('/main_adjust/recalculate', weights);
            setWeightsButtonStatus('loadingMap');
            // const response = await api.get('/main_adjust/download.csv', { responseType: 'blob' });
            // const hexagonCsvData = await decryptStreamedResponse(new Response(response.data));
            // setData(hexagonCsvData);
            await fetchData();
            console.log('Data re-fetched after weight update');
            setIsWeightsModalOpen(false);
        } catch (err) {
            const errorMessage = err.response?.data?.detail || err.message || 'Error updating weights';
            toast.error(errorMessage);
        } finally {
            setWeightsLoading(false);
            setWeightsButtonStatus('idle');
        }
    };

    const handleUploadSubmit = async () => {
        if (!selectedFile) return;
        setUploadStatus('uploading');
        setUploadMessage('');
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await api.post('/cargills/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadMessage(response.data.message || 'Success!');
            setUploadStatus('success');

            await refreshUserLocations();

            // const clientResponse = await api.get('/cargills/download.csv', { responseType: 'blob' });
            // const clientCsvData = await decryptStreamedResponse(new Response(clientResponse.data));
            // setclientData(clientCsvData);

            setTimeout(() => {
                setIsUploadModalOpen(false);
                setSelectedFile(null);
                setUploadStatus('idle');
            }, 2000);
        } catch (err) {
            const errorMessage = err.response?.data?.detail || err.message || 'Upload failed';
            if (err.response?.status !== 401) {
                toast.error(errorMessage);
            }
            setUploadStatus('idle');
        }
    };

    // Add this new function inside your MapComponent2 component
    const handleDeleteSelected = async () => {
        const geometriesToDelete = Array.from(selectedRows);
        if (geometriesToDelete.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${geometriesToDelete.length} location(s)?`)) return;

        try {
            await api.delete('/cargills/delete-locations', {
                data: { geometries: geometriesToDelete } // Axios uses 'data' for DELETE body
            });
            setNewDataRows(currentRows => currentRows.filter(row => !selectedRows.has(row.geometry)));
            setSelectedRows(new Set());

            await refreshUserLocations();

            // const clientResponse = await api.get('/cargills/download.csv', { responseType: 'blob' });
            // const clientCsvData = await decryptStreamedResponse(new Response(clientResponse.data));
            // setclientData(clientCsvData);
        } catch (err) {
            const errorMessage = err.response?.data?.detail || err.message || 'Error deleting locations';
            toast.error(errorMessage);
        }
    };


    // const getUniqueCompetitorCategories = (csvData, selectedRegion = 'all:') => {
    //     if (!csvData) return [];

    //     const lines = csvData.trim().split('\n');

    //     // Parse CSV header properly
    //     const parseCSVLine = (line) => {
    //         const result = [];
    //         let current = '';
    //         let inQuotes = false;

    //         for (let i = 0; i < line.length; i++) {
    //             const char = line[i];

    //             if (char === '"') {
    //                 inQuotes = !inQuotes;
    //             } else if (char === ',' && !inQuotes) {
    //                 result.push(current.trim());
    //                 current = '';
    //             } else {
    //                 current += char;
    //             }
    //         }
    //         result.push(current.trim());
    //         return result;
    //     };

    //     const headers = parseCSVLine(lines[0]);
    //     const competitorIndex = headers.indexOf('Competitor');
    //     const provinceIndex = headers.indexOf('Province');
    //     const districtIndex = headers.indexOf('District');
    //     const dsIndex = headers.indexOf('DS');

    //     if (competitorIndex === -1) {
    //         console.error('Competitor column not found');
    //         console.log('Available headers:', headers);
    //         return [];
    //     }

    //     const categoryCount = {};

    //     lines.slice(1).forEach(line => {
    //         const values = parseCSVLine(line);

    //         // Apply regional filter
    //         let includeRow = true;
    //         if (selectedRegion && selectedRegion !== 'all:') {
    //             const [regionType, regionValue] = selectedRegions.split(':');
    //             if (regionValue) {
    //                 switch (regionType) {
    //                     case 'province':
    //                         includeRow = values[provinceIndex] === regionValue;
    //                         break;
    //                     case 'district':
    //                         includeRow = values[districtIndex] === regionValue;
    //                         break;
    //                     case 'ds':
    //                         includeRow = values[dsIndex] === regionValue;
    //                         break;
    //                 }
    //             }
    //         }

    //         if (includeRow && values[competitorIndex] && values[competitorIndex].trim()) {
    //             const competitorValue = values[competitorIndex].trim().replace(/\r/g, '').replace(/"/g, '');

    //             // Filter out POINT geometries
    //             if (!competitorValue.startsWith('POINT (')) {
    //                 categoryCount[competitorValue] = (categoryCount[competitorValue] || 0) + 1;
    //             }
    //         }
    //     });

    //     // Convert to array with counts and sort alphabetically
    //     return Object.entries(categoryCount)
    //         .map(([category, count]) => `${category}(${count})`)
    //         .sort((a, b) => {
    //             const categoryA = a.split('(')[0];
    //             const categoryB = b.split('(')[0];
    //             return categoryA.localeCompare(categoryB);
    //         });
    // };


    const getUniqueCompetitorCategories = (csvData, currentSelectedRegions) => {
        if (!csvData) return [];

        // Handle the case where it might be passed as a string (legacy) or Set
        let activeRegions = new Set();
        if (currentSelectedRegions instanceof Set) {
            activeRegions = currentSelectedRegions;
        } else if (typeof currentSelectedRegions === 'string') {
            activeRegions = new Set([currentSelectedRegions]);
        } else {
            activeRegions = new Set(['all:']);
        }

        const lines = csvData.trim().split('\n');

        // Parse CSV header properly
        const parseCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else current += char;
            }
            result.push(current.trim());
            return result;
        };

        const headers = parseCSVLine(lines[0]);
        const competitorIndex = headers.indexOf('Competitor');
        const provinceIndex = headers.indexOf('Province');
        const districtIndex = headers.indexOf('District');
        const dsIndex = headers.indexOf('DS');

        if (competitorIndex === -1) return [];

        const categoryCount = {};

        lines.slice(1).forEach(line => {
            const values = parseCSVLine(line);
            
            // Logic: Include row if 'all:' is selected OR if it matches ANY active region
            let includeRow = false;
            
            if (activeRegions.size === 0 || activeRegions.has('all:')) {
                includeRow = true;
            } else {
                // Check against all selected regions
                for (let region of activeRegions) {
                    const [regionType, regionValue] = region.split(':');
                    if (regionValue) {
                        switch (regionType) {
                            case 'province':
                                if (values[provinceIndex] === regionValue) includeRow = true;
                                break;
                            case 'district':
                                if (values[districtIndex] === regionValue) includeRow = true;
                                break;
                            case 'ds':
                                if (values[dsIndex] === regionValue) includeRow = true;
                                break;
                        }
                    }
                    if (includeRow) break; // Stop checking if we found a match
                }
            }

            if (includeRow && values[competitorIndex] && values[competitorIndex].trim()) {
                const competitorValue = values[competitorIndex].trim().replace(/\r/g, '').replace(/"/g, '');
                if (!competitorValue.startsWith('POINT (')) {
                    categoryCount[competitorValue] = (categoryCount[competitorValue] || 0) + 1;
                }
            }
        });

        return Object.entries(categoryCount)
            .map(([category, count]) => `${category}(${count})`)
            .sort((a, b) => a.split('(')[0].localeCompare(b.split('(')[0]));
    };

    const getGroupedCompetitorData = (csvData, currentSelectedRegions) => {
        if (!csvData) return {};

        // --- YOUR ORIGINAL LOGIC (UNCHANGED) ---
        const getCategoryFromRow = (name, rawAmenity) => {
            const lowerName = name.toLowerCase();
            const lowerAmenity = rawAmenity.toLowerCase();
            
            // 1. ATMS
            if (lowerName.includes('atm') || lowerAmenity === 'atm') return 'ATM';

            // 2. GAS / FUEL STATIONS
            if (
                lowerName.includes('ioc') || lowerName.includes('ceypetco') || 
                lowerName.includes('sinopec') || lowerName.includes('shed') ||
                lowerName.includes('filling station') || lowerName.includes('fuel') ||
                lowerName.includes('gas station') || lowerAmenity.includes('fuel') ||
                lowerAmenity.includes('gas')
            ) return 'Gas Station';

            // 3. BANKS
            if (
                lowerName.includes('bank') || lowerName.includes('hnb') || 
                lowerName.includes('sampath') || lowerName.includes('seylan') || 
                lowerName.includes('ntb') || lowerName.includes('nations') || 
                lowerName.includes('boc') || lowerName.includes('peoples') || 
                lowerName.includes('nsb') || lowerAmenity === 'bank'
            ) return 'Bank';
            
            // 4. SUPERMARKETS
            if (
                lowerName.includes('keells') || lowerName.includes('arpico') || 
                lowerName.includes('spar') || lowerName.includes('glomark') || 
                lowerName.includes('food city') || lowerName.includes('sathosa') ||
                lowerName.includes('laugfs') || lowerName.includes('softlogic') ||
                lowerName.includes('supermarket')
            ) return 'Supermarket';

            // 5. PHARMACIES
            if (lowerName.includes('pharmacy') || lowerName.includes('chemist') || lowerName.includes('healthguard') || lowerAmenity.includes('pharmacy')) return 'Pharmacie'; 

            return rawAmenity ? (rawAmenity.charAt(0).toUpperCase() + rawAmenity.slice(1)) : 'Other';
        };

        // --- Standard CSV Parsing Logic ---
        let activeRegions = new Set();
        if (currentSelectedRegions instanceof Set) activeRegions = currentSelectedRegions;
        else if (typeof currentSelectedRegions === 'string') activeRegions = new Set([currentSelectedRegions]);
        else activeRegions = new Set(['all:']);

        const lines = csvData.trim().split('\n');

        // Helper to parse CSV lines safely
        const parseCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else current += char;
            }
            result.push(current.trim());
            return result;
        };

        const headers = parseCSVLine(lines[0]);
        const competitorIndex = headers.indexOf('Competitor');
        const amenityIndex = headers.indexOf('Amenity');
        const provinceIndex = headers.indexOf('Province');
        const districtIndex = headers.indexOf('District');
        const dsIndex = headers.indexOf('DS');

        if (competitorIndex === -1 || amenityIndex === -1) return {};

        const groups = {};

        lines.slice(1).forEach(line => {
            const values = parseCSVLine(line);
            
            let includeRow = false;
            if (activeRegions.size === 0 || activeRegions.has('all:')) includeRow = true;
            else {
                for (let region of activeRegions) {
                    const [regionType, regionValue] = region.split(':');
                    if (regionType === 'province' && values[provinceIndex] === regionValue) includeRow = true;
                    if (regionType === 'district' && values[districtIndex] === regionValue) includeRow = true;
                    if (regionType === 'ds' && values[dsIndex] === regionValue) includeRow = true;
                    if (includeRow) break;
                }
            }

            if (includeRow && values[competitorIndex]) {
                // Use 'let' so we can modify the name
                let competitorName = values[competitorIndex].trim().replace(/\r/g, '').replace(/"/g, '');
                const rawAmenity = values[amenityIndex].trim().replace(/\r/g, '').replace(/"/g, '');

                if (!competitorName.startsWith('POINT (')) {
                    
                    // --- THE ONLY CHANGE IS HERE ---
                    // If Amenity is 'atm', make sure the name is unique (e.g. "Amana Bank - ATM")
                    // This separates it from "Amana Bank" (the branch)
                    if (rawAmenity.toLowerCase() === 'atm' && !competitorName.toLowerCase().includes('atm')) {
                        competitorName = `${competitorName} - ATM`;
                    }
                    // -------------------------------

                    const masterCategory = getCategoryFromRow(competitorName, rawAmenity);
                    if (!groups[masterCategory]) {
                        groups[masterCategory] = {};
                    }
                    groups[masterCategory][competitorName] = (groups[masterCategory][competitorName] || 0) + 1;
                }
            }
        });

        return groups;
    };

    // Toggle the Accordion (Expand/Collapse)
    const toggleGroupAccordion = (groupName) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupName)) {
            newExpanded.delete(groupName);
        } else {
            newExpanded.add(groupName);
        }
        setExpandedGroups(newExpanded);
    };

    // Handle "Select All" / "Deselect All" for a specific group
    const handleGroupSelectAll = (groupName, competitorsInGroup, isAllSelected) => {
        const newSelectedCategories = { ...selectedCompetitorCategories };
        const competitorNames = Object.keys(competitorsInGroup);

        competitorNames.forEach(compName => {
            // If currently all selected, we turn them OFF. If not, we turn them ON.
            newSelectedCategories[compName] = !isAllSelected;

            // Toggle layer visibility on the map
            const layerId = `competitor-${compName.replace(/\s+/g, '-').toLowerCase()}`;
            if (map.current && map.current.getLayer(layerId)) {
                const visibility = !isAllSelected ? 'visible' : 'none';
                map.current.setLayoutProperty(layerId, 'visibility', visibility);
            }
        });

        setSelectedCompetitorCategories(newSelectedCategories);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const convertItemToFeature = (item) => {
        // 1. The data shows the key is lowercase 'geometry'
        const wktGeometry = item.geometry;
        
        if (!wktGeometry) return null;

        try {
            // 2. Parse WKT Polygon: "POLYGON ((lng lat, lng lat, ...))"
            const coordMatch = wktGeometry.match(/POLYGON \(\((.*?)\)\)/);
            if (!coordMatch) return null;

            const coordinates = coordMatch[1].split(', ').map(coord => {
                const [lng, lat] = coord.trim().split(' ');
                return [parseFloat(lng), parseFloat(lat)];
            });

            // 3. Create Properties
            const properties = { ...item };
            
            // Remove the raw geometry string to save memory
            delete properties.geometry;
            delete properties.Geometry;
            delete properties.Unnamed; // Remove the index column if present

            // 4. Safety check for numeric fields (The API sends numbers, but this is extra safety)
            const numericFields = [
                'Population', 'Latch', 'Bank', 'Bank_User_5', 'Eat_Out_5', 'Tourists',
                'Country_Score', 'Province_Score', 'District_Score', 'DS_Score'
            ];

            numericFields.forEach(field => {
                if (properties[field] !== undefined) {
                    properties[field] = parseFloat(properties[field]) || 0;
                }
            });

            return {
                type: 'Feature',
                properties: properties,
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates]
                }
            };
        } catch (error) {
            console.error("Error parsing item geometry:", error);
            return null;
        }
    };

    // --- NEW HELPER FUNCTION ---
    const refreshUserLocations = async () => {
        try {
            // Fetch only user-added locations (JSON format)
            const response = await api.get('/cargills/new-locations');
            const newLocations = response.data; 

            // Convert to GeoJSON format expected by the Map
            const features = newLocations.map(loc => {
                // Parse WKT: "POINT (79.9 6.8)"
                const match = loc.geometry && loc.geometry.match(/POINT \((.*?) (.*?)\)/);
                if (!match) return null;
                
                return {
                    type: 'Feature',
                    properties: loc, // { Name: "...", Amenity: "..." }
                    geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(match[1]), parseFloat(match[2])]
                    }
                };
            }).filter(f => f !== null);

            // Update the Map Data directly
            setclientGeoJsonData({
                type: 'FeatureCollection',
                features: features
            });
            
            // Update the Count
            setclientCount(features.length);
            
            // Also update the Table in "View Added Data"
            setNewDataRows(newLocations);

        } catch (error) {
            console.error("Failed to refresh user locations", error);
        }
    };
    
    const fetchData = async () => {
        setError(null);
        if (!loading) setLoading(true);

        try {
            const params = new URLSearchParams();
            if (selectedRegions.size === 0 || selectedRegions.has('all:')) {
                params.append('all_regions', 'true');
            } else {
                selectedRegions.forEach(region => {
                    const [type, val] = region.split(':');
                    if (type === 'province') params.append('province', val);
                    if (type === 'district') params.append('district', val);
                    if (type === 'ds') params.append('ds', val);
                });
            }

            // Start parallel requests for aux data
            const auxPromise = Promise.all([
                api.get('/competitor/geojson', { params }),
                api.get('/competitor/summary', { params })
            ]);

            const userLocPromise = refreshUserLocations();

            // 2. BATCH LOAD Main Hexagon Data (Solving Network & Backend processing delays)
            let allHexFeatures = [];
            let offset = 0;
            const limit = 3000; 
            let hasMore = true;

            console.log("Starting Throttled Batch Fetch...");

            while (hasMore) {
                try {
                    const currentParams = new URLSearchParams(params.toString());
                    currentParams.append('limit', limit);
                    currentParams.append('offset', offset);

                    const response = await api.get('/main_adjust/data', { params: currentParams });
                    const responseData = response.data;
                    const items = Array.isArray(responseData) ? responseData : (responseData.items || []);
                    
                    if (items.length === 0) {
                        hasMore = false;
                        break;
                    }

                    // Convert batch to features extremely fast using JS string parsing
                    const batchFeatures = items.map(convertItemToFeature).filter(f => f !== null);
                    allHexFeatures = [...allHexFeatures, ...batchFeatures];
                    
                    console.log(`Batch loaded: ${items.length} items. Total: ${allHexFeatures.length}`);

                    if (items.length < limit || responseData.has_more === false) {
                        hasMore = false;
                    } else {
                        offset += limit;
                        await new Promise(resolve => setTimeout(resolve, 50)); // throttle
                    }
                } catch (batchError) {
                    console.error("Batch failed at offset " + offset, batchError);
                    hasMore = false; 
                    toast.error(`Network interruption. Loaded ${allHexFeatures.length} locations.`);
                }
            }

            // Final Map Update
            setGeoJsonData({
                type: 'FeatureCollection',
                features: allHexFeatures
            });

            // Wait and set aux data
            const [compGeoRes, compSummaryRes] = await auxPromise;
            setCompetitorGeoJsonData(compGeoRes.data);
            setCompetitorSummary(compSummaryRes.data);

            await userLocPromise;

        } catch (err) {
            console.error('Error fetching data:', err);
            setError(`Failed to fetch data: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Add this function to generate colors for categories
    const getCategoryColor = (category, allCategories) => {
        const colors = [
            '#ef4444', // red
            '#f97316', // orange
            '#eab308', // yellow
            '#22c55e', // green
            '#06b6d4', // cyan
            '#3b82f6', // blue
            '#8b5cf6', // violet
            '#ec4899', // pink
            '#f59e0b', // amber
            '#10b981', // emerald
            '#6366f1', // indigo
            '#84cc16', // lime
            '#f43f5e', // rose
            '#0ea5e9', // sky
            '#8332e6', // purple
            '#059669'  // teal
        ];

        const index = allCategories.indexOf(category);
        return colors[index % colors.length];
    };

    // const countFilteredclient = (selectedRegion) => {
    //     if (!clientGeoJsonData) return 0;

    //     let count = 0;

    //     clientGeoJsonData.features.forEach(feature => {
    //         const properties = feature.properties;
    //         let includeFeature = true;

    //         if (selectedRegion && selectedRegion !== 'all:') {
    //             const [regionType, regionValue] = selectedRegion.split(':');

    //             switch (regionType) {
    //                 case 'province':
    //                     includeFeature = properties.Province === regionValue;
    //                     break;
    //                 case 'district':
    //                     includeFeature = properties.District === regionValue;
    //                     break;
    //                 case 'ds':
    //                     includeFeature = properties.DS === regionValue;
    //                     break;
    //                 default:
    //                     includeFeature = true;
    //             }
    //         }

    //         if (includeFeature) {
    //             count++;
    //         }
    //     });

    //     return count;
    // };

    const countFilteredclient = (currentSelectedRegions) => {
        if (!clientGeoJsonData) return 0;

        let activeRegions = new Set();
        if (currentSelectedRegions instanceof Set) {
            activeRegions = currentSelectedRegions;
        } else {
            activeRegions = new Set(['all:']);
        }

        let count = 0;

        clientGeoJsonData.features.forEach(feature => {
            const properties = feature.properties;
            let includeFeature = false;

            if (activeRegions.size === 0 || activeRegions.has('all:')) {
                includeFeature = true;
            } else {
                for (let region of activeRegions) {
                    const [regionType, regionValue] = region.split(':');
                    
                    if (regionType === 'province' && properties.Province === regionValue) includeFeature = true;
                    else if (regionType === 'district' && properties.District === regionValue) includeFeature = true;
                    else if (regionType === 'ds' && properties.DS === regionValue) includeFeature = true;
                    
                    if (includeFeature) break;
                }
            }

            if (includeFeature) {
                count++;
            }
        });

        return count;
    };

    const getUploadedAmenityGroups = (geoJsonData, currentSelectedRegions) => {
        if (!geoJsonData || !geoJsonData.features) return {};

        let activeRegions = currentSelectedRegions instanceof Set
            ? currentSelectedRegions
            : new Set(['all:']);

        const groups = {};

        geoJsonData.features.forEach(feature => {
            const props = feature.properties;
            let include = false;

            if (activeRegions.size === 0 || activeRegions.has('all:')) {
                include = true;
            } else {
                for (let region of activeRegions) {
                    const [type, val] = region.split(':');
                    if (type === 'province' && props.Province === val) include = true;
                    if (type === 'district' && props.District === val) include = true;
                    if (type === 'ds' && props.DS === val) include = true;
                    if (include) break;
                }
            }

            if (include) {
                const amenity = props.Amenity || 'Unknown';
                groups[amenity] = (groups[amenity] || 0) + 1;
            }
        });

        return groups;
    };

    // Color palette for uploaded amenity layers
    const UPLOADED_COLORS = [
        '#ff6b35', '#f7931e', '#ffcd3c', '#9bc53d',
        '#5bc0eb', '#c77dff', '#4cc9f0', '#f72585'
    ];

    const parseCSVToGeoJSON = (csvData) => {
        const lines = csvData.trim().split('\n');
        const headers = lines[0].split(',');

        const features = lines.slice(1).map((line) => {
            const geometryStartIndex = line.indexOf('"POLYGON');
            const geometryEndIndex = line.lastIndexOf(')"');

            if (geometryStartIndex === -1 || geometryEndIndex === -1) {
                console.error('Could not find geometry in line:', line);
                return null;
            }

            const beforeGeometry = line.substring(0, geometryStartIndex);
            const geometryPart = line.substring(geometryStartIndex + 1, geometryEndIndex + 1);
            const afterGeometry = line.substring(geometryEndIndex + 2);

            const beforeValues = beforeGeometry.split(',');
            const afterValues = afterGeometry ? afterGeometry.split(',').filter(v => v !== '') : [];
            const allValues = [...beforeValues, geometryPart, ...afterValues];

            const properties = {};

            headers.forEach((header, index) => {
                if (header !== 'geometry' && allValues[index] !== undefined) {
                    let value = allValues[index];

                    const numericFields = [
                        'Population', 'Latch', 'Bank', 'Pharmacy', 'Fuel_Station', 'School', 'Supermarket',
                        'Bank_User_0', 'Bank_User_1', 'Bank_User_2', 'Bank_User_3', 'Bank_User_4', 'Bank_User_5',
                        'Eat_Out_0', 'Eat_Out_1', 'Eat_Out_2', 'Eat_Out_3', 'Eat_Out_4', 'Eat_Out_5',
                        'Tourists', 'Competitor', 'Area_Presence', 'Country_Score', 'Country_Rank',
                        'Province_Score', 'Province_Rank', 'District_Score', 'District_Rank', 'DS_Score', 'DS_Rank'
                    ];

                    if (numericFields.includes(header)) {
                        const numValue = parseFloat(value);
                        properties[header] = isNaN(numValue) ? 0 : numValue;
                    } else {
                        properties[header] = value;
                    }
                }
            });

            const wktGeometry = geometryPart;

            try {
                const coordMatch = wktGeometry.match(/POLYGON \(\((.*?)\)\)/);
                if (!coordMatch) {
                    console.error('Could not parse geometry:', wktGeometry);
                    return null;
                }

                const coordString = coordMatch[1];
                const coordinates = coordString.split(', ').map(coord => {
                    const [lng, lat] = coord.trim().split(' ');
                    return [parseFloat(lng), parseFloat(lat)];
                });

                return {
                    type: 'Feature',
                    properties,
                    geometry: {
                        type: 'Polygon',
                        coordinates: [coordinates]
                    }
                };
            } catch (error) {
                console.error('Error parsing geometry:', error, wktGeometry);
                return null;
            }
        }).filter(feature => feature !== null);

        return {
            type: 'FeatureCollection',
            features: features
        };
    };

    // Parse client CSV to GeoJSON
    const parseclientCSV = (csvData) => {
        if (!csvData) return { type: 'FeatureCollection', features: [] }; // Handle empty data
        const lines = csvData.trim().split('\n');

        // THIS IS THE ROBUST PARSER FROM YOUR OTHER FUNCTION
        const parseCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim().replace(/^"|"$/g, '')); // Trim and remove quotes
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
        };

        const headers = parseCSVLine(lines[0]); // Use the robust parser for headers too

        const features = lines.slice(1).map((line) => {
            // ---- THIS IS THE ONLY LINE THAT CHANGES ----
            const values = parseCSVLine(line); // Use the robust parser instead of .split(',')
            // ------------------------------------------

            const properties = {};

            headers.forEach((header, index) => {
                if (header !== 'geometry' && values[index] !== undefined) {
                    // Remove any extra carriage return characters
                    properties[header] = values[index].replace(/\r/g, '');
                }
            });

            // Parse the POINT geometry
            const geometryValue = values[headers.indexOf('geometry')];
            if (!geometryValue) {
                console.error('Geometry value is missing in line:', line);
                return null;
            }

            const pointMatch = geometryValue.match(/POINT \((.*?) (.*?)\)/);

            if (!pointMatch) {
                console.error('Could not parse point geometry:', geometryValue);
                return null;
            }

            const lng = parseFloat(pointMatch[1]);
            const lat = parseFloat(pointMatch[2]);

            // Add a check for valid coordinates
            if (isNaN(lng) || isNaN(lat)) {
                console.error('Invalid coordinates parsed from geometry:', geometryValue);
                return null;
            }

            return {
                type: 'Feature',
                properties,
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                }
            };
        }).filter(feature => feature !== null);

        return {
            type: 'FeatureCollection',
            features
        };
    };

    // Parse Competitor CSV to GeoJSON
    const parseCompetitorCSV = (csvData) => {
        const lines = csvData.trim().split('\n');

        // Parse CSV header properly to handle quoted values
        const parseCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const headers = parseCSVLine(lines[0]);

        const features = lines.slice(1).map((line) => {
            const values = parseCSVLine(line);
            const properties = {};

            headers.forEach((header, index) => {
                if (header !== 'geometry' && values[index] !== undefined) {
                    properties[header] = values[index].replace(/"/g, '');
                }
            });

            const amenity = properties.Amenity ? properties.Amenity.toLowerCase() : '';
            if (amenity === 'atm') {
                if (properties.Competitor && !properties.Competitor.toLowerCase().includes('atm')) {
                    properties.Competitor = `${properties.Competitor} - ATM`;
                }
            }

            // Parse the POINT geometry
            const geometryValue = values[headers.indexOf('geometry')];
            const pointMatch = geometryValue.match(/POINT \((.*?) (.*?)\)/);

            if (!pointMatch) {
                console.error('Could not parse point geometry:', geometryValue);
                return null;
            }

            const lng = parseFloat(pointMatch[1]);
            const lat = parseFloat(pointMatch[2]);

            // Only include if it has a valid competitor category (not POINT geometry)
            if (properties.Competitor && !properties.Competitor.startsWith('POINT (')) {
                return {
                    type: 'Feature',
                    properties,
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                };
            }

            return null;
        }).filter(feature => feature !== null);

        return {
            type: 'FeatureCollection',
            features
        };
    };

    // Refetch data when selected regions change
    useEffect(() => {
        if (map.current) {
            fetchData();
        }
    }, [selectedRegions]);

    // Add this useEffect after your existing dropdown close effect
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setIsSettingsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getScoreAndRankFields = () => {
        // If nothing selected or "ALL" selected, use Country Score
        if (selectedRegions.size === 0 || selectedRegions.has('all:')) {
            return { scoreField: 'Country_Score', rankField: 'Country_Rank' };
        }

        // Check the first selected region to determine the "Type" (Province vs District vs DS)
        // This assumes users usually select regions of the same type (e.g., multiple Districts)
        const firstSelection = Array.from(selectedRegions)[0];
        const [regionType] = firstSelection.split(':');

        switch (regionType) {
            case 'province':
                return { scoreField: 'Province_Score', rankField: 'Province_Rank' };
            case 'district':
                return { scoreField: 'District_Score', rankField: 'District_Rank' };
            case 'ds':
                return { scoreField: 'DS_Score', rankField: 'DS_Rank' };
            default:
                return { scoreField: 'Country_Score', rankField: 'Country_Rank' };
        }
    };

    const applyclientFilter = () => {
        if (!map.current || !clientGeoJsonData) return;

        // 1. Build Region Filter (Using STRICT Modern Syntax: ['get', 'Field'])
        let regionFilter = null;
        if (selectedRegions.size > 0 && !selectedRegions.has('all:')) {
            const conditions = ['any'];
            selectedRegions.forEach(region => {
                const [type, val] = region.split(':');
                if (type === 'province') conditions.push(['==', ['get', 'Province'], val]);
                else if (type === 'district') conditions.push(['==', ['get', 'District'], val]);
                else if (type === 'ds') conditions.push(['==', ['get', 'DS'], val]);
            });
            if (conditions.length > 1) regionFilter = conditions;
        }

        // 2. Apply to each dynamic amenity layer
        const amenities = [...new Set(
            clientGeoJsonData.features.map(f => f.properties.Amenity || 'Unknown')
        )];

        amenities.forEach(amenity => {
            const layerId = `uploaded-amenity-${amenity.replace(/\s+/g, '-').toLowerCase()}`;
            
            if (map.current.getLayer(layerId)) {
                // Check if user turned off this specific amenity in the sidebar
                const isVisible = uploadedAmenityVisibility[amenity] !== false;

                // Amenity Filter (Using coalesce in case Amenity column is blank)
                const amenityFilter = ['==', ['coalesce', ['get', 'Amenity'], 'Unknown'], amenity];
                
                let combinedFilter;
                if (!isVisible) {
                    // If toggled off, force hide it by passing an impossible condition
                    combinedFilter = ['==', 'FORCE_HIDE', 'YES']; 
                } else {
                    // Combine Region and Amenity safely
                    combinedFilter = regionFilter ? ['all', amenityFilter, regionFilter] : amenityFilter;
                }

                map.current.setFilter(layerId, combinedFilter);
            }
        });
    };

    // const applyclientFilter = () => {
    //     if (!map.current || !map.current.getLayer('client-stores') || !clientGeoJsonData) return;

    //     console.log('applyclientFilter called with selectedRegion:', selectedRegion);

    //     let filter = null;
    //     if (selectedRegion && selectedRegion !== 'all:') {
    //         const [regionType, regionValue] = selectedRegion.split(':');
    //         if (regionValue) {
    //             switch (regionType) {
    //                 case 'province':
    //                     filter = ['==', 'Province', regionValue];
    //                     break;
    //                 case 'district':
    //                     filter = ['==', 'District', regionValue];
    //                     break;
    //                 case 'ds':
    //                     filter = ['==', 'DS', regionValue];
    //                     break;
    //             }
    //         }
    //     }

    //     // Apply filter to client layer
    //     map.current.setFilter('client-stores', filter);

    //     // Count and update the visible client points
    //     const count = countFilteredclient(selectedRegion);
    //     setclientCount(count);
    //     console.log('Visible client stores:', count);
    // };

    // Apply filter to Competitor layer
    // const applyCompetitorFilter = () => {
    //     if (!map.current || !competitorGeoJsonData) return;

    //     console.log('applyCompetitorFilter called with selectedRegion:', selectedRegion);

    //     let filter = null;
    //     if (selectedRegion && selectedRegion !== 'all:') {
    //         const [regionType, regionValue] = selectedRegion.split(':');

    //         switch (regionType) {
    //             case 'province':
    //                 filter = ['==', 'Province', regionValue];
    //                 break;
    //             case 'district':
    //                 filter = ['==', 'District', regionValue];
    //                 break;
    //             case 'ds':
    //                 filter = ['==', 'DS', regionValue];
    //                 break;
    //             default:
    //                 filter = null;
    //         }
    //     }

    //     // Apply filter to all competitor layers that are currently selected (visible)
    //     Object.keys(selectedCompetitorCategories).forEach(category => {
    //         const layerId = `competitor-${category.replace(/\s+/g, '-').toLowerCase()}`;
    //         if (map.current.getLayer(layerId) && selectedCompetitorCategories[category]) {
    //             // Combine category filter with regional filter
    //             const categoryFilter = ['==', 'Competitor', category];
    //             const combinedFilter = filter ? ['all', categoryFilter, filter] : categoryFilter;
    //             map.current.setFilter(layerId, combinedFilter);
    //         }
    //     });
    // };

    const applyCompetitorFilter = () => {
        if (!map.current || !competitorGeoJsonData) return;

        let regionFilter = null;
        if (selectedRegions.size > 0 && !selectedRegions.has('all:')) {
            const conditions = ['any'];
            selectedRegions.forEach(region => {
                const [type, val] = region.split(':');
                if (type === 'province') conditions.push(['==', 'Province', val]);
                else if (type === 'district') conditions.push(['==', 'District', val]);
                else if (type === 'ds') conditions.push(['==', 'DS', val]);
            });
            if (conditions.length > 1) regionFilter = conditions;
        }

        Object.keys(selectedCompetitorCategories).forEach(category => {
            const layerId = `competitor-${category.replace(/\s+/g, '-').toLowerCase()}`;
            if (map.current.getLayer(layerId) && selectedCompetitorCategories[category]) {
                const categoryFilter = ['==', 'Competitor', category];
                const combinedFilter = regionFilter ? ['all', categoryFilter, regionFilter] : categoryFilter;
                map.current.setFilter(layerId, combinedFilter);
            }
        });
    };

    const applyFilter = () => {
        if (!map.current || !map.current.getLayer('hexagons-fill') || !geoJsonData) return;

        console.log('applyFilter called with selectedRegions:', selectedRegions);

        // 1. Organize Selections
        const selectedDS = [];
        const selectedDistricts = [];
        const selectedProvinces = [];
        const activeRegions = Array.from(selectedRegions);

        activeRegions.forEach(region => {
            const [type, val] = region.split(':');
            if (type === 'ds') selectedDS.push(val);
            if (type === 'district') selectedDistricts.push(val);
            if (type === 'province') selectedProvinces.push(val);
        });

        // 2. Build Filter
        let filter = null;
        if (selectedRegions.size === 0 || selectedRegions.has('all:')) {
            filter = null;
        } else {
            const conditions = ['any'];
            if (selectedDS.length > 0) conditions.push(['in', ['get', 'DS'], ['literal', selectedDS]]);
            if (selectedDistricts.length > 0) conditions.push(['in', ['get', 'District'], ['literal', selectedDistricts]]);
            if (selectedProvinces.length > 0) conditions.push(['in', ['get', 'Province'], ['literal', selectedProvinces]]);
            
            if (conditions.length > 1) filter = conditions;
        }

        map.current.setFilter('hexagons-fill', filter);

        applyclientFilter(); 
        if (map.current.getLayer('competitor-pois')) applyCompetitorFilter();

        // 3. RANKING & SCORING LOGIC
        const isSingleSelection = selectedRegions.size === 1 && !selectedRegions.has('all:');
        
        let displayRankLabel = 'Selection Rank';
        let coloringField = 'Country_Score';     
        const rankLookup = {}; 
        let filteredFeatures = [];

        // NEW: Variables to track the Min/Max score of the CURRENT SELECTION
        let minScore = 1.0; 
        let maxScore = 0.0;

        if (geoJsonData && geoJsonData.features) {
            
            // A. Filter & Deduplicate
            const seenHexIds = new Set();
            
            filteredFeatures = geoJsonData.features.filter(feature => {
                // Filter Logic
                let matches = false;
                if (!filter) matches = true;
                else {
                    const props = feature.properties;
                    if (selectedDS.includes(props.DS)) matches = true;
                    else if (selectedDistricts.includes(props.District)) matches = true;
                    else if (selectedProvinces.includes(props.Province)) matches = true;
                }

                // Ghost Row Protection
                if (!feature.properties.Country_Rank || feature.properties.Country_Rank === 999999 || feature.properties.Country_Rank <= 0) {
                    return false; 
                }

                // Deduplication
                if (matches) {
                    if (seenHexIds.has(feature.properties.hex_id)) return false; 
                    seenHexIds.add(feature.properties.hex_id);
                    return true;
                }
                return false;
            });

            // B. Determine Mode & Calculate Ranks
            if (isSingleSelection) {
                // --- SINGLE REGION MODE ---
                const regionStr = activeRegions[0];
                const [type] = regionStr.split(':');

                if (type === 'province') {
                    displayRankLabel = 'Province Rank';
                    coloringField = 'Province_Score';
                } else if (type === 'district') {
                    displayRankLabel = 'District Rank';
                    coloringField = 'District_Score';
                } else if (type === 'ds') {
                    displayRankLabel = 'DS Rank';
                    coloringField = 'DS_Score';
                }

                filteredFeatures.forEach(feature => {
                    const dbRankField = displayRankLabel.replace(' ', '_'); 
                    rankLookup[feature.properties.hex_id] = feature.properties[dbRankField];
                    
                    // Track Min/Max for colors
                    const score = feature.properties[coloringField] || 0;
                    if (score < minScore) minScore = score;
                    if (score > maxScore) maxScore = score;
                });

            } else {
                // --- MULTI-REGION MODE ---
                if (selectedRegions.has('all:')) displayRankLabel = 'Country Rank';
                else displayRankLabel = 'Selection Rank';
                
                coloringField = 'Country_Score';

                // Sort by Country Rank
                filteredFeatures.sort((a, b) => {
                    const rankA = a.properties.Country_Rank || 999999;
                    const rankB = b.properties.Country_Rank || 999999;
                    return rankA - rankB;
                });

                // Calculate Dynamic Ranks
                let currentRank = 1;
                filteredFeatures.forEach((feature, index) => {
                    if (index > 0) {
                        const prevRank = filteredFeatures[index - 1].properties.Country_Rank;
                        const currRank = feature.properties.Country_Rank;
                        if (currRank !== prevRank) currentRank++; 
                    }
                    rankLookup[feature.properties.hex_id] = currentRank;

                    // Track Min/Max for colors
                    const score = feature.properties[coloringField] || 0;
                    if (score < minScore) minScore = score;
                    if (score > maxScore) maxScore = score;
                });
            }
        }

        // Safety: If no data found or min >= max, reset to defaults to prevent errors
        if (minScore >= maxScore) {
            minScore = 0;
            maxScore = 1; // Default
        }

        // 4. Update Colors (DYNAMIC SCALE)
        // This makes the "Best in Selection" Yellow and "Worst in Selection" Purple
        const range = maxScore - minScore;
        
        map.current.setPaintProperty('hexagons-fill', 'fill-color', [
            'interpolate',
            ['linear'],
            ['get', coloringField], 
            minScore, "#440154",                  // Lowest Score in view -> Purple
            minScore + (range * 0.25), "#31688e", 
            minScore + (range * 0.50), "#35b779",
            maxScore, "#fde725",                  // Highest Score in view -> Yellow
        ]);

        // 5. Update Popups
        map.current.off('click', 'hexagons-fill');
        map.current.off('mouseenter', 'hexagons-fill');
        map.current.off('mouseleave', 'hexagons-fill');

        map.current.on('click', 'hexagons-fill', (e) => {
            const existingPopup = document.querySelector('.maplibregl-popup');
            if (existingPopup) existingPopup.remove();

            const properties = e.features[0].properties;
            const displayRank = rankLookup[properties.hex_id] || 'N/A';
            const totalCount = filteredFeatures.length;

            // Helper to safely format numbers with commas (e.g., 1000 -> 1,000)
            const formatNum = (val) => (Number(val) || 0).toLocaleString();

            const popupContent = `
            <div class="font-sans p-4 rounded-md" style="background-color: #171717; border: 1px solid #2b2c2c;">
                <div class="space-y-2 w-52">
                
                    <div class="flex justify-between items-center gap-4 border-b border-gray-700 pb-2 mb-2">
                        <span class="font-bold text-blue-400 text-sm">${displayRankLabel}:</span> 
                        <span class="text-white text-lg font-bold text-right">${displayRank} <span class="text-xs text-gray-500 font-normal">
                    </div>

                    <div class="flex justify-between items-center gap-4">
                        <span class="font-medium text-gray-500 text-sm">Population:</span> 
                        <span class="text-white text-sm text-right">${formatNum(properties.Population)}</span>
                    </div>
                    <div class="flex justify-between items-center gap-4">
                        <span class="font-medium text-gray-500 text-sm">Visitors:</span> 
                        <span class="text-white text-sm text-right">${formatNum(properties.Latch)}</span>
                    </div>
                    <div class="flex justify-between items-center gap-4">
                        <span class="font-medium text-gray-500 text-sm">Bank Users:</span> 
                        <span class="text-white text-sm text-right">${formatNum(properties.Bank_User_5)}</span>
                    </div>
                    <div class="flex justify-between items-center gap-4">
                        <span class="font-medium text-gray-500 text-sm">Eat Out Seekers:</span> 
                        <span class="text-white text-sm text-right">${formatNum(properties.Eat_Out_5)}</span>
                    </div>
                    <div class="flex justify-between items-center gap-4">
                        <span class="font-medium text-gray-500 text-sm">Tourists:</span> 
                        <span class="text-white text-sm text-right">${formatNum(properties.Tourists)}</span>
                    </div>
                    <div class="flex justify-between items-center gap-4">
                        <span class="font-medium text-gray-500 text-sm">Province:</span> 
                        <span class="text-white text-sm text-right">${properties.Province}</span>
                    </div>
                    <div class="flex justify-between items-center gap-4">
                        <span class="font-medium text-gray-500 text-sm">District:</span> 
                        <span class="text-white text-sm text-right">${properties.District}</span>
                    </div>
                    <div class="flex justify-between items-center gap-4">
                        <span class="font-medium text-gray-500 text-sm">DS:</span> 
                        <span class="text-white text-sm text-right">${properties.DS}</span>
                    </div>
                </div>
            </div>
            `;

            new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                className: 'custom-popup'
            })
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo(map.current);
        });

        map.current.on('mouseenter', 'hexagons-fill', () => {
            map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'hexagons-fill', () => {
            map.current.getCanvas().style.cursor = '';
        });

        if (filter && geoJsonData) {
            if (filteredFeatures.length > 0) {
                const bounds = new maplibregl.LngLatBounds();
                filteredFeatures.forEach(feature => {
                    feature.geometry.coordinates[0].forEach(coord => {
                        bounds.extend(coord);
                    });
                });
                map.current.fitBounds(bounds, { padding: 50 });
            }
        } else {
            map.current.setCenter([80.0000, 6.9271]);
            map.current.setZoom(9);
        }
    };

    // const applyFilter = () => {
    //     if (!map.current || !map.current.getLayer('hexagons-fill') || !geoJsonData) return;

    //     console.log('applyFilter called with selectedRegion:', selectedRegion);

    //     const { scoreField, rankField } = getScoreAndRankFields();
    //     let filter = null;
    //     if (selectedRegion && selectedRegion !== 'all:') {
    //         const [regionType, regionValue] = selectedRegion.split(':');
    //         if (regionValue) {
    //             switch (regionType) {
    //                 case 'province':
    //                     filter = ['==', ['get', 'Province'], regionValue];
    //                     break;
    //                 case 'district':
    //                     filter = ['==', ['get', 'District'], regionValue];
    //                     break;
    //                 case 'ds':
    //                     filter = ['==', ['get', 'DS'], regionValue];
    //                     break;
    //             }
    //         }
    //     }

    //     // Apply filter to hexagon layer
    //     map.current.setFilter('hexagons-fill', filter);

    //     // Also apply filter to client layer if it exists
    //     if (map.current.getLayer('client-stores')) {
    //         applyclientFilter();
    //     }

    //     if (map.current.getLayer('competitor-pois')) {
    //         applyCompetitorFilter();
    //     }

    //     // Update styling for the new score field
    //     map.current.setPaintProperty('hexagons-fill', 'fill-color', [
    //         'interpolate',
    //         ['linear'],
    //         ['get', scoreField],
    //         0, "#440154",
    //         0.25, "#31688e",
    //         0.5, "#35b779",
    //         0.75, "#fde725",
    //     ]);

    //     // Remove existing event listeners
    //     map.current.off('click', 'hexagons-fill');
    //     map.current.off('mouseenter', 'hexagons-fill');
    //     map.current.off('mouseleave', 'hexagons-fill');

    //     // Add event listeners with current state
    //     map.current.on('click', 'hexagons-fill', (e) => {
    //         const existingPopup = document.querySelector('.maplibregl-popup');
    //         if (existingPopup) {
    //             existingPopup.remove();
    //         }

    //         const properties = e.features[0].properties;

    //         // --- MODIFICATION START ---

    //         // 1. Updated HTML content for justify-between alignment
    //         const popupContent = `
    //     <div class="font-sans p-4 rounded-md" style="background-color: #171717; border: 1px solid #2b2c2c;">
    //         <div class="space-y-2 w-48">
            
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">${rankField.replace('_', ' ')}:</span> 
    //                 <span class="text-white text-sm text-right">${properties[rankField]}</span>
    //             </div>
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">Population:</span> 
    //                 <span class="text-white text-sm text-right">${properties.Population}</span>
    //             </div>
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">Visitors:</span> 
    //                 <span class="text-white text-sm text-right">${properties.Latch}</span>
    //             </div>
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">Bank Users:</span> 
    //                 <span class="text-white text-sm text-right">${properties.Bank_User_5}</span>
    //             </div>
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">Eat Out Seekers:</span> 
    //                 <span class="text-white text-sm text-right">${properties.Eat_Out_5}</span>
    //             </div>
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">Tourists:</span> 
    //                 <span class="text-white text-sm text-right">${properties.Tourists}</span>
    //             </div>
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">Province:</span> 
    //                 <span class="text-white text-sm text-right">${properties.Province}</span>
    //             </div>
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">District:</span> 
    //                 <span class="text-white text-sm text-right">${properties.District}</span>
    //             </div>
    //             <div class="flex justify-between items-center gap-4">
    //                 <span class="font-medium text-gray-500 text-sm">DS:</span> 
    //                 <span class="text-white text-sm text-right">${properties.DS}</span>
    //             </div>
                
    //         </div>
    //     </div>
    //     `;

    //         // 2. Added 'className' to the Popup constructor to remove default styles
    //         new maplibregl.Popup({
    //             closeButton: true,
    //             closeOnClick: true,
    //             className: 'custom-popup' // This class is key to removing the white border
    //         })
    //             .setLngLat(e.lngLat)
    //             .setHTML(popupContent)
    //             .addTo(map.current);

    //         // --- MODIFICATION END ---
    //     });

    //     map.current.on('mouseenter', 'hexagons-fill', () => {
    //         map.current.getCanvas().style.cursor = 'pointer';
    //     });

    //     map.current.on('mouseleave', 'hexagons-fill', () => {
    //         map.current.getCanvas().style.cursor = '';
    //     });

    //     // Fit bounds logic
    //     if (filter && geoJsonData) {
    //         const [regionType, regionValue] = selectedRegion.split(':');

    //         const filteredFeatures = geoJsonData.features.filter(feature => {
    //             const properties = feature.properties;
    //             switch (regionType) {
    //                 case 'province':
    //                     return properties.Province === regionValue;
    //                 case 'district':
    //                     return properties.District === regionValue;
    //                 case 'ds':
    //                     return properties.DS === regionValue;
    //                 default:
    //                     return true;
    //             }
    //         });

    //         if (filteredFeatures.length > 0) {
    //             const bounds = new maplibregl.LngLatBounds();
    //             filteredFeatures.forEach(feature => {
    //                 feature.geometry.coordinates[0].forEach(coord => {
    //                     bounds.extend(coord);
    //                 });
    //             });
    //             map.current.fitBounds(bounds, { padding: 50 });
    //         }
    //     } else {
    //         map.current.setCenter([80.7718, 7.8731]);
    //         map.current.setZoom(7);
    //     }
    // };

    const addHexagonsToMap = () => {
        if (!map.current || !geoJsonData) return;

        try {
            // 1. Clean up existing layers
            if (map.current.getLayer('hexagons-fill')) {
                map.current.removeLayer('hexagons-fill');
            }
            if (map.current.getSource('hexagons')) {
                map.current.removeSource('hexagons');
            }

            // 2. Add Source
            map.current.addSource('hexagons', {
                type: 'geojson',
                data: geoJsonData
            });

            const hexagonLayer = {
                id: 'hexagons-fill',
                type: 'fill',
                source: 'hexagons',
                paint: {
                    'fill-color': '#440154', 
                    'fill-opacity': 0.7
                }
            };

            // 3. FIND THE INSERTION POINT (The Fix)
            let beforeId = undefined;

            // Strategy A: Try to put it under your specific Client Points layer
            // Note: Changed 'client-stores' to 'client-points-layer' to match your Map.jsx.
            if (map.current.getLayer('client-points-layer')) {
                beforeId = 'client-points-layer';
            } 
            // Strategy B: If Client layer isn't there, look for Competitor layers
            else if (map.current.getLayer('competitor-points-layer')) {
                beforeId = 'competitor-points-layer';
            }
            // Strategy C (The Fail-Safe): Find the first text/label layer in the map style
            // and put the hexagons under it. This guarantees points (which are usually above labels) stay visible.
            else {
                const layers = map.current.getStyle().layers;
                const labelLayer = layers.find(layer => layer.type === 'symbol');
                if (labelLayer) {
                    beforeId = labelLayer.id;
                }
            }

            // 4. Add the layer
            if (beforeId) {
                map.current.addLayer(hexagonLayer, beforeId);
                console.log(`Hexagon layer added underneath '${beforeId}'.`);
            } else {
                map.current.addLayer(hexagonLayer);
                console.log('Hexagon layer added on top (no reference layer found).');
            }

            applyFilter();

        } catch (error) {
            console.error('Error adding hexagons to map:', error);
            setError('Failed to parse and display hexagons');
        }
    };

    // Add client stores to map
    const addclientToMap = () => {
        if (!map.current || !clientGeoJsonData) return;

        try {
            // Clean up any previous uploaded layers
            const existingLayers = map.current.getStyle().layers || [];
            existingLayers.forEach(layer => {
                if (layer.id.startsWith('uploaded-amenity-')) {
                    map.current.off('mousemove', layer.id);
                    map.current.off('mouseleave', layer.id);
                    map.current.removeLayer(layer.id);
                }
            });
            // Also clean up the old single layer if it exists
            if (map.current.getLayer('client-stores')) {
                map.current.removeLayer('client-stores');
            }
            if (map.current.getSource('client')) {
                map.current.removeSource('client');
            }

            if (clientGeoJsonData.features.length === 0) return;

            // Add single GeoJSON source for all uploaded points
            map.current.addSource('client', {
                type: 'geojson',
                data: clientGeoJsonData
            });

            // Get unique amenities (preserving insertion order for color consistency)
            const amenities = [...new Set(
                clientGeoJsonData.features.map(f => f.properties.Amenity || 'Unknown')
            )];

            const newVisibility = {};

            amenities.forEach((amenity, idx) => {
                const layerId = `uploaded-amenity-${amenity.replace(/\s+/g, '-').toLowerCase()}`;
                const color = UPLOADED_COLORS[idx % UPLOADED_COLORS.length];

                map.current.addLayer({
                    id: layerId,
                    type: 'circle',
                    source: 'client',
                    filter: ['==', ['get', 'Amenity'], amenity],
                    paint: {
                        'circle-radius': 8,
                        'circle-color': color,
                        'circle-opacity': 0.85,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff'
                    },
                    layout: { 'visibility': 'visible' }
                });

                // Hover popup
                const popup = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    className: 'custom-popup'
                });
                let currentCoords = undefined;

                map.current.on('mousemove', layerId, (e) => {
                    if (!e.features || e.features.length === 0) return;
                    const coordKey = e.features[0].geometry.coordinates.toString();
                    if (currentCoords !== coordKey) {
                        currentCoords = coordKey;
                        map.current.getCanvas().style.cursor = 'pointer';
                        const coordinates = e.features[0].geometry.coordinates.slice();
                        const properties = e.features[0].properties;

                        popup.setLngLat(coordinates).setHTML(`
                            <div class="font-sans p-4 rounded-md" style="background-color: #171717; border: 1px solid #2b2c2c;">
                                <div class="space-y-2" style="min-width: 12rem; max-width: 72rem;">
                                    <div class="flex justify-between items-center gap-4">
                                        <span class="font-medium text-gray-400 text-sm">Name:</span>
                                        <span class="text-white text-sm text-right">${properties.Name || 'N/A'}</span>
                                    </div>
                                    <div class="flex justify-between items-center gap-4">
                                        <span class="font-medium text-gray-400 text-sm">Amenity:</span>
                                        <span class="text-white text-sm text-right">${properties.Amenity || 'N/A'}</span>
                                    </div>
                                    <div class="flex justify-between items-center gap-4">
                                        <span class="font-medium text-gray-400 text-sm">District:</span>
                                        <span class="text-white text-sm text-right">${properties.District || 'N/A'}</span>
                                    </div>
                                    <div class="flex justify-between items-center gap-4">
                                        <span class="font-medium text-gray-400 text-sm">DS:</span>
                                        <span class="text-white text-sm text-right">${properties.DS || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        `).addTo(map.current);
                    }
                });

                map.current.on('mouseleave', layerId, () => {
                    currentCoords = undefined;
                    map.current.getCanvas().style.cursor = '';
                    popup.remove();
                });

                // Default new amenities to visible, preserve existing user-set visibility
                newVisibility[amenity] = true;
            });

            // Merge with existing visibility preferences
            setUploadedAmenityVisibility(prev => {
                const merged = { ...newVisibility };
                Object.keys(prev).forEach(am => {
                    if (merged[am] !== undefined) merged[am] = prev[am];
                });
                return merged;
            });

            applyclientFilter();

        } catch (error) {
            console.error('Error adding uploaded locations to map:', error);
        }
    };

    // Update the addCompetitorToMap function
    const addCompetitorToMap = () => {
        if (!map.current || !competitorGeoJsonData) return;

        try {
            // Get unique categories
            const categories = [...new Set(competitorGeoJsonData.features.map(feature => feature.properties.Competitor))];

            // Remove existing competitor layers
            if (map.current.getStyle() && map.current.getStyle().layers) {
                map.current.getStyle().layers.forEach(layer => {
                    if (layer.id.startsWith('competitor-')) {
                        map.current.removeLayer(layer.id);
                    }
                });
            }

            if (map.current.getSource('competitor-pois')) {
                map.current.removeSource('competitor-pois');
            }

            // Add competitor source
            map.current.addSource('competitor-pois', {
                type: 'geojson',
                data: competitorGeoJsonData
            });

            // Create layers for each category with unique colors
            categories.forEach(category => {
                const layerId = `competitor-${category.replace(/\s+/g, '-').toLowerCase()}`;
                const categoryColor = getCategoryColor(category, categories);

                // Add layer for this category
                map.current.addLayer({
                    id: layerId,
                    type: 'circle',
                    source: 'competitor-pois',
                    filter: ['==', 'Competitor', category],
                    paint: {
                        'circle-radius': 6,
                        'circle-color': categoryColor,
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 1,
                        'circle-opacity': 0.8
                    },
                    layout: {
                        'visibility': 'none' // Start with all layers hidden
                    }
                });

                // Create hover popup for this layer
                const competitorPopup = new maplibregl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    className: 'custom-popup'
                });

                let currentFeatureCoordinates = undefined;

                // Add mousemove event for hover popup
                map.current.on('mousemove', layerId, (e) => {
                    const featureCoordinates = e.features[0].geometry.coordinates.toString();

                    if (currentFeatureCoordinates !== featureCoordinates) {
                        currentFeatureCoordinates = featureCoordinates;

                        map.current.getCanvas().style.cursor = 'pointer';

                        const coordinates = e.features[0].geometry.coordinates.slice();
                        const properties = e.features[0].properties;

                        const popupContent = `

                        <div class="font-sans p-4 rounded-md" style="background-color: #171717; border: 1px solid #2b2c2c;">
                            <div class="space-y-2" style="min-width: 12rem; max-width: 72rem;">
                                <div class="flex justify-between items-center gap-4">
                                    <span class="font-medium text-gray-400 text-sm">Name:</span> 
                                    <span class="text-white text-sm text-right">${properties.Name}</span>
                                </div>
                                <div class="flex justify-between items-center gap-4">
                                    <span class="font-medium text-gray-400 text-sm">Amenity:</span> 
                                    <span class="text-white text-sm text-right">${properties.Amenity}</span>
                                </div>
                                <div class="flex justify-between items-center gap-4">
                                    <span class="font-medium text-gray-400 text-sm">POI Name:</span> 
                                    <span class="text-white text-sm text-right">${properties.Competitor}</span>
                                </div>
                                <div class="flex justify-between items-center gap-4">
                                    <span class="font-medium text-gray-400 text-sm">District:</span> 
                                    <span class="text-white text-sm text-right">${properties.District}</span>
                                </div>
                                    <div class="flex justify-between items-center gap-4">
                                    <span class="font-medium text-gray-400 text-sm">DS:</span> 
                                    <span class="text-white text-sm text-right">${properties.DS}</span>
                                </div>
                            </div>
                       </div>
                `;


                        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                        }

                        competitorPopup.setLngLat(coordinates).setHTML(popupContent).addTo(map.current);
                    }
                });

                // Add mouseleave event to remove popup
                map.current.on('mouseleave', layerId, () => {
                    currentFeatureCoordinates = undefined;
                    map.current.getCanvas().style.cursor = '';
                    competitorPopup.remove();
                });
            });

            // Initialize all categories as unchecked
            const initialCategories = {};
            categories.forEach(category => {
                initialCategories[category] = false;
            });
            setSelectedCompetitorCategories(initialCategories);

            console.log('Competitor POIs added to map:', competitorGeoJsonData.features.length, 'points');

        } catch (error) {
            console.error('Error adding competitor POIs to map:', error);
        }
    };

    // Handle competitor category checkbox toggle
    const handleCompetitorCategoryToggle = (category) => {
        const newSelectedCategories = {
            ...selectedCompetitorCategories,
            [category]: !selectedCompetitorCategories[category]
        };

        setSelectedCompetitorCategories(newSelectedCategories);

        // Toggle layer visibility
        const layerId = `competitor-${category.replace(/\s+/g, '-').toLowerCase()}`;
        if (map.current && map.current.getLayer(layerId)) {
            const visibility = newSelectedCategories[category] ? 'visible' : 'none';
            map.current.setLayoutProperty(layerId, 'visibility', visibility);

            // Apply regional filter to the layer when it becomes visible
            if (newSelectedCategories[category]) {
                let regionFilter = null;
                if (selectedRegions.size > 0 && !selectedRegions.has('all:')) {
                    const conditions = ['any'];
                    selectedRegions.forEach(region => {
                        const [type, val] = region.split(':');
                        if (type === 'province') conditions.push(['==', 'Province', val]);
                        else if (type === 'district') conditions.push(['==', 'District', val]);
                        else if (type === 'ds') conditions.push(['==', 'DS', val]);
                    });
                    if (conditions.length > 1) regionFilter = conditions;
                }

                // Combine category filter with regional filter
                const categoryFilter = ['==', 'Competitor', category];
                const combinedFilter = regionFilter ? ['all', categoryFilter, regionFilter] : categoryFilter;
                map.current.setFilter(layerId, combinedFilter);
            }
        }
    };

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current) return;

        // Western Province bounding box [west, south, east, north]
        const WESTERN_PROVINCE_BOUNDS = [69, 3, 100, 9];

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: "https://api.maptiler.com/maps/0198d0cd-00f2-72dd-a4b1-19f11e762b14/style.json?key=dlc7UdP7VM4401tcPhWS",
            center: [80.0000, 6.9271],
            zoom: 9,
            minZoom: 8,
            maxZoom: 16,
            maxBounds: WESTERN_PROVINCE_BOUNDS,
        });

        map.current.on('load', fetchData);

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (clientGeoJsonData) {
            // Pass the selectedRegions SET correctly
            const count = countFilteredclient(selectedRegions);
            setclientCount(count);
        }
    }, [clientGeoJsonData, selectedRegions]);

    // Add hexagons when geoJsonData is available
    useEffect(() => {
        if (geoJsonData && map.current) {
            addHexagonsToMap();
        }
    }, [geoJsonData]);

    // Add client stores when clientGeoJsonData is available
    useEffect(() => {
        if (clientGeoJsonData && map.current) {
            addclientToMap();
        }
    }, [clientGeoJsonData]);

    useEffect(() => {
        const fetchNewData = async () => {
            if (isViewDataModalOpen) {
                setIsNewDataLoading(true);
                setNewDataRows([]);
                try {
                    const response = await api.get('/cargills/new-locations');
                    setNewDataRows(response.data);
                } catch (error) {
                    const errorMessage = error.response?.data?.detail || error.message || 'Failed to fetch new data';
                    toast.error(errorMessage);
                } finally {
                    setIsNewDataLoading(false);
                }
            }
        };
        fetchNewData();
    }, [isViewDataModalOpen]);// The effect depends on the modal's open state


    // Add Competitor POIs when competitorGeoJsonData is available
    useEffect(() => {
        if (competitorGeoJsonData && map.current) {
            addCompetitorToMap();
        }
    }, [competitorGeoJsonData]);

    // Apply filter when selectedRegion changes
    // Apply filter when selectedRegion or toggles change
    useEffect(() => {
        if (geoJsonData && map.current && map.current.getLayer('hexagons-fill')) {
            applyFilter();
        }
        
        // FIX: Removed the check for the old 'client-stores' layer so this runs properly
        if (clientGeoJsonData && map.current) {
            applyclientFilter();
        }
        
        if (competitorGeoJsonData && map.current) {
            applyCompetitorFilter();
        }
        
    // Added uploadedAmenityVisibility so toggling the checkboxes works instantly
    }, [selectedRegions, selectedCompetitorCategories, uploadedAmenityVisibility]);


    // const handleOptionSelect = (option) => {
    //     console.log('Region selected:', option.value, 'Label:', option.label, 'Type:', option.type);
    //     setSelectedRegion(option.value);
    //     setSearchTerm('');
    //     setIsDropdownOpen(false);
    // };

    const handleOptionSelect = (option) => {
        const newSelection = new Set(selectedRegions);

        if (option.value === 'all:') {
            // If "ALL" is clicked, clear everything else and just select "ALL"
            if (newSelection.has('all:')) {
                newSelection.clear(); // Deselecting ALL clears everything
            } else {
                newSelection.clear();
                newSelection.add('all:');
            }
        } else {
            // If a normal region is clicked, remove "ALL" first
            if (newSelection.has('all:')) {
                newSelection.delete('all:');
            }

            // Toggle the specific region
            if (newSelection.has(option.value)) {
                newSelection.delete(option.value);
            } else {
                newSelection.add(option.value);
            }
        }

        setSelectedRegions(newSelection);
        // Don't close dropdown automatically so user can select more
        // setIsDropdownOpen(false); 
    };

    const LoadingBar = ({ progress }) => {
        return (
            <div className="w-64 mt-4">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-zinc-700">
                    <div
                        style={{
                            width: `${progress}%`,
                            transition: 'width 0.5s ease-in-out'
                        }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                    />
                </div>
            </div>
        );
    };


    if (error) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-red-50 border border-red-200 rounded-lg">
                <div className="text-center">
                    <div className="text-red-600 mb-3">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h3>
                    <p className="text-red-600 mb-3">{error}</p>
                    <button
                        onClick={fetchData}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }


    return (
        <div className="relative w-full h-screen">

            {loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: '#0b0b0b' }}>
                    <div className="text-center">
                        <Loader />
                        <div  className={'font-bold text-white'} > <CountUp start={0} end={98} duration={35} delay={0}/> % </div>

                    </div>
                </div>
            )}


            <div
                ref={mapContainer}
                className={`w-full h-full ${loading ? 'invisible' : 'visible'}`}
            />

            {/* Settings Menu - Top Right Corner */}
            <div className="absolute top-4 right-4 z-10" ref={settingsRef}>
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="backdrop-blur-sm border  rounded-lg p-3 shadow-lg text-white hover:bg-zinc-500 transition-colors"  style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>

                {/* Settings Dropdown */}
                {isSettingsOpen && (
                    <div className="absolute right-0 mt-2 w-48  backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden" style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}>
                        
                        {userRole === 'admin' && (
                            <button
                                onClick={() => {
                                    setIsWeightsModalOpen(true);
                                    setIsSettingsOpen(false);
                                }}
                                className="w-full px-4 py-3 text-left text-white hover:bg-zinc-800 transition-colors flex items-center space-x-3"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16l3-1m-3 1l-3-1" />
                                </svg>
                                <span className="text-sm">Weights</span>
                            </button>
                        )}

                        {userRole === 'admin' && (
                            <button
                                onClick={() => {
                                    setIsUploadModalOpen(true);
                                    setIsSettingsOpen(false);
                                }}
                                className="w-full px-4 py-3 text-left text-white hover:bg-zinc-800 transition-colors flex items-center space-x-3"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                                </svg>
                                <span className="text-sm">Upload Data</span>
                            </button>
                        )}

                        <button
                            onClick={() => {
                                setIsViewDataModalOpen(true);
                                setIsSettingsOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left text-white hover:bg-zinc-800 transition-colors flex items-center space-x-3"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18M9 4v16M15 4v16" />
                            </svg>
                            <span className="text-sm">View Added Data</span>
                        </button>

                        {userRole === 'admin' && (
                            <button
                                onClick={() => {
                                    setIsUserManagementOpen(true);
                                    setIsSettingsOpen(false);
                                }}
                                className="w-full px-4 py-3 text-left text-white hover:bg-zinc-800 transition-colors flex items-center space-x-3"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.284-1.255-.778-1.667M11 6a3 3 0 11-6 0 3 3 0 016 0zM11 17a3 3 0 01-3-3v-2m0 0V9a3 3 0 013-3m-3 9h-2m5-3.098V9A3 3 0 008 6M5 9a3 3 0 00-3 3v2a3 3 0 003 3m5-9V9a3 3 0 013-3m3 3v2a3 3 0 01-3 3m-3-9h2M11 3a3 3 0 013 3v2m0 0V9a3 3 0 01-3 3m3-3h2"></path>
                                </svg>
                                <span className="text-sm">User Management</span>
                            </button>
                        )}

                        <button
                            onClick={() => {
                                logout(); // Use logout from context
                                navigate('/login');
                            }}
                            className="w-full px-4 py-3 text-left text-white hover:bg-zinc-800 transition-colors flex items-center space-x-3 border-t border-gray-700"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{/* ... icon ... */}</svg>
                            <span className="text-sm">Logout</span>
                        </button>
                    </div>
                )}
            </div>


            {isUploadModalOpen && (
                <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="rounded-2xl p-8 shadow-xl w-full max-w-md" style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}>
                        <h2 className="text-white text-xl font-semibold mb-6">Upload New Locations</h2>


                        <div className="space-y-4 mb-8">
                            <label
                                htmlFor="file-upload"
                                className="relative cursor-pointer rounded-lg border-2 border-dashed border-zinc-600 hover:border-zinc-400 p-6 flex flex-col items-center justify-center transition-colors"
                            >
                                <svg className="w-10 h-10 text-zinc-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-gray-300 text-sm">
                                    {selectedFile ? 'File selected:' : 'Click to upload a file'}
                                </span>
                                <span className="text-white font-semibold text-sm mt-1">
                                    {selectedFile ? selectedFile.name : 'CSV format only'}
                                </span>
                                <input
                                    id="file-upload"
                                    name="file-upload"
                                    type="file"
                                    className="sr-only"
                                    accept=".csv"
                                    onChange={(e) => {
                                        setSelectedFile(e.target.files[0]);
                                        setUploadStatus('idle'); // Reset status on new file selection
                                    }}
                                />
                            </label>

                            {/* --- THIS IS THE NEW EXAMPLE BLOCK --- */}
                            <div>
                                <p className="text-sm font-medium text-white mb-2">
                                    Required CSV Format:
                                </p>

                                <pre className="bg-zinc-800 p-3 rounded-md border border-zinc-700">
                                    <code className="text-gray-300 text-xs whitespace-pre-wrap">
                                      {`Name,Amenity,geometry 
New Branch Name,Supermarket,POINT (79.9189121 6.8865642)`}
                                    </code>
                                </pre>
                            </div>

                            {/* Status Messages */}
                            {uploadStatus === 'success' && <p className="text-green-400 text-sm text-center">{uploadMessage}</p>}
                        </div>

                        <div className="flex justify-center space-x-3">
                            <button
                                type="button"
                                className="px-6 py-1 bg-transparent text-white text-sm rounded-lg border border-zinc-700 hover:bg-zinc-800 transition-colors min-w-[130px]"
                                onClick={() => {
                                    setIsUploadModalOpen(false);
                                    setSelectedFile(null);
                                    setUploadStatus('idle');
                                }}
                                disabled={uploadStatus === 'uploading'}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUploadSubmit}
                                className="px-6 py-2 rounded-lg bg-gray-300 hover:bg-gray-200 text-black flex items-center justify-center min-w-[130px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!selectedFile || uploadStatus === 'uploading'}
                            >
                                {uploadStatus === 'uploading' ? (
                                    <>
                                        <ImSpinner2 className="animate-spin h-5 w-5 mr-3" />
                                        <span>Uploading...</span>
                                    </>
                                ) : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isViewDataModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-70">
                    <div
                        className="rounded-2xl p-6 shadow-xl w-full max-w-3xl flex flex-col"
                        style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c', height: '70vh' }}
                    >
                        {/* --- MODAL HEADER --- */}
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                            <h2 className="text-white text-xl font-semibold">Newly Added Locations</h2>
                            <div className="flex items-center space-x-4">
                                {userRole === 'admin' && (
                                    <button
                                        onClick={handleDeleteSelected}
                                        disabled={selectedRows.size === 0}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-red-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Delete Selected ({selectedRows.size})
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setIsViewDataModalOpen(false);
                                        setSelectedRows(new Set()); // Clear selection on close
                                    }}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        </div>

                        {/* --- TABLE CONTAINER --- */}
                        <div className="flex-grow overflow-y-auto scrollbar-hide">
                            {isNewDataLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <ImSpinner2 className="animate-spin h-8 w-8 text-white" />
                                </div>
                            ) : newDataRows.length > 0 ? (
                                <table className="w-full text-sm text-left text-gray-300">
                                    <thead className="text-xs text-gray-400 uppercase bg-zinc-800 sticky top-0">
                                    <tr>
                                        {userRole === 'admin' && (
                                            <th scope="col" className="p-4">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox h-4 w-4 text-blue-600 rounded bg-gray-700 border-gray-600"
                                                    checked={newDataRows.length > 0 && selectedRows.size === newDataRows.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            const allRowGeometries = new Set(newDataRows.map(row => row.geometry));
                                                            setSelectedRows(allRowGeometries);
                                                        } else {
                                                            setSelectedRows(new Set());
                                                        }
                                                    }}
                                                />
                                            </th>
                                        )}
                                        <th scope="col" className="px-4 py-3">Name</th>
                                        <th scope="col" className="px-4 py-3">Amenity</th>
                                        <th scope="col" className="px-4 py-3">Province</th>
                                        <th scope="col" className="px-4 py-3">District</th>
                                        <th scope="col" className="px-4 py-3">DS Division</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {newDataRows.map((row) => (
                                        <tr key={row.geometry} className="border-b border-zinc-700 hover:bg-zinc-800">
                                            {userRole === 'admin' && (
                                                <td className="p-4">
                                                    <input
                                                        type="checkbox"
                                                        className="form-checkbox h-4 w-4 text-blue-600 rounded bg-gray-700 border-gray-600"
                                                        checked={selectedRows.has(row.geometry)}
                                                        onChange={() => {
                                                            const newSelectedRows = new Set(selectedRows);
                                                            if (newSelectedRows.has(row.geometry)) {
                                                                newSelectedRows.delete(row.geometry);
                                                            } else {
                                                                newSelectedRows.add(row.geometry);
                                                            }
                                                            setSelectedRows(newSelectedRows);
                                                        }}
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-white">{row.Name}</td>
                                            <td className="px-4 py-3">{row.Amenity}</td>
                                            <td className="px-4 py-3">{row.Province}</td>
                                            <td className="px-4 py-3">{row.District}</td>
                                            <td className="px-4 py-3">{row.DS}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-gray-400">No new locations have been added yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <UserManagementModal
                isOpen={isUserManagementOpen}
                onClose={() => setIsUserManagementOpen(false)}
            />

            <WeightUpdateModal
                isOpen={isWeightsModalOpen}
                onClose={() => setIsWeightsModalOpen(false)}
                weights={weights}
                setWeights={setWeights}
                onSubmit={handleWeightsSubmit}
                weightsLoading={weightsLoading}
                weightsButtonStatus={weightsButtonStatus}
            />

            {/* Filter Menu */}
            <div className="absolute top-4 left-4 rounded-lg p-4 shadow-lg min-w-80 z-20" style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }} >
                <div className="space-y-3">
                    <div className="relative" ref={dropdownRef}>
                        <label htmlFor="region-search" className="block text-gray-300 text-sm font-medium mb-2">
                            Select Region
                        </label>

                        <div className="relative">
                            <input
                                id="region-search"
                                type="text"
                                value={isDropdownOpen ? searchTerm : getDisplayText()}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if (!isDropdownOpen) setIsDropdownOpen(true);
                                }}
                                onFocus={() => {
                                    setIsDropdownOpen(true);
                                    setSearchTerm('');
                                }}
                                placeholder="Search for a region..."
                                className="w-full p-2 rounded-lg border border-zinc-500 bg-transparent text-gray-300 focus:border-gray-400 focus:outline-none transition-colors"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>

                        {isDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto" style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}>
                                {filteredOptions.length > 0 ? (
                                    // filteredOptions.map((option) => (
                                    //     <button
                                    //         key={option.value}
                                    //         onClick={() => handleOptionSelect(option)}
                                    //         className="w-full px-3 py-2 text-left text-white hover:bg-zinc-800  focus:outline-none"
                                    //     >
                                    //         {option.label}
                                    //     </button>
                                    // ))
                                    filteredOptions.map((option) => {
                                        const isSelected = selectedRegions.has(option.value);
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() => handleOptionSelect(option)}
                                                className={`w-full px-3 py-2 text-left hover:bg-zinc-800 focus:outline-none flex items-center space-x-2 ${isSelected ? 'bg-zinc-800' : ''}`}
                                            >
                                                {/* Custom Checkbox */}
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-zinc-500 bg-transparent'}`}>
                                                    {isSelected && (
                                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className={isSelected ? 'text-white font-medium' : 'text-gray-300'}>
                                                    {option.label}
                                                </span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="px-3 py-2 text-gray-400">
                                        No regions found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Competitor Categories Box - Positioned closer to Select Region box */}
            <div className="absolute top-32 left-4 z-10 rounded-lg p-4 shadow-lg min-w-80 max-w-96 flex flex-col max-h-[calc(100vh-9rem)]" 
                style={{ backgroundColor: '#171717', border: '1px solid #2b2c2c' }}>
                
                {/* Global Controls Header */}
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3 flex-shrink-0">
                    <h3 className="text-gray-200 font-semibold">Locations</h3>
                    
                    <div className="flex space-x-3 text-xs">
                        <button
                            onClick={() => {
                                const newSelected = {};
                                if (competitorSummary && competitorSummary.grouped) {
                                    const groups = competitorSummary.grouped;
                                    Object.values(groups).forEach(group => {
                                        Object.keys(group).forEach(comp => {
                                            newSelected[comp] = true;
                                            const layerId = `competitor-${comp.replace(/\s+/g, '-').toLowerCase()}`;
                                            if (map.current && map.current.getLayer(layerId)) {
                                                map.current.setLayoutProperty(layerId, 'visibility', 'visible');
                                            }
                                        });
                                    });
                                }
                                setSelectedCompetitorCategories(newSelected);
                            }}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Select All
                        </button>

                        <button
                            onClick={() => {
                                const newSelected = {};
                                if (competitorSummary && competitorSummary.grouped) {
                                    const groups = competitorSummary.grouped;
                                    Object.values(groups).forEach(group => {
                                        Object.keys(group).forEach(comp => {
                                            newSelected[comp] = false;
                                            const layerId = `competitor-${comp.replace(/\s+/g, '-').toLowerCase()}`;
                                            if (map.current && map.current.getLayer(layerId)) {
                                                map.current.setLayoutProperty(layerId, 'visibility', 'none');
                                            }
                                        });
                                    });
                                }
                                setSelectedCompetitorCategories(newSelected);
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* --- UPLOADED LOCATIONS SECTION --- */}
                {clientGeoJsonData && clientGeoJsonData.features.length > 0 && (() => {
                    const amenityGroups = getUploadedAmenityGroups(clientGeoJsonData, selectedRegions);
                    const entries = Object.entries(amenityGroups);
                    if (entries.length === 0) return null;

                    // Keep color consistent with map layers (same order as layer creation)
                    const allAmenities = [...new Set(
                        clientGeoJsonData.features.map(f => f.properties.Amenity || 'Unknown')
                    )];

                    return (
                        <div className="mb-2">
                            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-2 px-1">
                                Uploaded Data
                            </p>
                            <div className="space-y-1">
                                {entries.sort(([a], [b]) => a.localeCompare(b)).map(([amenity, count]) => {
                                    const colorIdx = allAmenities.indexOf(amenity);
                                    const color = UPLOADED_COLORS[colorIdx % UPLOADED_COLORS.length];
                                    const isVisible = uploadedAmenityVisibility[amenity] !== false;

                                    return (
                                        <label
                                            key={amenity}
                                            className="flex items-center space-x-3 p-2 rounded hover:bg-zinc-800 cursor-pointer group transition-colors bg-zinc-900/50 border border-zinc-800"
                                        >
                                            {/* Custom colored checkbox */}
                                            <div className="relative flex-shrink-0 w-4 h-4">
                                                <input
                                                    type="checkbox"
                                                    checked={isVisible}
                                                    onChange={(e) => {
                                                        const newVis = e.target.checked;
                                                        setUploadedAmenityVisibility(prev => ({
                                                            ...prev,
                                                            [amenity]: newVis
                                                        }));
                                                        const layerId = `uploaded-amenity-${amenity.replace(/\s+/g, '-').toLowerCase()}`;
                                                        if (map.current && map.current.getLayer(layerId)) {
                                                            map.current.setLayoutProperty(
                                                                layerId,
                                                                'visibility',
                                                                newVis ? 'visible' : 'none'
                                                            );
                                                        }
                                                    }}
                                                    className="appearance-none absolute inset-0 w-full h-full border border-gray-500 rounded cursor-pointer focus:ring-0"
                                                    style={isVisible
                                                        ? { backgroundColor: color, borderColor: color }
                                                        : {}
                                                    }
                                                />
                                                {isVisible && (
                                                    <svg
                                                        className="absolute inset-0 w-3 h-3 text-white m-auto pointer-events-none"
                                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between w-full text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <span className="text-white font-medium">{amenity}</span>
                                                </div>
                                                <span className="text-gray-500 text-xs tabular-nums">({count})</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            <hr className="border-gray-700 my-3" />
                        </div>
                    );
                })()}
                {/* ---------------------------------- */}

                {/* Competitor Groups List */}
                <div className="flex-1 overflow-y-auto space-y-3 min-h-0 scrollbar-hide">
                    {competitorSummary && competitorSummary.grouped && (() => {
                        const groups = competitorSummary.grouped;
                        
                        return Object.entries(groups).sort().map(([groupName, competitors]) => {
                            const competitorList = Object.keys(competitors);
                            const isAllSelected = competitorList.every(comp => selectedCompetitorCategories[comp]);
                            const isExpanded = expandedGroups.has(groupName);

                            return (
                                <div key={groupName} className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex-shrink-0">
                                    {/* Group Header */}
                                    <div className="p-3 bg-zinc-800/50 flex items-center justify-between">
                                        
                                        <div 
                                            className="flex items-center gap-2 cursor-pointer flex-1"
                                            onClick={() => toggleGroupAccordion(groupName)}
                                        >
                                            <svg 
                                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="text-sm font-medium text-white">{groupName}s</span>
                                            <span className="text-xs text-gray-500">({competitorList.length})</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleGroupSelectAll(groupName, competitors, isAllSelected)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                    isAllSelected ? 'bg-red-500' : 'bg-gray-600'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                                        isAllSelected ? 'translate-x-5' : 'translate-x-1'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Collapsible Body */}
                                    {isExpanded && (
                                        <div className="bg-zinc-900/50 p-2 space-y-1 pl-4 border-t border-zinc-800 animate-in slide-in-from-top-2 duration-200">
                                            {Object.entries(competitors).sort().map(([compName, count]) => (
                                                <label 
                                                    key={compName} 
                                                    className="flex items-center space-x-3 p-2 rounded hover:bg-zinc-800 cursor-pointer group transition-colors"
                                                >
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCompetitorCategories[compName] || false}
                                                            onChange={() => handleCompetitorCategoryToggle(compName)}
                                                            className="peer appearance-none h-4 w-4 border border-gray-500 rounded bg-transparent checked:bg-red-500 checked:border-red-500 focus:ring-0 focus:ring-offset-0 transition-colors"
                                                        />
                                                        <svg className="absolute w-3 h-3 text-white pointer-events-none hidden peer-checked:block left-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                                        </svg>
                                                    </div>
                                                    <div className="flex justify-between w-full text-sm">
                                                        <span className="text-gray-300 group-hover:text-white transition-colors">{compName}</span>
                                                        <span className="text-gray-600 text-xs tabular-nums">({count})</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

        </div>
    );
}

